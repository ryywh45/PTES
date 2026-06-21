from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_active_profile
from app.models import Profile, Project
from app.services.project_helpers import expand_tag_ids, project_to_dict
from app.utils import build_heatmap

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])


@router.get("")
def get_heatmap(
    tag_ids: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    projects = session.exec(
        select(Project).where(Project.profile_id == profile.id)
    ).all()
    scope = [project_to_dict(session, p) for p in projects]

    if tag_ids:
        ids = [int(x) for x in tag_ids.split(",") if x.strip()]
        expanded = expand_tag_ids(session, ids, profile.id)
        scope = [p for p in scope if any(t in expanded for t in p["tag_ids"])]

    to_date = datetime.strptime(to, "%Y-%m-%d") if to else datetime.utcnow()
    if from_:
        from_date = datetime.strptime(from_, "%Y-%m-%d")
    else:
        from_date = to_date - timedelta(days=364)
    return build_heatmap(scope, from_date, to_date)
