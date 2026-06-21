from sqlmodel import Session, select

from app.migrate import get_or_create_local_profile
from app.models import Profile, Project, ProjectTag, Tag
from app.services.project_helpers import set_project_tags
from app.utils import activity_for_project, dump_activity_dates, utc_now_iso

MOCK_TAGS = [
    {"name": "Embedded", "parent_id": None},
    {"name": "STM32", "parent_id": 1},
    {"name": "HAL", "parent_id": 2},
    {"name": "FreeRTOS", "parent_id": 1},
    {"name": "MQTT", "parent_id": 1},
    {"name": "Backend", "parent_id": None},
    {"name": "Python", "parent_id": 6},
    {"name": "FastAPI", "parent_id": 7},
    {"name": "Node.js", "parent_id": 6},
    {"name": "Spring", "parent_id": 6},
    {"name": "Database", "parent_id": 6},
    {"name": "REST API", "parent_id": 6},
    {"name": "Frontend", "parent_id": None},
    {"name": "React", "parent_id": 13},
    {"name": "D3.js", "parent_id": 13},
]

BASE_PROJECTS = [
    {
        "name": "Embedded Final Project",
        "description": "STM32 期末實作，整合 HAL 驅動、UART 與多顆感測器",
        "start": "2023-03-10",
        "end": "2023-06-25",
        "tag_ids": [1, 2, 3],
        "weight": 1.2,
    },
    {
        "name": "IoT Weather Station",
        "description": "基於 STM32 + FreeRTOS 的天氣監控站，透過 MQTT 上傳資料",
        "start": "2023-04-15",
        "end": "2023-09-20",
        "tag_ids": [1, 2, 4, 5],
        "weight": 1.0,
    },
    {
        "name": "Python REST API Lab",
        "description": "FastAPI 課程實驗，CRUD + JWT 驗證 + 自動文件",
        "start": "2023-09-05",
        "end": "2023-12-15",
        "tag_ids": [6, 7, 8, 12],
        "weight": 0.9,
    },
    {
        "name": "PTES Backend",
        "description": "以 FastAPI + SQLite 建立個人技術棧紀錄 API",
        "start": "2026-02-01",
        "end": None,
        "tag_ids": [6, 7, 8, 11, 12],
        "weight": 1.5,
    },
    {
        "name": "Tech Heatmap UI",
        "description": "React SPA 視覺化技能熱點圖與標籤樹",
        "start": "2026-03-10",
        "end": None,
        "tag_ids": [13, 14, 15],
        "weight": 1.4,
    },
]

DEMO_PROFILES = [
    {
        "github_login": "demo-user",
        "display_name": "demo-user",
        "tags": [
            {"name": "Frontend", "parent_id": None},
            {"name": "React", "parent_id": 1},
            {"name": "Backend", "parent_id": None},
            {"name": "FastAPI", "parent_id": 3},
        ],
        "projects": [
            {
                "name": "PTES Demo App",
                "description": "React demo for PTES",
                "start": "2025-06-01",
                "end": None,
                "tag_ids": [1, 2],
            },
        ],
    },
    {
        "github_login": "alice-dev",
        "display_name": "alice-dev",
        "tags": [
            {"name": "Embedded", "parent_id": None},
            {"name": "STM32", "parent_id": 1},
            {"name": "MQTT", "parent_id": 1},
        ],
        "projects": [
            {
                "name": "Sensor Firmware",
                "description": "STM32 sensor node with MQTT",
                "start": "2024-08-01",
                "end": "2025-02-01",
                "tag_ids": [1, 2, 3],
            },
        ],
    },
]


def _seed_tags_for_profile(session: Session, profile_id: int, tag_defs: list[dict]) -> dict[str, int]:
    tag_id_by_name: dict[str, int] = {}
    for item in tag_defs:
        parent_id = None
        if item["parent_id"] is not None:
            parent_name = tag_defs[item["parent_id"] - 1]["name"]
            parent_id = tag_id_by_name[parent_name]
        tag = Tag(name=item["name"], parent_id=parent_id, profile_id=profile_id)
        session.add(tag)
        session.commit()
        session.refresh(tag)
        tag_id_by_name[item["name"]] = tag.id
    return tag_id_by_name


def seed_if_empty(session: Session) -> None:
    local = get_or_create_local_profile(session)
    if session.exec(select(Tag).where(Tag.profile_id == local.id)).first():
        return

    tag_id_by_name = _seed_tags_for_profile(session, local.id, MOCK_TAGS)

    for i, p in enumerate(BASE_PROJECTS):
        created = f"{p['start']}T08:00:00Z"
        updated = (p["end"] or "2026-05-03") + "T17:00:00Z"
        dates = activity_for_project(
            p["start"], p["end"], created, updated, seed=1000 + i * 137
        )
        resolved_tag_ids = [tag_id_by_name[MOCK_TAGS[t - 1]["name"]] for t in p["tag_ids"]]
        project = Project(
            profile_id=local.id,
            name=p["name"],
            description=p["description"],
            start_date=p["start"],
            end_date=p["end"],
            created_at=created,
            updated_at=updated,
            activity_dates=dump_activity_dates(dates),
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        set_project_tags(session, project.id, resolved_tag_ids)
        session.commit()

    for demo in DEMO_PROFILES:
        existing = session.exec(
            select(Profile).where(Profile.github_login == demo["github_login"])
        ).first()
        if existing:
            continue
        profile = Profile(
            github_login=demo["github_login"],
            display_name=demo["display_name"],
            created_at=utc_now_iso(),
        )
        session.add(profile)
        session.commit()
        session.refresh(profile)
        demo_tag_map = _seed_tags_for_profile(session, profile.id, demo["tags"])
        for j, p in enumerate(demo["projects"]):
            created = f"{p['start']}T08:00:00Z"
            updated = (p.get("end") or "2026-05-03") + "T17:00:00Z"
            dates = activity_for_project(
                p["start"], p.get("end"), created, updated, seed=2000 + j * 53
            )
            resolved = [demo_tag_map[demo["tags"][t - 1]["name"]] for t in p["tag_ids"]]
            project = Project(
                profile_id=profile.id,
                name=p["name"],
                description=p["description"],
                start_date=p["start"],
                end_date=p.get("end"),
                created_at=created,
                updated_at=updated,
                activity_dates=dump_activity_dates(dates),
            )
            session.add(project)
            session.commit()
            session.refresh(project)
            set_project_tags(session, project.id, resolved)
            session.commit()
