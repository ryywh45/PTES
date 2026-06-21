"""TSGS test cases (Technical Summary Generation Subsystem)."""


def _seed_direction_tags(client, headers, profile, session):
    from app.models import Tag

    tag_defs = [
        ("Embedded", None),
        ("STM32", "Embedded"),
        ("FreeRTOS", "Embedded"),
        ("MQTT", "Embedded"),
        ("Backend", None),
        ("Node.js", "Backend"),
        ("Spring", "Backend"),
        ("Database", "Backend"),
        ("REST API", "Backend"),
    ]
    by_name: dict[str, int] = {}
    for name, parent_name in tag_defs:
        parent_id = by_name[parent_name] if parent_name else None
        tag = Tag(name=name, parent_id=parent_id, profile_id=profile.id)
        session.add(tag)
        session.commit()
        session.refresh(tag)
        by_name[name] = tag.id
    return by_name


def _create_project(client, headers, name, tag_ids, description="desc"):
    return client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": description,
            "start_date": "2023-06-01",
            "tag_ids": tag_ids,
        },
        headers=headers,
    )


def test_tsgs_tc01_generate_report(client, headers, profile, session):
    """TSGS-TC01: 技術總結報告產生"""
    tags = _seed_direction_tags(client, headers, profile, session)
    _create_project(
        client, headers, "IoT Node", [tags["STM32"], tags["MQTT"]], "STM32 MQTT node"
    )

    res = client.post(
        "/api/reports/generate",
        json={"direction_id": "firmware"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "template"
    md = body["markdown"]
    assert "## 概述" in md
    assert "## 關鍵技術" in md
    assert "## 詳細專案描述" in md
    assert body["project_count"] >= 1


def test_tsgs_tc02_direction_filter(client, headers, profile, session):
    """TSGS-TC02: 報告方向篩選與交叉驗證"""
    tags = _seed_direction_tags(client, headers, profile, session)

    _create_project(client, headers, "Firmware Work", [tags["STM32"]])
    _create_project(client, headers, "API Service", [tags["Node.js"], tags["REST API"]])

    firmware = client.post(
        "/api/reports/generate",
        json={"direction_id": "firmware"},
        headers=headers,
    ).json()
    backend = client.post(
        "/api/reports/generate",
        json={"direction_id": "backend"},
        headers=headers,
    ).json()

    firmware_names = {p["name"] for p in firmware["projects"]}
    backend_names = {p["name"] for p in backend["projects"]}

    assert "Firmware Work" in firmware_names
    assert "API Service" not in firmware_names
    assert "API Service" in backend_names
    assert "Firmware Work" not in backend_names
