from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_active_profile
from app.models import Profile, Project, ProjectTag, Tag
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project_helpers import (
    expand_tag_ids,
    project_to_dict,
    set_project_tags,
)
from app.utils import (
    activity_for_project,
    dump_activity_dates,
    parse_activity_dates,
    utc_now_iso,
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _validate_dates(start_date: str, end_date: str | None) -> None:
    if end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="結束日期不得早於開始日期")


def _validate_tags(session: Session, tag_ids: list[int], profile_id: int) -> None:
    for tag_id in tag_ids:
        tag = session.get(Tag, tag_id)
        if not tag or tag.profile_id != profile_id:
            raise HTTPException(status_code=400, detail=f"標籤 #{tag_id} 不存在")


@router.get("", response_model=list[ProjectRead])
def list_projects(
    q: str | None = None,
    tag_ids: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    projects = session.exec(
        select(Project)
        .where(Project.profile_id == profile.id)
        .order_by(Project.id.desc())
    ).all()
    out = [project_to_dict(session, p) for p in projects]

    if q:
        needle = q.lower()
        out = [
            p
            for p in out
            if needle in p["name"].lower()
            or needle in (p["description"] or "").lower()
        ]

    if tag_ids:
        ids = [int(x) for x in tag_ids.split(",") if x.strip()]
        expanded = expand_tag_ids(session, ids, profile.id)
        out = [p for p in out if any(t in expanded for t in p["tag_ids"])]

    if from_:
        out = [p for p in out if p["start_date"] >= from_]
    if to:
        out = [p for p in out if p["start_date"] <= to]
    return out


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_to_dict(session, project)


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(
    payload: ProjectCreate,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    _validate_dates(payload.start_date, payload.end_date)
    _validate_tags(session, payload.tag_ids, profile.id)
    now = utc_now_iso()
    dates = activity_for_project(
        payload.start_date, payload.end_date, now, now, seed=hash(payload.name) % 100000
    )
    project = Project(
        profile_id=profile.id,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_at=now,
        updated_at=now,
        activity_dates=dump_activity_dates(dates),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    set_project_tags(session, project.id, payload.tag_ids)
    session.commit()
    return project_to_dict(session, project)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "description" in data and data["description"] is not None:
        data["description"] = data["description"].strip() or None

    start_date = data.get("start_date", project.start_date)
    end_date = data.get("end_date", project.end_date)
    _validate_dates(start_date, end_date)

    for key, value in data.items():
        setattr(project, key, value)

    now = utc_now_iso()
    project.updated_at = now
    existing_dates = parse_activity_dates(project.activity_dates)
    existing_dates.append(now[:10])
    project.activity_dates = dump_activity_dates(existing_dates)

    if tag_ids is not None:
        if len(tag_ids) == 0:
            raise HTTPException(status_code=400, detail="請至少選擇 1 個標籤")
        _validate_tags(session, tag_ids, profile.id)
        set_project_tags(session, project.id, tag_ids)

    session.add(project)
    session.commit()
    session.refresh(project)
    return project_to_dict(session, project)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Project not found")
    for row in session.exec(
        select(ProjectTag).where(ProjectTag.project_id == project_id)
    ).all():
        session.delete(row)
    session.delete(project)
    session.commit()
    return {"ok": True}
