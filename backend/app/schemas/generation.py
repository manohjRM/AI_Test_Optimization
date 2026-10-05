# ABOUTME: Pydantic schemas for test script generation and modification.
# ABOUTME: Defines requests, responses, and the generated script read shape.

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class GenerateModifyRequest(BaseModel):
    ac_id: uuid.UUID
    file_path: str
    test_name: str
    modifications_needed: list[str]


class GenerateNewRequest(BaseModel):
    ac_id: uuid.UUID
    scenario_name: str
    scenario_type: str
    description: str
    steps: list[str]
    priority: str
    suggested_file: str


class GeneratedScriptRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    ac_id: uuid.UUID
    action: str
    status: str
    file_path: str
    source_item: dict[str, Any]
    original_content: str | None
    generated_content: str
    created_at: datetime
    updated_at: datetime


class ApplyScriptResponse(BaseModel):
    success: bool
    file_path: str
    message: str
