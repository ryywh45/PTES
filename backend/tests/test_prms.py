"""PRMS test cases (Project Record Management Subsystem)."""


def _project_payload(tag_id: int, **overrides):
    data = {
        "name": "Test Project",
        "description": "A sample project for testing",
        "start_date": "2024-01-15",
        "end_date": "2024-06-30",
        "tag_ids": [tag_id],
    }
    data.update(overrides)
    return data


def test_prms_tc01_create_project(client, headers, root_tag):
    """PRMS-TC01: 新增專案紀錄"""
    payload = _project_payload(root_tag.id, name="IoT Gateway")
    res = client.post("/api/v1/projects", json=payload, headers=headers)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "IoT Gateway"
    assert body["tag_ids"] == [root_tag.id]

    listed = client.get("/api/v1/projects", headers=headers).json()
    names = [p["name"] for p in listed]
    assert "IoT Gateway" in names


def test_prms_tc02_name_too_long(client, headers, root_tag):
    """PRMS-TC02: 專案名稱長度驗證"""
    payload = _project_payload(root_tag.id, name="x" * 201)
    res = client.post("/api/v1/projects", json=payload, headers=headers)
    assert res.status_code == 422

    listed = client.get("/api/v1/projects", headers=headers).json()
    assert all(p["name"] != "x" * 201 for p in listed)


def test_prms_tc03_update_project(client, headers, root_tag):
    """PRMS-TC03: 編輯專案紀錄"""
    created = client.post(
        "/api/v1/projects",
        json=_project_payload(root_tag.id, name="Original Name"),
        headers=headers,
    ).json()

    res = client.put(
        f"/api/v1/projects/{created['id']}",
        json={"name": "Updated Name", "description": "New description"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"
    assert res.json()["description"] == "New description"

    listed = client.get("/api/v1/projects", headers=headers).json()
    match = next(p for p in listed if p["id"] == created["id"])
    assert match["name"] == "Updated Name"


def test_prms_tc04_delete_project(client, headers, root_tag):
    """PRMS-TC04: 刪除專案紀錄"""
    created = client.post(
        "/api/v1/projects",
        json=_project_payload(root_tag.id, name="To Delete"),
        headers=headers,
    ).json()
    project_id = created["id"]

    res = client.delete(f"/api/v1/projects/{project_id}", headers=headers)
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    get_res = client.get(f"/api/v1/projects/{project_id}", headers=headers)
    assert get_res.status_code == 404


def test_prms_tc05_search_and_filter(client, headers, root_tag, profile, session):
    """PRMS-TC05: 搜尋與篩選專案紀錄"""
    from app.models import Tag

    embedded = Tag(name="Embedded", parent_id=None, profile_id=profile.id)
    session.add(embedded)
    session.commit()
    session.refresh(embedded)

    stm32 = Tag(name="STM32", parent_id=embedded.id, profile_id=profile.id)
    session.add(stm32)
    session.commit()
    session.refresh(stm32)

    client.post(
        "/api/v1/projects",
        json=_project_payload(
            stm32.id,
            name="STM32 Firmware",
            description="HAL drivers",
            start_date="2023-03-01",
        ),
        headers=headers,
    )
    client.post(
        "/api/v1/projects",
        json=_project_payload(
            root_tag.id,
            name="Web Dashboard",
            description="React frontend",
            start_date="2024-01-01",
        ),
        headers=headers,
    )

    by_q = client.get("/api/v1/projects", params={"q": "stm32"}, headers=headers).json()
    assert len(by_q) == 1
    assert by_q[0]["name"] == "STM32 Firmware"

    by_tag = client.get(
        "/api/v1/projects", params={"tag_ids": str(embedded.id)}, headers=headers
    ).json()
    assert len(by_tag) == 1
    assert by_tag[0]["name"] == "STM32 Firmware"

    combined = client.get(
        "/api/v1/projects",
        params={"q": "firmware", "tag_ids": str(embedded.id), "from": "2023-01-01", "to": "2023-12-31"},
        headers=headers,
    ).json()
    assert len(combined) == 1
    assert combined[0]["name"] == "STM32 Firmware"
