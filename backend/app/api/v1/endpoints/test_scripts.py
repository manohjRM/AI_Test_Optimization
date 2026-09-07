# ABOUTME: CRUD endpoints for test script resources.
# ABOUTME: Supports create, read (single + list), update, and delete.

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.test_script import TestScript
from app.schemas.test_script import TestScriptCreate, TestScriptRead, TestScriptUpdate

router = APIRouter()


@router.post("/", response_model=TestScriptRead, status_code=201)
async def create_test_script(
    payload: TestScriptCreate, db: AsyncSession = Depends(get_db)
) -> TestScript:
    script = TestScript(**payload.model_dump())
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return script


@router.get("/", response_model=list[TestScriptRead])
async def list_test_scripts(db: AsyncSession = Depends(get_db)) -> list[TestScript]:
    result = await db.execute(select(TestScript).order_by(TestScript.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{script_id}", response_model=TestScriptRead)
async def get_test_script(
    script_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> TestScript:
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Test script not found")
    return script


@router.patch("/{script_id}", response_model=TestScriptRead)
async def update_test_script(
    script_id: uuid.UUID,
    payload: TestScriptUpdate,
    db: AsyncSession = Depends(get_db),
) -> TestScript:
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Test script not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(script, field, value)
    await db.commit()
    await db.refresh(script)
    return script


@router.delete("/{script_id}", status_code=204)
async def delete_test_script(
    script_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Test script not found")
    await db.delete(script)
    await db.commit()
