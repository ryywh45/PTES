from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.config import FRONTEND_URL
from app.database import get_session
from app.deps import get_active_profile, get_optional_profile
from app.models import Profile, Project, Tag
from app.schemas import (
    GitHubImportRequest,
    GitHubImportResult,
    GitHubLoginResponse,
    GitHubRepoRead,
    GitHubStatus,
    GitHubSyncResult,
    ProjectRead,
)
from app.services.github import (
    build_authorize_url,
    exchange_code_for_token,
    fetch_github_user,
    fetch_public_repos,
    fetch_public_repos_for_user,
    fetch_repo_languages,
    language_names_above_threshold,
    repo_to_summary,
)
from app.services.github_sync import sync_profile_github_activity
from app.services.language_tags import resolve_language_tag_ids
from app.services.project_helpers import (
    clear_github_token,
    get_github_token,
    project_to_dict,
    save_github_token,
    set_project_tags,
)
from app.utils import activity_for_project, dump_activity_dates

router = APIRouter(prefix="/api/v1/github", tags=["github"])


async def _repos_for_profile(session: Session, profile: Profile) -> list[dict]:
    if not profile.github_login:
        raise HTTPException(status_code=400, detail="本機 profile 無 GitHub 使用者")
    token = get_github_token(session, profile.id)
    if token:
        return await fetch_public_repos(token.access_token)
    return await fetch_public_repos_for_user(profile.github_login)


@router.get("/login", response_model=GitHubLoginResponse)
def github_login():
    return GitHubLoginResponse(authorize_url=build_authorize_url())


@router.get("/callback")
async def github_callback(code: str | None = None, session: Session = Depends(get_session)):
    if not code:
        raise HTTPException(status_code=400, detail="缺少 OAuth code")
    token_data = await exchange_code_for_token(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub 未回傳 access token")
    user = await fetch_github_user(access_token)
    profile, _token = save_github_token(
        session,
        access_token=access_token,
        scope=token_data.get("scope"),
        github_login=user.get("login"),
        display_name=user.get("name") or user.get("login"),
        avatar_url=user.get("avatar_url"),
    )
    return RedirectResponse(
        url=f"{FRONTEND_URL}/projects?github=connected&profile={profile.id}"
    )


@router.get("/status", response_model=GitHubStatus)
def github_status(
    profile: Profile | None = Depends(get_optional_profile),
    session: Session = Depends(get_session),
):
    if not profile:
        return GitHubStatus(connected=False)
    if not profile.github_login:
        return GitHubStatus(connected=False, profile_id=profile.id)
    token = get_github_token(session, profile.id)
    if token:
        return GitHubStatus(
            connected=True,
            login=token.github_login or profile.github_login,
            profile_id=profile.id,
            public_only=False,
        )
    return GitHubStatus(
        connected=True,
        login=profile.github_login,
        profile_id=profile.id,
        public_only=True,
    )


@router.delete("/disconnect")
def github_disconnect(
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    clear_github_token(session, profile.id)
    return {"ok": True}


@router.get("/repos", response_model=list[GitHubRepoRead])
async def github_repos(
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    repos = await _repos_for_profile(session, profile)
    return [repo_to_summary(r) for r in repos]


@router.post("/sync-activity", response_model=GitHubSyncResult)
async def github_sync_activity(
    force: bool = Query(default=False),
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    result = await sync_profile_github_activity(session, profile, force=force)
    return GitHubSyncResult(**result)


@router.post("/import", response_model=GitHubImportResult)
async def github_import(
    payload: GitHubImportRequest,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    if not profile.github_login:
        raise HTTPException(
            status_code=400,
            detail="本機 profile 無 GitHub 使用者，請先在 sidebar 加入 GitHub username",
        )

    for tag_id in payload.default_tag_ids:
        tag = session.get(Tag, tag_id)
        if not tag or tag.profile_id != profile.id:
            raise HTTPException(status_code=400, detail=f"標籤 #{tag_id} 不存在")

    repos = await _repos_for_profile(session, profile)
    selected = {r["id"]: r for r in repos if r["id"] in payload.repo_ids}
    if len(selected) != len(payload.repo_ids):
        raise HTTPException(status_code=400, detail="部分 repository 不存在或非 public")

    imported_projects: list[dict] = []
    skipped_repos: list[dict] = []
    sync_errors: list[str] = []
    sync_warning: str | None = None
    token = get_github_token(session, profile.id)
    access_token = token.access_token if token else None

    for repo_id in payload.repo_ids:
        repo = selected[repo_id]
        summary = repo_to_summary(repo)
        existing = session.exec(
            select(Project).where(
                Project.profile_id == profile.id,
                Project.github_repo_id == repo_id,
            )
        ).first()
        if existing:
            skipped_repos.append(summary)
            continue

        created_at = repo["created_at"]
        updated_at = repo["updated_at"]
        start_date = created_at[:10]
        end_date = updated_at[:10] if repo.get("archived") else None
        dates = activity_for_project(start_date, end_date, created_at, updated_at)

        project = Project(
            profile_id=profile.id,
            name=repo["name"],
            description=repo.get("description"),
            start_date=start_date,
            end_date=end_date,
            created_at=created_at,
            updated_at=updated_at,
            activity_dates=dump_activity_dates(dates),
            github_repo_id=repo_id,
            github_full_name=repo["full_name"],
        )
        session.add(project)
        session.commit()
        session.refresh(project)

        owner, name = repo["full_name"].split("/", 1)
        try:
            raw_languages = await fetch_repo_languages(owner, name, access_token)
            lang_names = language_names_above_threshold(raw_languages)
            lang_tag_ids = resolve_language_tag_ids(session, profile.id, lang_names)
        except HTTPException:
            lang_tag_ids = []
        merged_tag_ids = list(dict.fromkeys(payload.default_tag_ids + lang_tag_ids))
        set_project_tags(session, project.id, merged_tag_ids)
        session.commit()
        imported_projects.append(project_to_dict(session, project))

    if imported_projects:
        imported_ids = [p["id"] for p in imported_projects]
        sync_result = await sync_profile_github_activity(
            session,
            profile,
            force=True,
            project_ids=imported_ids,
        )
        sync_errors = sync_result.get("errors") or []
        if sync_errors:
            sync_warning = "；".join(sync_errors[:3])
            if len(sync_errors) > 3:
                sync_warning += f"（另有 {len(sync_errors) - 3} 項錯誤）"
        elif sync_result.get("synced", 0) == 0 and not sync_result.get("skipped"):
            sync_warning = "GitHub 活動同步未寫入任何 commit 日期"

    return GitHubImportResult(
        imported=len(imported_projects),
        skipped=len(skipped_repos),
        projects=[ProjectRead(**p) for p in imported_projects],
        skipped_repos=[GitHubRepoRead(**r) for r in skipped_repos],
        sync_errors=sync_errors,
        sync_warning=sync_warning,
    )
