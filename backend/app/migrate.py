from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, select

from app.database import engine, init_db
from app.models import Profile
from app.utils import utc_now_iso

LOCAL_PROFILE_NAME = "本機示範"


def ensure_schema() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    needs_recreate = "profile" not in tables
    if "profile" in tables:
        profile_cols = {c["name"] for c in inspector.get_columns("profile")}
        if "avatar_url" not in profile_cols:
            needs_recreate = True
    if "project" in tables:
        cols = {c["name"] for c in inspector.get_columns("project")}
        if "profile_id" not in cols:
            needs_recreate = True
    if needs_recreate and tables:
        SQLModel.metadata.drop_all(engine)
    init_db()

    inspector = inspect(engine)
    if "profile" in inspector.get_table_names():
        profile_cols = {c["name"] for c in inspector.get_columns("profile")}
        if "github_activity_synced_at" not in profile_cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE profile ADD COLUMN github_activity_synced_at VARCHAR")
                )


def get_or_create_local_profile(session: Session) -> Profile:
    profile = session.exec(
        select(Profile).where(Profile.github_login.is_(None))
    ).first()
    if profile:
        return profile
    profile = Profile(
        github_login=None,
        display_name=LOCAL_PROFILE_NAME,
        created_at=utc_now_iso(),
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def get_profile_by_login(session: Session, github_login: str) -> Profile | None:
    return session.exec(
        select(Profile).where(Profile.github_login == github_login)
    ).first()


def get_or_create_github_profile(
    session: Session,
    github_login: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> tuple[Profile, bool]:
    profile = get_profile_by_login(session, github_login)
    if profile:
        changed = False
        if display_name and profile.display_name != display_name:
            profile.display_name = display_name
            changed = True
        if avatar_url and profile.avatar_url != avatar_url:
            profile.avatar_url = avatar_url
            changed = True
        if changed:
            session.add(profile)
            session.commit()
            session.refresh(profile)
        return profile, False
    profile = Profile(
        github_login=github_login,
        display_name=display_name or github_login,
        avatar_url=avatar_url,
        created_at=utc_now_iso(),
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile, True
