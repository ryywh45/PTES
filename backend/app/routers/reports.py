from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import GEMINI_MODEL
from app.database import get_session
from app.deps import get_active_profile
from app.models import Profile, Project, Tag
from app.schemas import ReportGenerateRequest
from app.services.ai_report import generate_markdown_report, is_ai_available
from app.services.project_helpers import expand_tag_ids, project_to_dict

router = APIRouter(prefix="/api/reports", tags=["reports"])

CAREER_DIRECTIONS = [
    {
        "id": "firmware",
        "label": "韌體工程師",
        "tags": ["STM32", "FreeRTOS", "MQTT", "Embedded"],
    },
    {
        "id": "backend",
        "label": "後端軟體架構師",
        "tags": ["Node.js", "Spring", "Database", "REST API"],
    },
    {
        "id": "frontend",
        "label": "前端工程師",
        "tags": ["React", "D3.js", "Frontend"],
    },
]


def _collect_report_context(
    session: Session,
    profile: Profile,
    direction: dict,
) -> dict:
    tags = session.exec(select(Tag).where(Tag.profile_id == profile.id)).all()
    tag_map = {t.id: t.name for t in tags}
    target_tag_ids = [t.id for t in tags if t.name in direction["tags"]]
    expanded = expand_tag_ids(session, target_tag_ids, profile.id)

    projects = session.exec(
        select(Project).where(Project.profile_id == profile.id)
    ).all()
    matched = [
        project_to_dict(session, p)
        for p in projects
        if any(t in expanded for t in project_to_dict(session, p)["tag_ids"])
    ]
    matched.sort(key=lambda p: p["start_date"], reverse=True)

    def tag_names(ids: list[int]) -> list[str]:
        return [tag_map[i] for i in ids if i in tag_map]

    return {
        "direction": direction,
        "matched": matched,
        "tag_map": tag_map,
        "tag_names": tag_names,
    }


def _generate_template_markdown(context: dict) -> str:
    direction = context["direction"]
    matched = context["matched"]
    tag_names = context["tag_names"]

    md_lines = [
        f"# 技術總結 — {direction['label']}",
        "",
        "## 概述",
        f"本總結針對「{direction['label']}」方向，彙整與 {'、'.join(direction['tags'])} 相關之專案經歷。共納入 {len(matched)} 個專案。",
        "",
        "## 關鍵技術",
        *[f"- {t}" for t in direction["tags"]],
        "",
        "## 詳細專案描述",
    ]
    for p in matched:
        period = f"{p['start_date']} ~ {p['end_date'] or '進行中'}"
        md_lines.extend(
            [
                f"### {p['name']}",
                f"- 期間：{period}",
                f"- 技術：{'、'.join(tag_names(p['tag_ids']))}",
                f"- 描述：{p['description'] or ''}",
                "",
            ]
        )
    md_lines.extend(
        [
            "## 結語",
            f"以上 {len(matched)} 個專案展現本人在「{direction['label']}」方向之累積與發展。",
        ]
    )
    return "\n".join(md_lines)


@router.get("/directions")
def get_directions():
    return CAREER_DIRECTIONS


@router.get("/status")
def get_report_status():
    return {
        "ai_available": is_ai_available(),
        "model": GEMINI_MODEL if is_ai_available() else None,
    }


@router.post("/generate")
def generate_report(
    payload: ReportGenerateRequest,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    direction = next((d for d in CAREER_DIRECTIONS if d["id"] == payload.direction_id), None)
    if not direction:
        raise HTTPException(status_code=400, detail="Unknown direction")

    context = _collect_report_context(session, profile, direction)
    matched = context["matched"]
    warning = None
    source = "template"
    model = None

    if is_ai_available():
        ai_markdown, ai_error, ai_model = generate_markdown_report(context)
        if ai_markdown:
            markdown = ai_markdown
            source = "ai"
            model = ai_model
        else:
            markdown = _generate_template_markdown(context)
            warning = ai_error or "Gemini AI 產生失敗，已改用模板產生"
    else:
        markdown = _generate_template_markdown(context)

    return {
        "markdown": markdown,
        "project_count": len(matched),
        "projects": matched,
        "source": source,
        "model": model,
        "warning": warning,
    }
