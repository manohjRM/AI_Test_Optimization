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
    modifications_needed: list[str] = []


class MissingScenario(BaseModel):
    scenario_name: str
    type: str
    description: str
    steps: list[str] = []
    priority: str = "medium"
    suggested_file: str = ""


class CoverageAssessment(BaseModel):
    covered: list[str] = []
    partially_covered: list[str] = []
    not_covered: list[str] = []


class AnalysisResult(BaseModel):
    matches: list[MatchedTest]
    missing_scenarios: list[MissingScenario] = []
    summary: str
    coverage_assessment: CoverageAssessment | None = None
