from sqlmodel import Session, select

from app.models import Tag

LANGUAGES_PARENT_NAME = "Languages"


def get_or_create_languages_parent(session: Session, profile_id: int) -> int:
    tags = session.exec(select(Tag).where(Tag.profile_id == profile_id)).all()
    for tag in tags:
        if tag.parent_id is None and tag.name.lower() == LANGUAGES_PARENT_NAME.lower():
            assert tag.id is not None
            return tag.id

    parent = Tag(name=LANGUAGES_PARENT_NAME, parent_id=None, profile_id=profile_id)
    session.add(parent)
    session.commit()
    session.refresh(parent)
    assert parent.id is not None
    return parent.id


def resolve_language_tag_ids(
    session: Session,
    profile_id: int,
    language_names: list[str],
) -> list[int]:
    if not language_names:
        return []

    tags = session.exec(select(Tag).where(Tag.profile_id == profile_id)).all()
    by_name_lower = {tag.name.lower(): tag for tag in tags}
    resolved: list[int] = []
    seen: set[int] = set()

    for language_name in language_names:
        existing = by_name_lower.get(language_name.lower())
        if existing and existing.id is not None:
            if existing.id not in seen:
                resolved.append(existing.id)
                seen.add(existing.id)
            continue

        parent_id = get_or_create_languages_parent(session, profile_id)
        tag = Tag(name=language_name, parent_id=parent_id, profile_id=profile_id)
        session.add(tag)
        session.commit()
        session.refresh(tag)
        assert tag.id is not None
        by_name_lower[tag.name.lower()] = tag
        if tag.id not in seen:
            resolved.append(tag.id)
            seen.add(tag.id)

    return resolved
