from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.migrate import get_or_create_github_profile
from app.models import GitHubToken, Profile, Tag
from app.schemas import ProfileFromGitHubRequest, ProfileRead
from app.services.github import fetch_public_user
from app.services.project_helpers import delete_profile_cascade

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


def profile_to_read(profile: Profile, has_token: bool) -> ProfileRead:
    return ProfileRead(
        id=profile.id,
        github_login=profile.github_login,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
        has_token=has_token,
    )


@router.get("", response_model=list[ProfileRead])
def list_profiles(session: Session = Depends(get_session)):
    profiles = session.exec(select(Profile).order_by(Profile.id)).all()
    tokens = {t.profile_id: t for t in session.exec(select(GitHubToken)).all()}
    return [profile_to_read(p, p.id in tokens) for p in profiles]


@router.post("/from-github", response_model=ProfileRead, status_code=201)
async def create_profile_from_github(
    payload: ProfileFromGitHubRequest,
    session: Session = Depends(get_session),
):
    user = await fetch_public_user(payload.username.strip())
    login = user.get("login")
    if not login:
        raise HTTPException(status_code=502, detail="GitHub 回傳資料不完整")

    display_name = user.get("name") or login
    avatar_url = user.get("avatar_url")
    profile, is_new = get_or_create_github_profile(
        session,
        github_login=login,
        display_name=display_name,
        avatar_url=avatar_url,
    )

    if is_new:
        tag = Tag(name="GitHub", parent_id=None, profile_id=profile.id)
        session.add(tag)
        session.commit()

    token = session.exec(
        select(GitHubToken).where(GitHubToken.profile_id == profile.id)
    ).first()
    return profile_to_read(profile, token is not None)


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, session: Session = Depends(get_session)):
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile 不存在")
    delete_profile_cascade(session, profile)
    return {"ok": True}
