# ABOUTME: Pydantic schemas for the Settings resource.
# ABOUTME: Never exposes the raw API key — only a boolean indicating whether one is set.

from datetime import datetime

from pydantic import BaseModel


class SettingsRead(BaseModel):
    model_config = {"from_attributes": True}

    llm_provider: str
    llm_base_url: str
    llm_model: str
    has_api_key: bool
    updated_at: datetime | None


class SettingsUpdate(BaseModel):
    llm_provider: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


class ConnectionTestRequest(BaseModel):
    llm_provider: str
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    model_used: str | None = None
