from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_active_profile
from app.models import Profile, ProjectTag, Tag
from app.schemas import TagCreate, TagDeleteOptions, TagRead, TagUpdate
from app.services.project_helpers import collect_subtree

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
def list_tags(
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(Tag).where(Tag.profile_id == profile.id).order_by(Tag.id)
    ).all()


@router.post("", response_model=TagRead, status_code=201)
def create_tag(
    payload: TagCreate,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    if payload.parent_id is not None:
        parent = session.get(Tag, payload.parent_id)
        if not parent or parent.profile_id != profile.id:
            raise HTTPException(status_code=400, detail="父標籤不存在")
    tag = Tag(name=payload.name.strip(), parent_id=payload.parent_id, profile_id=profile.id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagRead)
def update_tag(
    tag_id: int,
    payload: TagUpdate,
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    tag = session.get(Tag, tag_id)
    if not tag or tag.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    if payload.parent_id is not None:
        parent = session.get(Tag, payload.parent_id)
        if not parent or parent.profile_id != profile.id:
            raise HTTPException(status_code=400, detail="父標籤不存在")
    if payload.name is not None:
        tag.name = payload.name.strip()
    if "parent_id" in payload.model_dump(exclude_unset=True):
        tag.parent_id = payload.parent_id
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/{tag_id}")
def delete_tag(
    tag_id: int,
    options: TagDeleteOptions = Body(default=TagDeleteOptions()),
    profile: Profile = Depends(get_active_profile),
    session: Session = Depends(get_session),
):
    tag = session.get(Tag, tag_id)
    if not tag or tag.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Tag not found")

    opts = options
    if opts.reassignToParent:
        children = session.exec(
            select(Tag).where(Tag.parent_id == tag_id, Tag.profile_id == profile.id)
        ).all()
        for child in children:
            child.parent_id = tag.parent_id
            session.add(child)
    else:
        subtree = collect_subtree(session, tag_id, profile.id)
        for tid in subtree:
            if tid == tag_id:
                continue
            child = session.get(Tag, tid)
            if child:
                session.delete(child)
        for tid in subtree:
            links = session.exec(select(ProjectTag).where(ProjectTag.tag_id == tid)).all()
            for link in links:
                session.delete(link)

    links = session.exec(select(ProjectTag).where(ProjectTag.tag_id == tag_id)).all()
    for link in links:
        session.delete(link)
    session.delete(tag)
    session.commit()
    return {"ok": True}
