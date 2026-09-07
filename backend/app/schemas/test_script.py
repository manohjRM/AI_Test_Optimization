# ABOUTME: Pydantic schemas for the TestScript resource.
# ABOUTME: Defines create, update, and read shapes used by the API layer.

import uuid
from datetime import datetime

from pydantic import BaseModel


class TestScriptCreate(BaseModel):
    name: str
    description: str | None = None
    content: str
    framework: str = "pytest"
    language: str = "python"


class TestScriptUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    framework: str | None = None
    language: str | None = None


class TestScriptRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    content: str
    framework: str
    language: str
    created_at: datetime
    updated_at: datetime
