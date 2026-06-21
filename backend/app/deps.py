from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.models import Profile


def get_active_profile(
    x_ptes_profile_id: str | None = Header(default=None, alias="X-PTES-Profile-Id"),
    session: Session = Depends(get_session),
) -> Profile:
    if not x_ptes_profile_id:
        raise HTTPException(status_code=400, detail="缺少 X-PTES-Profile-Id header")
    try:
        profile_id = int(x_ptes_profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="無效的 profile id") from exc
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile 不存在")
    return profile


def get_optional_profile(
    x_ptes_profile_id: str | None = Header(default=None, alias="X-PTES-Profile-Id"),
    session: Session = Depends(get_session),
) -> Profile | None:
    if not x_ptes_profile_id:
        return None
    try:
        profile_id = int(x_ptes_profile_id)
    except ValueError:
        return None
    return session.get(Profile, profile_id)
