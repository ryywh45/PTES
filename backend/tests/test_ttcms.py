"""TTCMS test cases (Tech Tag Classification Management Subsystem)."""


def test_ttcms_tc01_hierarchical_tags(client, headers):
    """TTCMS-TC01: 建立多層級標籤"""
    embedded = client.post(
        "/api/tags", json={"name": "Embedded"}, headers=headers
    )
    assert embedded.status_code == 201
    embedded_id = embedded.json()["id"]

    stm32 = client.post(
        "/api/tags",
        json={"name": "STM32", "parent_id": embedded_id},
        headers=headers,
    )
    assert stm32.status_code == 201
    assert stm32.json()["parent_id"] == embedded_id

    tags = client.get("/api/tags", headers=headers).json()
    by_name = {t["name"]: t for t in tags}
    assert by_name["Embedded"]["parent_id"] is None
    assert by_name["STM32"]["parent_id"] == embedded_id


def test_ttcms_tc02_delete_tag_reassign(client, headers, profile, session):
    """TTCMS-TC02: 刪除標籤與重新分配子標籤"""
    embedded = client.post(
        "/api/tags", json={"name": "Embedded"}, headers=headers
    ).json()
    stm32 = client.post(
        "/api/tags",
        json={"name": "STM32", "parent_id": embedded["id"]},
        headers=headers,
    ).json()
    hal = client.post(
        "/api/tags",
        json={"name": "HAL", "parent_id": stm32["id"]},
        headers=headers,
    ).json()

    project = client.post(
        "/api/v1/projects",
        json={
            "name": "Sensor Node",
            "description": "STM32 sensor",
            "start_date": "2024-01-01",
            "tag_ids": [stm32["id"]],
        },
        headers=headers,
    ).json()

    res = client.request(
        "DELETE",
        f"/api/tags/{stm32['id']}",
        json={"reassignToParent": True},
        headers=headers,
    )
    assert res.status_code == 200

    tags = client.get("/api/tags", headers=headers).json()
    by_id = {t["id"]: t for t in tags}
    assert stm32["id"] not in by_id
    assert by_id[hal["id"]]["parent_id"] == embedded["id"]

    updated = client.get(f"/api/v1/projects/{project['id']}", headers=headers).json()
    assert embedded["id"] in updated["tag_ids"]
    assert stm32["id"] not in updated["tag_ids"]
