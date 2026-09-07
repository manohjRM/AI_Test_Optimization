# ABOUTME: Optimization endpoint — the main entry point for AI-driven script work.
# ABOUTME: Accepts user input and returns AI-generated or modified test scripts.

from fastapi import APIRouter

from app.schemas.optimization import OptimizationRequest, OptimizationResponse
from app.services.orchestrator import optimize_test_script

router = APIRouter()


@router.post("/", response_model=OptimizationResponse)
async def optimize(request: OptimizationRequest) -> OptimizationResponse:
    return await optimize_test_script(request)
