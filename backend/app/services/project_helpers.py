from sqlmodel import Session, select

from app.models import GitHubToken, Profile, Project, ProjectTag, Tag


def get_project_tag_ids(session: Session, project_id: int) -> list[int]:
    rows = session.exec(
        select(ProjectTag.tag_id).where(ProjectTag.project_id == project_id)
    ).all()
    return list(rows)


def set_project_tags(session: Session, project_id: int, tag_ids: list[int]) -> None:
    existing = session.exec(
        select(ProjectTag).where(ProjectTag.project_id == project_id)
    ).all()
    for row in existing:
        session.delete(row)
    for tag_id in tag_ids:
        session.add(ProjectTag(project_id=project_id, tag_id=tag_id))


def project_to_dict(session: Session, project: Project) -> dict:
    from app.utils import parse_activity_dates

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "tag_ids": get_project_tag_ids(session, project.id),
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "activity_dates": parse_activity_dates(project.activity_dates),
        "github_repo_id": project.github_repo_id,
        "github_full_name": project.github_full_name,
        "profile_id": project.profile_id,
    }


def collect_subtree(session: Session, root_id: int, profile_id: int) -> list[int]:
    tags = session.exec(select(Tag).where(Tag.profile_id == profile_id)).all()
    out = [root_id]
    queue = [root_id]
    while queue:
        head = queue.pop(0)
        for tag in tags:
            if tag.parent_id == head and tag.id is not None:
                out.append(tag.id)
                queue.append(tag.id)
    return out


def expand_tag_ids(session: Session, ids: list[int], profile_id: int) -> list[int]:
    expanded: set[int] = set()
    for tag_id in ids:
        for x in collect_subtree(session, tag_id, profile_id):
            expanded.add(x)
    return sorted(expanded)


def get_github_token(session: Session, profile_id: int) -> GitHubToken | None:
    return session.exec(
        select(GitHubToken).where(GitHubToken.profile_id == profile_id)
    ).first()


def save_github_token(
    session: Session,
    access_token: str,
    scope: str | None,
    github_login: str | None,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> tuple[Profile, GitHubToken]:
    from app.migrate import get_or_create_github_profile
    from app.utils import utc_now_iso

    if not github_login:
        raise ValueError("github_login is required")

    profile, _is_new = get_or_create_github_profile(
        session,
        github_login=github_login,
        display_name=display_name or github_login,
        avatar_url=avatar_url,
    )
    existing = get_github_token(session, profile.id)
    if existing:
        existing.access_token = access_token
        existing.scope = scope
        existing.github_login = github_login
        existing.updated_at = utc_now_iso()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return profile, existing

    token = GitHubToken(
        profile_id=profile.id,
        access_token=access_token,
        scope=scope,
        github_login=github_login,
        updated_at=utc_now_iso(),
    )
    session.add(token)
    session.commit()
    session.refresh(token)
    return profile, token


def clear_github_token(session: Session, profile_id: int) -> None:
    token = get_github_token(session, profile_id)
    if token:
        session.delete(token)
        session.commit()


def delete_profile_cascade(session: Session, profile: Profile) -> None:
    projects = session.exec(
        select(Project).where(Project.profile_id == profile.id)
    ).all()
    for project in projects:
        links = session.exec(
            select(ProjectTag).where(ProjectTag.project_id == project.id)
        ).all()
        for link in links:
            session.delete(link)
        session.delete(project)

    tags = session.exec(select(Tag).where(Tag.profile_id == profile.id)).all()
    tag_ids = [t.id for t in tags if t.id is not None]
    while tag_ids:
        leaves = [
            tid
            for tid in tag_ids
            if not any(t.parent_id == tid for t in tags if t.id in tag_ids)
        ]
        if not leaves:
            break
        for tid in leaves:
            tag = session.get(Tag, tid)
            if tag:
                session.delete(tag)
            tag_ids.remove(tid)

    token = get_github_token(session, profile.id)
    if token:
        session.delete(token)

    session.delete(profile)
    session.commit()
