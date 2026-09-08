# ABOUTME: Settings endpoints for LLM provider configuration.
# ABOUTME: Handles read, update, and connection testing for AI settings.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.settings import Settings
from app.schemas.settings import (
    ConnectionTestRequest,
    ConnectionTestResult,
    SettingsRead,
    SettingsUpdate,
)
from app.services.llm import SUPPORTED_PROVIDERS, test_connection

router = APIRouter()


async def _get_or_create_settings(db: AsyncSession) -> Settings:
    """Get the singleton settings row, creating it if it doesn't exist."""
    settings = await db.get(Settings, 1)
    if not settings:
        settings = Settings(id=1)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("/", response_model=SettingsRead)
async def get_settings(db: AsyncSession = Depends(get_db)) -> dict:
    settings = await _get_or_create_settings(db)
    return {
        "llm_provider": settings.llm_provider,
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "has_api_key": bool(settings.llm_api_key),
        "updated_at": settings.updated_at,
    }


@router.patch("/", response_model=SettingsRead)
async def update_settings(
    payload: SettingsUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    settings = await _get_or_create_settings(db)

    if payload.llm_provider is not None:
        if payload.llm_provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider. Use: {', '.join(SUPPORTED_PROVIDERS)}",
            )
        settings.llm_provider = payload.llm_provider

    if payload.llm_base_url is not None:
        settings.llm_base_url = payload.llm_base_url

    if payload.llm_api_key is not None:
        settings.llm_api_key = payload.llm_api_key

    if payload.llm_model is not None:
        settings.llm_model = payload.llm_model

    await db.commit()
    await db.refresh(settings)

    return {
        "llm_provider": settings.llm_provider,
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "has_api_key": bool(settings.llm_api_key),
        "updated_at": settings.updated_at,
    }


@router.post("/test-connection", response_model=ConnectionTestResult)
async def test_llm_connection(payload: ConnectionTestRequest) -> dict:
    success, message = await test_connection(
        payload.llm_provider, payload.llm_api_key, payload.llm_model, payload.llm_base_url
    )
    return {
        "success": success,
        "message": message,
        "model_used": payload.llm_model if success else None,
    }
