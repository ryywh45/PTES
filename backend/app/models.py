from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class Profile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    github_login: Optional[str] = Field(default=None, unique=True, index=True)
    display_name: str
    avatar_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    github_activity_synced_at: Optional[str] = None


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    name: str
    parent_id: Optional[int] = Field(default=None, foreign_key="tag.id")


class Project(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("profile_id", "github_repo_id", name="uq_project_profile_repo"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    created_at: str
    updated_at: str
    activity_dates: str = "[]"
    github_repo_id: Optional[int] = Field(default=None, index=True)
    github_full_name: Optional[str] = None


class ProjectTag(SQLModel, table=True):
    project_id: int = Field(foreign_key="project.id", primary_key=True)
    tag_id: int = Field(foreign_key="tag.id", primary_key=True)


class GitHubToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", unique=True, index=True)
    access_token: str
    scope: Optional[str] = None
    github_login: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
