"""Unit tests for core visualization utilities (NFR-10)."""

from datetime import datetime

from sqlmodel import Session, select

from app.models import Tag
from app.services.project_helpers import collect_subtree, expand_tag_ids
from app.utils import build_heatmap, start_of_week


def test_start_of_week_monday():
    wed = datetime(2024, 3, 6)
    mon = start_of_week(wed)
    assert mon.weekday() == 0
    assert mon.strftime("%Y-%m-%d") == "2024-03-04"


def test_build_heatmap_aggregates_by_week():
    from_date = datetime(2024, 1, 1)
    to_date = datetime(2024, 1, 31)
    projects = [
        {"id": 1, "activity_dates": ["2024-01-02", "2024-01-03"]},
        {"id": 2, "activity_dates": ["2024-01-02"]},
    ]
    cells = build_heatmap(projects, from_date, to_date)
    assert len(cells) >= 4
    week_with_activity = next(c for c in cells if c["count"] > 0)
    assert 1 in week_with_activity["project_ids"]
    assert 2 in week_with_activity["project_ids"]
    assert week_with_activity["count"] == 3


def test_expand_tag_ids_includes_subtree(session, profile):
    root = Tag(name="Root", parent_id=None, profile_id=profile.id)
    session.add(root)
    session.commit()
    session.refresh(root)

    child = Tag(name="Child", parent_id=root.id, profile_id=profile.id)
    session.add(child)
    session.commit()
    session.refresh(child)

    grand = Tag(name="Grand", parent_id=child.id, profile_id=profile.id)
    session.add(grand)
    session.commit()
    session.refresh(grand)

    expanded = expand_tag_ids(session, [root.id], profile.id)
    assert expanded == sorted([root.id, child.id, grand.id])

    subtree = collect_subtree(session, child.id, profile.id)
    assert set(subtree) == {child.id, grand.id}

    tags = session.exec(select(Tag).where(Tag.profile_id == profile.id)).all()
    assert len(tags) >= 3
