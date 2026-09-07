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
    created_at: datetime
    updated_at: datetime
