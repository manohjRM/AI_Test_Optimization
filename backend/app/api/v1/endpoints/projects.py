# ABOUTME: CRUD endpoints for Project resources.
# ABOUTME: Handles project creation with repo validation/cloning, listing, and deletion.

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.acceptance_criteria import AcceptanceCriteria
from app.models.project import Project, RepoStatus, RepoType
from app.schemas.acceptance_criteria import ACCreate, ACRead
from app.schemas.analysis import AnalysisRequest, AnalysisResult
from app.schemas.project import (
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    RepoDirList,
    TestStats,
)
from app.services.repo_manager import (
    NO_GIT_ERROR_PREFIX,
    clone_github_repo,
    count_test_files,
    init_git_repo,
    list_repo_dirs,
    validate_local_repo,
)

router = APIRouter()


@router.post("/", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
) -> Project:
    if payload.repo_type == "local":
        valid, result = validate_local_repo(payload.repo_url)
        if not valid:
            if result.startswith(NO_GIT_ERROR_PREFIX) and payload.force_init_git:
                init_ok, init_result = init_git_repo(payload.repo_url)
                if not init_ok:
                    raise HTTPException(status_code=400, detail=init_result)
            elif result.startswith(NO_GIT_ERROR_PREFIX):
                raise HTTPException(status_code=409, detail=result)
            else:
                raise HTTPException(status_code=400, detail=result)
        project = Project(
            name=payload.name,
            description=payload.description,
            repo_type=RepoType.LOCAL,
            repo_url=payload.repo_url,
            local_path=payload.repo_url,
            repo_status=RepoStatus.VALID,
        )
    else:
        if not payload.clone_path:
            raise HTTPException(
                status_code=400,
                detail="clone_path is required for GitHub repos — select where to clone.",
            )

        clone_ok, clone_result = clone_github_repo(payload.repo_url, payload.clone_path, payload.git_token)
        if not clone_ok:
            raise HTTPException(status_code=400, detail=clone_result)

        project = Project(
            name=payload.name,
            description=payload.description,
            repo_type=RepoType.GITHUB,
            repo_url=payload.repo_url,
            local_path=clone_result,
            repo_status=RepoStatus.CLONED,
        )

    db.add(project)
    await db.commit()
    await db.refresh(project)
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


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
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


@router.get("/{project_id}/test-stats", response_model=TestStats)
async def get_test_stats(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_path = project.local_path
    if not repo_path:
        raise HTTPException(
            status_code=400,
            detail="Repository is not available yet (still cloning or errored)",
        )

    if not Path(repo_path).is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Repository path no longer accessible: {repo_path}",
        )

    return count_test_files(Path(repo_path), test_path=project.test_path)


@router.get("/{project_id}/repo-dirs", response_model=RepoDirList)
async def get_repo_dirs(
    project_id: uuid.UUID,
    path: str = Query("", description="Relative path within the repo"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_path = project.local_path
    if not repo_path:
        raise HTTPException(
            status_code=400,
            detail="Repository is not available yet",
        )

    if not Path(repo_path).is_dir():
        raise HTTPException(
            status_code=400,
            detail=f"Repository path no longer accessible: {repo_path}",
        )

    return {"dirs": list_repo_dirs(Path(repo_path), path)}


# Acceptance Criteria

@router.post("/{project_id}/acceptance-criteria", response_model=ACRead, status_code=201)
async def create_acceptance_criteria(
    project_id: uuid.UUID,
    payload: ACCreate,
    db: AsyncSession = Depends(get_db),
) -> AcceptanceCriteria:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ac = AcceptanceCriteria(project_id=project_id, content=payload.content)
    db.add(ac)
    await db.commit()
    await db.refresh(ac)
    return ac


@router.get("/{project_id}/acceptance-criteria", response_model=list[ACRead])
async def list_acceptance_criteria(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[AcceptanceCriteria]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(AcceptanceCriteria)
        .where(AcceptanceCriteria.project_id == project_id)
        .order_by(AcceptanceCriteria.created_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/{project_id}/acceptance-criteria/{ac_id}", status_code=204)
async def delete_acceptance_criteria(
    project_id: uuid.UUID,
    ac_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    ac = await db.get(AcceptanceCriteria, ac_id)
    if not ac or ac.project_id != project_id:
        raise HTTPException(status_code=404, detail="Acceptance criteria not found")
    await db.delete(ac)
    await db.commit()


# Summary

@router.post("/{project_id}/generate-summary", response_model=ProjectRead)
async def generate_summary(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Project:
    from app.services.analyzer import generate_app_summary
    from app.services.llm import get_configured_model

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.local_path or not Path(project.local_path).is_dir():
        raise HTTPException(status_code=400, detail="Repository is not available")

    llm = await get_configured_model(db)
    if not llm:
        raise HTTPException(
            status_code=400,
            detail="LLM is not configured. Go to Settings to set up your AI provider.",
        )

    summary = await generate_app_summary(
        repo_path=project.local_path,
        test_path=project.test_path,
        llm=llm,
    )
    project.app_summary = summary
    await db.commit()
    await db.refresh(project)
    return project


# Analysis

@router.post("/{project_id}/analyze", response_model=AnalysisResult)
async def analyze_tests(
    project_id: uuid.UUID,
    payload: AnalysisRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.analyzer import find_related_tests
    from app.services.llm import get_configured_model

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.local_path or not Path(project.local_path).is_dir():
        raise HTTPException(status_code=400, detail="Repository is not available")

    ac = await db.get(AcceptanceCriteria, payload.ac_id)
    if not ac or ac.project_id != project_id:
        raise HTTPException(status_code=404, detail="Acceptance criteria not found")

    llm = await get_configured_model(db)
    if not llm:
        raise HTTPException(
            status_code=400,
            detail="LLM is not configured. Go to Settings to set up your AI provider.",
        )

    result = await find_related_tests(
        ac_content=ac.content,
        repo_path=project.local_path,
        test_path=project.test_path,
        llm=llm,
    )

    from app.services.analyzer import generate_app_summary

    try:
        summary = await generate_app_summary(
            repo_path=project.local_path,
            test_path=project.test_path,
            llm=llm,
        )
        project.app_summary = summary
        await db.commit()
        await db.refresh(project)
    except Exception:
        pass

    return result
