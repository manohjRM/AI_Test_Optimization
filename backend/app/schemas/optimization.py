# ABOUTME: Pydantic schemas for the AI optimization request/response cycle.
# ABOUTME: Defines the contract between the frontend and the orchestration layer.

from pydantic import BaseModel


class OptimizationRequest(BaseModel):
    user_input: str
    existing_script: str | None = None
    framework: str = "pytest"
    language: str = "python"


class OptimizationResponse(BaseModel):
    original_script: str | None
    optimized_script: str
    explanation: str
    suggestions: list[str]
