# ABOUTME: V1 API — aggregates all endpoint routers into a single v1 router.
# ABOUTME: Mounted at /api/v1 by the main application.

from fastapi import APIRouter

from app.api.v1.endpoints import generation, health, optimization, projects, settings, system, test_scripts

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(generation.router, prefix="/projects", tags=["generation"])
router.include_router(test_scripts.router, prefix="/test-scripts", tags=["test-scripts"])
router.include_router(optimization.router, prefix="/optimize", tags=["optimization"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(system.router, prefix="/system", tags=["system"])
