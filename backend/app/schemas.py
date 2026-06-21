from typing import Optional

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class TagRead(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    start_date: str
    end_date: Optional[str] = None
    tag_ids: list[int] = Field(..., min_length=1)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    tag_ids: Optional[list[int]] = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    tag_ids: list[int]
    created_at: str
    updated_at: str
    activity_dates: list[str]
    github_repo_id: Optional[int] = None
    github_full_name: Optional[str] = None


class TagDeleteOptions(BaseModel):
    reassignToParent: bool = False


class ReportGenerateRequest(BaseModel):
    direction_id: str


class ProfileRead(BaseModel):
    id: int
    github_login: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    created_at: str
    has_token: bool = False


class ProfileFromGitHubRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=39)


class GitHubStatus(BaseModel):
    connected: bool
    login: Optional[str] = None
    profile_id: Optional[int] = None
    public_only: bool = False


class GitHubLoginResponse(BaseModel):
    authorize_url: str


class GitHubRepoRead(BaseModel):
    id: int
    name: str
    full_name: str
    description: Optional[str] = None
    created_at: str
    updated_at: str
    html_url: str
    private: bool


class GitHubImportRequest(BaseModel):
    repo_ids: list[int] = Field(..., min_length=1)
    default_tag_ids: list[int] = Field(default_factory=list)


class GitHubImportResult(BaseModel):
    imported: int
    skipped: int
    projects: list[ProjectRead]
    skipped_repos: list[GitHubRepoRead]
    sync_errors: list[str] = Field(default_factory=list)
    sync_warning: Optional[str] = None


class GitHubSyncResult(BaseModel):
    synced: int
    skipped: bool = False
    reason: Optional[str] = None
    errors: list[str] = Field(default_factory=list)
    synced_at: Optional[str] = None
