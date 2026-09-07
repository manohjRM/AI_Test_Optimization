# ABOUTME: Health check endpoint for liveness/readiness probes.
# ABOUTME: Returns application status and basic metadata.

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "service": "ai-test-optimization-agent"}
