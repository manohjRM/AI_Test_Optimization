# ABOUTME: Pydantic schemas for AI test analysis requests and results.
# ABOUTME: Defines the contract for matching acceptance criteria to existing tests.

import uuid

from pydantic import BaseModel


class AnalysisRequest(BaseModel):
    ac_id: uuid.UUID


class MatchedTest(BaseModel):
    file_path: str
    test_name: str
    relevance: str
    explanation: str


class AnalysisResult(BaseModel):
    matches: list[MatchedTest]
    summary: str
    suggestions: list[str]
