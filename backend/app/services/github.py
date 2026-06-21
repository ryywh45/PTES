import httpx
from fastapi import HTTPException

from app.config import (
    GITHUB_CALLBACK_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_PAT,
)

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"
GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

USER_NODE_ID_QUERY = """
query($login: String!) {
  user(login: $login) {
    id
  }
}
"""

REPO_COMMITS_QUERY = """
query($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, author: { id: $authorId }, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              committedDate
            }
          }
        }
      }
    }
  }
}
"""

CONTRIBUTIONS_BY_REPO_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!, $after: String) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributions(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          occurredAt
          repository {
            nameWithOwner
          }
        }
      }
    }
  }
}
"""


def _github_headers(access_token: str | None = None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = resolve_github_token(access_token)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def resolve_github_token(oauth_token: str | None = None) -> str | None:
    """OAuth token takes precedence; public-username mode falls back to GITHUB_PAT."""
    return oauth_token or GITHUB_PAT or None


def has_github_auth(oauth_token: str | None = None) -> bool:
    return bool(resolve_github_token(oauth_token))


def build_authorize_url(state: str = "ptes") -> str:
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth 尚未設定（缺少 GITHUB_CLIENT_ID）")
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_CALLBACK_URL,
        "scope": "read:user repo",
        "state": state,
    }
    query = httpx.QueryParams(params)
    return f"{GITHUB_AUTHORIZE_URL}?{query}"


async def exchange_code_for_token(code: str) -> dict:
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth 尚未設定")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_CALLBACK_URL,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="無法向 GitHub 交換 access token")
    data = resp.json()
    if "error" in data:
        raise HTTPException(status_code=400, detail=data.get("error_description", data["error"]))
    return data


async def github_get(
    path: str,
    params: dict | None = None,
    access_token: str | None = None,
) -> object:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}{path}",
            headers=_github_headers(access_token),
            params=params or {},
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub 使用者不存在")
    if resp.status_code == 401 and access_token:
        raise HTTPException(status_code=401, detail="GitHub token 已失效，請重新連結")
    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        raise HTTPException(status_code=429, detail="GitHub API rate limit 已達上限，請稍後再試")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"GitHub API 錯誤 ({resp.status_code})")
    return resp.json()


async def fetch_github_user(access_token: str) -> dict:
    data = await github_get("/user", access_token=access_token)
    return data if isinstance(data, dict) else {}


async def fetch_public_user(username: str) -> dict:
    data = await github_get(f"/users/{username.strip()}")
    return data if isinstance(data, dict) else {}


async def fetch_public_repos(access_token: str) -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        batch = await github_get(
            "/user/repos",
            {
                "visibility": "public",
                "affiliation": "owner,collaborator,organization_member",
                "sort": "updated",
                "per_page": 100,
                "page": page,
            },
            access_token=access_token,
        )
        if not isinstance(batch, list) or not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return [r for r in repos if not r.get("private")]


async def fetch_public_repos_for_user(username: str) -> list[dict]:
    repos: list[dict] = []
    page = 1
    login = username.strip()
    while True:
        batch = await github_get(
            f"/users/{login}/repos",
            {
                "type": "owner",
                "sort": "updated",
                "per_page": 100,
                "page": page,
            },
        )
        if not isinstance(batch, list) or not batch:
            break
        repos.extend(r for r in batch if not r.get("private"))
        if len(batch) < 100:
            break
        page += 1
    return repos


def repo_to_summary(repo: dict) -> dict:
    return {
        "id": repo["id"],
        "name": repo["name"],
        "full_name": repo["full_name"],
        "description": repo.get("description"),
        "created_at": repo["created_at"],
        "updated_at": repo["updated_at"],
        "html_url": repo["html_url"],
        "private": bool(repo.get("private")),
    }


async def fetch_repo_languages(
    owner: str,
    name: str,
    access_token: str | None = None,
) -> dict[str, int]:
    data = await github_get(
        f"/repos/{owner}/{name}/languages",
        access_token=access_token,
    )
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, int)}


def language_names_above_threshold(
    languages: dict[str, int],
    min_percent: float = 1.0,
) -> list[str]:
    if not languages:
        return []
    total = sum(languages.values())
    if total <= 0:
        return []
    ranked = sorted(languages.items(), key=lambda item: item[1], reverse=True)
    return [name for name, nbytes in ranked if (nbytes / total) * 100 >= min_percent]


def _raise_graphql_errors(resp: httpx.Response, data: dict) -> None:
    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub token 已失效，請重新連結")
    if resp.status_code == 403 and "rate limit" in resp.text.lower():
        raise HTTPException(status_code=429, detail="GitHub API rate limit 已達上限，請稍後再試")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"GitHub GraphQL 錯誤 ({resp.status_code})")
    errors = data.get("errors")
    if not errors:
        return
    messages = [e.get("message", "") for e in errors if isinstance(e, dict)]
    combined = " ".join(messages).lower()
    if "rate limit" in combined:
        raise HTTPException(status_code=429, detail="GitHub API rate limit 已達上限，請稍後再試")
    if any("could not resolve to a user" in m.lower() for m in messages):
        raise HTTPException(status_code=404, detail="GitHub 使用者不存在")
    raise HTTPException(status_code=502, detail=messages[0] if messages else "GitHub GraphQL 查詢失敗")


async def github_graphql(
    query: str,
    variables: dict | None = None,
    access_token: str | None = None,
) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_GRAPHQL_URL,
            headers=_github_headers(access_token),
            json={"query": query, "variables": variables or {}},
        )
    data = resp.json() if resp.content else {}
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="GitHub GraphQL 回傳格式錯誤")
    _raise_graphql_errors(resp, data)
    payload = data.get("data")
    return payload if isinstance(payload, dict) else {}


async def fetch_user_node_id(login: str, access_token: str | None = None) -> str:
    data = await github_graphql(
        USER_NODE_ID_QUERY,
        {"login": login.strip()},
        access_token=access_token,
    )
    user = data.get("user")
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=404, detail="GitHub 使用者不存在")
    return user["id"]


async def fetch_repo_commit_dates(
    owner: str,
    name: str,
    author_id: str,
    since: str,
    access_token: str | None = None,
) -> set[str]:
    since_ts = f"{since}T00:00:00Z" if len(since) == 10 else since
    dates: set[str] = set()
    cursor: str | None = None

    while True:
        data = await github_graphql(
            REPO_COMMITS_QUERY,
            {
                "owner": owner,
                "name": name,
                "authorId": author_id,
                "since": since_ts,
                "after": cursor,
            },
            access_token=access_token,
        )
        repo = data.get("repository")
        if not isinstance(repo, dict):
            break
        branch_ref = repo.get("defaultBranchRef")
        if not isinstance(branch_ref, dict):
            break
        target = branch_ref.get("target")
        if not isinstance(target, dict):
            break
        history = target.get("history")
        if not isinstance(history, dict):
            break

        nodes = history.get("nodes") or []
        for node in nodes:
            if isinstance(node, dict) and node.get("committedDate"):
                dates.add(node["committedDate"][:10])

        page_info = history.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")
        if not cursor:
            break

    return dates


def _to_graphql_timestamp(date_str: str, end_of_day: bool = False) -> str:
    if len(date_str) > 10:
        return date_str
    suffix = "T23:59:59Z" if end_of_day else "T00:00:00Z"
    return f"{date_str}{suffix}"


def _accumulate_contribution_nodes(
    nodes: list,
    by_repo: dict[str, set[str]],
) -> None:
    for node in nodes:
        if not isinstance(node, dict) or not node.get("occurredAt"):
            continue
        repo = node.get("repository")
        if not isinstance(repo, dict) or not repo.get("nameWithOwner"):
            continue
        by_repo.setdefault(repo["nameWithOwner"], set()).add(node["occurredAt"][:10])


async def fetch_commit_contribution_dates(
    login: str,
    from_date: str,
    to_date: str,
    access_token: str | None = None,
) -> dict[str, set[str]]:
    """Fetch commit contribution dates per repo via contributionsCollection."""
    from_ts = _to_graphql_timestamp(from_date)
    to_ts = _to_graphql_timestamp(to_date, end_of_day=True)

    by_repo: dict[str, set[str]] = {}
    cursor: str | None = None

    while True:
        variables: dict = {
            "login": login.strip(),
            "from": from_ts,
            "to": to_ts,
            "after": cursor,
        }
        data = await github_graphql(
            CONTRIBUTIONS_BY_REPO_QUERY,
            variables,
            access_token=access_token,
        )
        user = data.get("user")
        if not isinstance(user, dict):
            break

        collection = user.get("contributionsCollection")
        if not isinstance(collection, dict):
            break

        contributions = collection.get("commitContributions")
        if not isinstance(contributions, dict):
            break

        nodes = contributions.get("nodes") or []
        _accumulate_contribution_nodes(nodes, by_repo)

        page_info = contributions.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")
        if not cursor:
            break

    return by_repo
