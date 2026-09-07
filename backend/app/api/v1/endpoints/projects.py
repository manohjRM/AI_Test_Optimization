# ABOUTME: CRUD endpoints for Project resources.
# ABOUTME: Handles project creation with repo validation/cloning, listing, and deletion.

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.project import Project, RepoStatus, RepoType
from app.schemas.project import ProjectCreate, ProjectRead
from app.services.repo_manager import (
    clone_github_repo,
    validate_cloned_repo,
    validate_local_repo,
)

router = APIRouter()


async def _clone_and_update(project_id: uuid.UUID, repo_url: str) -> None:
    """Background task: clone a GitHub repo and update project status."""
    from app.db.session import async_session

    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project:
            return

        clone_ok, clone_result = await clone_github_repo(repo_url, str(project_id))
        if not clone_ok:
            project.repo_status = RepoStatus.ERROR
            project.repo_error = clone_result
            await db.commit()
            return

        tests_ok, tests_result = await validate_cloned_repo(clone_result)
        if not tests_ok:
            project.repo_status = RepoStatus.ERROR
            project.repo_error = tests_result
        else:
            project.local_path = tests_result
            project.repo_status = RepoStatus.CLONED
            project.repo_error = None

        await db.commit()


@router.post("/", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Project:
    if payload.repo_type == "local":
        valid, result = validate_local_repo(payload.repo_url)
        if not valid:
            raise HTTPException(status_code=400, detail=result)
        project = Project(
            name=payload.name,
            description=payload.description,
            repo_type=RepoType.LOCAL,
            repo_url=payload.repo_url,
            local_path=result,
            repo_status=RepoStatus.VALID,
        )
    else:
        project = Project(
            name=payload.name,
            description=payload.description,
            repo_type=RepoType.GITHUB,
            repo_url=payload.repo_url,
            repo_status=RepoStatus.CLONING,
        )

    db.add(project)
    await db.commit()
    await db.refresh(project)

    if payload.repo_type == "github":
        background_tasks.add_task(_clone_and_update, project.id, payload.repo_url)

    return project


@router.get("/", response_model=list[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[Project]:
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
