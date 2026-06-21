from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import Profile, Project
from app.services.github import (
    fetch_commit_contribution_dates,
    fetch_repo_commit_dates,
    fetch_user_node_id,
    has_github_auth,
    resolve_github_token,
)
from app.services.project_helpers import get_github_token
from app.utils import dump_activity_dates, parse_activity_dates, utc_now_iso

SYNC_EARLIEST_DATE = "2023-01-01"
THROTTLE_MINUTES = 30


def _parse_repo_full_name(full_name: str) -> tuple[str, str] | None:
    parts = full_name.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def _since_for_project(start_date: str) -> str:
    return max(start_date, SYNC_EARLIEST_DATE)


def _is_throttled(profile: Profile, force: bool) -> bool:
    if force or not profile.github_activity_synced_at:
        return False
    try:
        synced_at = datetime.fromisoformat(
            profile.github_activity_synced_at.replace("Z", "+00:00")
        )
    except ValueError:
        return False
    return datetime.now(synced_at.tzinfo) - synced_at < timedelta(minutes=THROTTLE_MINUTES)


def _merge_activity_dates(project: Project, commit_dates: set[str]) -> list[str]:
    existing = set(parse_activity_dates(project.activity_dates))
    merged = existing | commit_dates
    if not commit_dates:
        merged.add(project.start_date)
        if project.end_date:
            merged.add(project.end_date)
    return sorted(merged)


def _http_error_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, str):
        return detail
    return str(detail)


async def _fetch_history_fallback(
    owner: str,
    name: str,
    author_id: str,
    since: str,
    access_token: str | None,
) -> set[str]:
    return await fetch_repo_commit_dates(
        owner,
        name,
        author_id,
        since,
        access_token=access_token,
    )


async def sync_profile_github_activity(
    session: Session,
    profile: Profile,
    *,
    force: bool = False,
    project_ids: list[int] | None = None,
) -> dict:
    if not profile.github_login:
        return {
            "synced": 0,
            "skipped": True,
            "reason": "no_github",
            "errors": [],
            "synced_at": profile.github_activity_synced_at,
        }

    if _is_throttled(profile, force):
        return {
            "synced": 0,
            "skipped": True,
            "reason": "throttled",
            "errors": [],
            "synced_at": profile.github_activity_synced_at,
        }

    query = select(Project).where(
        Project.profile_id == profile.id,
        Project.github_full_name.is_not(None),
    )
    if project_ids:
        query = query.where(Project.id.in_(project_ids))
    projects = session.exec(query).all()

    if not projects:
        synced_at = utc_now_iso()
        profile.github_activity_synced_at = synced_at
        session.add(profile)
        session.commit()
        session.refresh(profile)
        return {
            "synced": 0,
            "skipped": False,
            "reason": "no_projects",
            "errors": [],
            "synced_at": synced_at,
        }

    token_row = get_github_token(session, profile.id)
    oauth_token = token_row.access_token if token_row else None
    access_token = resolve_github_token(oauth_token)

    if not has_github_auth(oauth_token):
        return {
            "synced": 0,
            "skipped": False,
            "reason": "no_token",
            "errors": [
                "公開 username 模式需設定 GITHUB_PAT（backend/.env），"
                "或使用 OAuth 連結自己的 GitHub 帳號，否則 GraphQL 配額不足"
            ],
            "synced_at": profile.github_activity_synced_at,
        }

    errors: list[str] = []
    contributions_by_repo: dict[str, set[str]] = {}
    author_id: str | None = None
    rate_limited = False
    author_id_unavailable = False

    to_date = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        contributions_by_repo = await fetch_commit_contribution_dates(
            profile.github_login,
            SYNC_EARLIEST_DATE,
            to_date,
            access_token=access_token,
        )
    except HTTPException as exc:
        if exc.status_code == 429:
            rate_limited = True
        errors.append(f"contributionsCollection: {_http_error_message(exc)}")
    except Exception as exc:
        errors.append(f"contributionsCollection: {exc}")

    if rate_limited and not contributions_by_repo:
        synced_at = utc_now_iso()
        profile.github_activity_synced_at = synced_at
        session.add(profile)
        session.commit()
        session.refresh(profile)
        return {
            "synced": 0,
            "skipped": False,
            "reason": "rate_limited",
            "errors": errors,
            "synced_at": synced_at,
        }

    synced = 0
    for project in projects:
        if not project.github_full_name:
            continue

        parsed = _parse_repo_full_name(project.github_full_name)
        if not parsed:
            errors.append(f"{project.name}: 無效的 repository 名稱")
            continue

        owner, name = parsed
        commit_dates = contributions_by_repo.get(project.github_full_name, set())

        if not commit_dates and not rate_limited:
            if author_id is None and not author_id_unavailable:
                try:
                    author_id = await fetch_user_node_id(
                        profile.github_login,
                        access_token,
                    )
                except HTTPException as exc:
                    if exc.status_code == 429:
                        rate_limited = True
                        author_id_unavailable = True
                    errors.append(
                        f"{project.github_full_name}: 無法取得 GitHub 使用者 ID — "
                        f"{_http_error_message(exc)}"
                    )
                    continue
                except Exception as exc:
                    author_id_unavailable = True
                    errors.append(
                        f"{project.github_full_name}: 無法取得 GitHub 使用者 ID — {exc}"
                    )
                    continue

            if author_id and not rate_limited:
                since = _since_for_project(project.start_date)
                try:
                    commit_dates = await _fetch_history_fallback(
                        owner,
                        name,
                        author_id,
                        since,
                        access_token,
                    )
                except HTTPException as exc:
                    if exc.status_code == 429:
                        rate_limited = True
                    errors.append(
                        f"{project.github_full_name}: {_http_error_message(exc)}"
                    )
                    continue
                except Exception as exc:
                    errors.append(f"{project.github_full_name}: {exc}")
                    continue
        elif not commit_dates and rate_limited:
            errors.append(
                f"{project.github_full_name}: 已略過 fallback（API rate limit）"
            )
            continue

        if not commit_dates:
            continue

        project.activity_dates = dump_activity_dates(
            _merge_activity_dates(project, commit_dates)
        )
        session.add(project)
        synced += 1

    synced_at = utc_now_iso()
    profile.github_activity_synced_at = synced_at
    session.add(profile)
    session.commit()
    session.refresh(profile)

    return {
        "synced": synced,
        "skipped": False,
        "reason": None,
        "errors": errors,
        "synced_at": synced_at,
    }
