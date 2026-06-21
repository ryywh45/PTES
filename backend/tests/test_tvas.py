"""TVAS test cases (Technical Visualization Analysis Subsystem)."""

from datetime import datetime, timedelta

from app.utils import dump_activity_dates


def _create_project(client, headers, tag_ids, name, activity_dates, start_date="2024-01-01"):
    return client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "heatmap test",
            "start_date": start_date,
            "tag_ids": tag_ids,
        },
        headers=headers,
    )


def test_tvas_tc01_weekly_heatmap(client, headers, root_tag, session):
    """TVAS-TC01: 熱力圖每週視覺化呈現"""
    from app.models import Project

    project = _create_project(
        client, headers, [root_tag.id], "Active Project", []
    ).json()

    today = datetime.utcnow().date()
    dates = [(today - timedelta(days=i * 7)).strftime("%Y-%m-%d") for i in range(5)]
    proj = session.get(Project, project["id"])
    proj.activity_dates = dump_activity_dates(dates)
    session.add(proj)
    session.commit()

    res = client.get("/api/heatmap", headers=headers)
    assert res.status_code == 200
    cells = res.json()
    assert 52 <= len(cells) <= 54

    for cell in cells:
        assert "week_start" in cell
        assert "week_index" in cell
        assert "count" in cell
        assert "project_ids" in cell

    assert cells[0]["week_index"] == 1
    total_activity = sum(c["count"] for c in cells)
    assert total_activity >= len(dates)


def test_tvas_tc02_tag_filter(client, headers, profile, root_tag, session):
    """TVAS-TC02: 熱力圖標籤篩選功能"""
    from app.models import Project, Tag

    embedded = Tag(name="Embedded", parent_id=None, profile_id=profile.id)
    session.add(embedded)
    session.commit()
    session.refresh(embedded)

    stm32 = Tag(name="STM32", parent_id=embedded.id, profile_id=profile.id)
    session.add(stm32)
    session.commit()
    session.refresh(stm32)

    embedded_proj = _create_project(
        client, headers, [stm32.id], "Embedded Proj", []
    ).json()
    other_proj = _create_project(
        client, headers, [root_tag.id], "Other Proj", []
    ).json()

    today = datetime.utcnow().strftime("%Y-%m-%d")
    for pid in (embedded_proj["id"], other_proj["id"]):
        proj = session.get(Project, pid)
        proj.activity_dates = dump_activity_dates([today])
        session.add(proj)
    session.commit()

    filtered = client.get(
        "/api/heatmap", params={"tag_ids": str(embedded.id)}, headers=headers
    ).json()
    unfiltered = client.get("/api/heatmap", headers=headers).json()

    def project_ids_in_cells(cells):
        ids: set[int] = set()
        for c in cells:
            ids.update(c.get("project_ids") or [])
        return ids

    filtered_ids = project_ids_in_cells(filtered)
    assert embedded_proj["id"] in filtered_ids
    assert other_proj["id"] not in filtered_ids

    all_ids = project_ids_in_cells(unfiltered)
    assert embedded_proj["id"] in all_ids
    assert other_proj["id"] in all_ids
