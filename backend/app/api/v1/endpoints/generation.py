# ABOUTME: Endpoints for AI test script generation and modification.
# ABOUTME: Generates modified/new test code, stores results, and applies to disk on user approval.

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.acceptance_criteria import AcceptanceCriteria
from app.models.generated_script import GeneratedScript, ScriptAction, ScriptStatus
from app.models.project import Project
from app.schemas.generation import (
    ApplyScriptResponse,
    GenerateModifyRequest,
    GenerateNewRequest,
    GeneratedScriptRead,
)
from app.services.repo_manager import (
    file_exists_in_repo,
    git_add_and_commit,
    read_test_file,
    write_test_file,
)

router = APIRouter()


async def _load_project_and_ac(
    project_id: uuid.UUID,
    ac_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[Project, AcceptanceCriteria]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.local_path or not Path(project.local_path).is_dir():
        raise HTTPException(status_code=400, detail="Repository is not available")
    ac = await db.get(AcceptanceCriteria, ac_id)
    if not ac or ac.project_id != project_id:
        raise HTTPException(status_code=404, detail="Acceptance criteria not found")
    return project, ac


async def _get_llm(db: AsyncSession):
    from app.services.llm import get_configured_model
    llm = await get_configured_model(db)
    if not llm:
        raise HTTPException(
            status_code=400,
            detail="LLM is not configured. Go to Settings to set up your AI provider.",
        )
    return llm


@router.post("/{project_id}/generate-modify", response_model=GeneratedScriptRead, status_code=201)
async def generate_modify(
    project_id: uuid.UUID,
    payload: GenerateModifyRequest,
    db: AsyncSession = Depends(get_db),
) -> GeneratedScript:
    from app.services.generator import modify_test_script

    project, ac = await _load_project_and_ac(project_id, payload.ac_id, db)
    llm = await _get_llm(db)

    repo_path = Path(project.local_path)
    original_content = read_test_file(repo_path, payload.file_path)
    if original_content is None:
        raise HTTPException(
            status_code=400,
            detail=f"Test file not found or not readable: {payload.file_path}",
        )

    generated_content = await modify_test_script(
        file_content=original_content,
        file_path=payload.file_path,
        modifications_needed=payload.modifications_needed,
        ac_content=ac.content,
        functional_summary=project.functional_summary or "",
        llm=llm,
    )

    script = GeneratedScript(
        project_id=project_id,
        ac_id=payload.ac_id,
        action=ScriptAction.MODIFY,
        file_path=payload.file_path,
        source_item={
            "file_path": payload.file_path,
            "test_name": payload.test_name,
            "modifications_needed": payload.modifications_needed,
        },
        original_content=original_content,
        generated_content=generated_content,
    )
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return script


@router.post("/{project_id}/generate-new", response_model=GeneratedScriptRead, status_code=201)
async def generate_new(
    project_id: uuid.UUID,
    payload: GenerateNewRequest,
    db: AsyncSession = Depends(get_db),
) -> GeneratedScript:
    from app.services.generator import generate_test_script

    project, ac = await _load_project_and_ac(project_id, payload.ac_id, db)
    llm = await _get_llm(db)

    repo_path = Path(project.local_path)
    existing_content = None
    action = ScriptAction.GENERATE
    if file_exists_in_repo(repo_path, payload.suggested_file):
        existing_content = read_test_file(repo_path, payload.suggested_file)
        action = ScriptAction.APPEND

    generated_content = await generate_test_script(
        scenario_name=payload.scenario_name,
        scenario_type=payload.scenario_type,
        description=payload.description,
        steps=payload.steps,
        suggested_file=payload.suggested_file,
        existing_file_content=existing_content,
        ac_content=ac.content,
        functional_summary=project.functional_summary or "",
        llm=llm,
    )

    script = GeneratedScript(
        project_id=project_id,
        ac_id=payload.ac_id,
        action=action,
        file_path=payload.suggested_file,
        source_item={
            "scenario_name": payload.scenario_name,
            "scenario_type": payload.scenario_type,
            "description": payload.description,
            "steps": payload.steps,
            "priority": payload.priority,
            "suggested_file": payload.suggested_file,
        },
        original_content=existing_content,
        generated_content=generated_content,
    )
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return script


@router.get("/{project_id}/generated-scripts", response_model=list[GeneratedScriptRead])
async def list_generated_scripts(
    project_id: uuid.UUID,
    ac_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[GeneratedScript]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = (
        select(GeneratedScript)
        .where(GeneratedScript.project_id == project_id)
        .order_by(GeneratedScript.created_at.desc())
    )
    if ac_id:
        query = query.where(GeneratedScript.ac_id == ac_id)
    if status:
        query = query.where(GeneratedScript.status == status)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{project_id}/generated-scripts/{script_id}", response_model=GeneratedScriptRead)
async def get_generated_script(
    project_id: uuid.UUID,
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> GeneratedScript:
    script = await db.get(GeneratedScript, script_id)
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Generated script not found")
    return script


@router.post("/{project_id}/generated-scripts/{script_id}/accept", response_model=ApplyScriptResponse)
async def accept_script(
    project_id: uuid.UUID,
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    script = await db.get(GeneratedScript, script_id)
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Generated script not found")

    project = await db.get(Project, project_id)
    if not project or not project.local_path:
        raise HTTPException(status_code=400, detail="Repository is not available")

    repo_path = Path(project.local_path)
    write_ok = write_test_file(repo_path, script.file_path, script.generated_content)
    if not write_ok:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write file: {script.file_path}",
        )

    action_label = "Modify" if script.action.value == "modify" else "Generate"
    source = script.source_item or {}
    item_name = source.get("test_name") or source.get("scenario_name") or script.file_path
    commit_msg = f"[AI Agent] {action_label}: {item_name}\n\nFile: {script.file_path}"
    git_ok, git_output = git_add_and_commit(repo_path, script.file_path, commit_msg)

    script.status = ScriptStatus.APPLIED
    await db.commit()
    await db.refresh(script)

    message = f"Accepted and committed: {script.file_path}"
    if not git_ok:
        message = f"Accepted (file written) but git commit failed: {git_output}"

    return {
        "success": True,
        "file_path": script.file_path,
        "message": message,
    }


@router.post("/{project_id}/generated-scripts/{script_id}/reject", response_model=GeneratedScriptRead)
async def reject_script(
    project_id: uuid.UUID,
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> GeneratedScript:
    script = await db.get(GeneratedScript, script_id)
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Generated script not found")

    script.status = ScriptStatus.REJECTED
    await db.commit()
    await db.refresh(script)
    return script


@router.delete("/{project_id}/generated-scripts/{script_id}", status_code=204)
async def delete_generated_script(
    project_id: uuid.UUID,
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    script = await db.get(GeneratedScript, script_id)
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Generated script not found")
    await db.delete(script)
    await db.commit()
