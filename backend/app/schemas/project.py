# ABOUTME: Pydantic schemas for the Project resource.
# ABOUTME: Defines create, read, and update shapes used by the API layer.

import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    repo_type: str  # "local" or "github"
    repo_url: str   # local path or GitHub URL
    clone_path: str | None = None  # where to clone GitHub repos locally
    git_token: str | None = None   # PAT for private repos
    force_init_git: bool = False

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()

    @field_validator("repo_type")
    @classmethod
    def valid_repo_type(cls, v: str) -> str:
        if v not in ("local", "github"):
            raise ValueError("repo_type must be 'local' or 'github'")
        return v

    @field_validator("repo_url")
    @classmethod
    def repo_url_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Repository path/URL cannot be empty")
        return v.strip()


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    test_path: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip() if v else v


class ProjectRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    repo_type: str
    repo_url: str
    local_path: str | None
    repo_status: str
    repo_error: str | None
    test_path: str | None
    app_summary: str | None
    created_at: datetime
    updated_at: datetime


class TestFile(BaseModel):
    path: str
    name: str
    tests: list[str]


class TestDirectory(BaseModel):
    directory: str
    files: list[TestFile]


class TestStats(BaseModel):
    total_files: int
    total_tests: int
    frameworks: list[str]
    breakdown: dict[str, int]
    test_directories: list[str]
    test_tree: list[TestDirectory]


class RepoDir(BaseModel):
    name: str
    path: str
    has_children: bool


class RepoDirList(BaseModel):
    dirs: list[RepoDir]
