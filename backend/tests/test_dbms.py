"""DBMS test cases (Database Management Subsystem)."""

from sqlmodel import Session, create_engine, select

from app.models import Profile, Project, Tag


def test_dbms_tc01_persistence(client, headers, root_tag, db_url):
    """DBMS-TC01: 資料持久化寫入驗證"""
    payload = {
        "name": "Persisted Project",
        "description": "Should survive restart",
        "start_date": "2024-05-01",
        "tag_ids": [root_tag.id],
    }
    res = client.post("/api/v1/projects", json=payload, headers=headers)
    assert res.status_code == 201
    project_id = res.json()["id"]

    tag_res = client.post(
        "/api/tags", json={"name": "PersistTag"}, headers=headers
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    with Session(engine) as session:
        project = session.get(Project, project_id)
        tag = session.get(Tag, tag_id)
        assert project is not None
        assert project.name == "Persisted Project"
        assert tag is not None
        assert tag.name == "PersistTag"
        assert session.exec(select(Profile)).first() is not None


def test_dbms_tc02_validation_errors(client, headers, root_tag):
    """DBMS-TC02: 資料驗證錯誤"""
    empty_name = client.post(
        "/api/v1/projects",
        json={
            "name": "",
            "start_date": "2024-01-01",
            "tag_ids": [root_tag.id],
        },
        headers=headers,
    )
    assert empty_name.status_code == 422

    long_name = client.post(
        "/api/v1/projects",
        json={
            "name": "n" * 201,
            "start_date": "2024-01-01",
            "tag_ids": [root_tag.id],
        },
        headers=headers,
    )
    assert long_name.status_code == 422

    no_tags = client.post(
        "/api/v1/projects",
        json={
            "name": "No Tags",
            "start_date": "2024-01-01",
            "tag_ids": [],
        },
        headers=headers,
    )
    assert no_tags.status_code == 422

    missing_header = client.get("/api/v1/projects")
    assert missing_header.status_code == 400

    bad_profile = client.get(
        "/api/v1/projects", headers={"X-PTES-Profile-Id": "99999"}
    )
    assert bad_profile.status_code == 404
