# ABOUTME: Pydantic schemas for AcceptanceCriteria resources.
# ABOUTME: Defines create and read shapes for BDD acceptance criteria.

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class ACCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Acceptance criteria content cannot be empty")
        return v.strip()


class ACRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    content: str
    analysis_result: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime
