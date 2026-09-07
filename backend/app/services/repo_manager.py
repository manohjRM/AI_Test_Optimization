# ABOUTME: Validates local repo paths and clones GitHub repos to a managed workspace.
# ABOUTME: Provides the bridge between user-supplied repo references and the local filesystem.

import asyncio
import os
from pathlib import Path

from app.core.config import settings


def validate_local_repo(path: str) -> tuple[bool, str]:
    """Check that a local path exists and looks like a git repository."""
    repo_path = Path(path)
    if not repo_path.exists():
        return False, f"Path does not exist: {path}"
    if not repo_path.is_dir():
        return False, f"Path is not a directory: {path}"
    if not (repo_path / ".git").is_dir():
        return False, f"Path is not a git repository (no .git directory): {path}"
    return True, path


async def clone_github_repo(repo_url: str, project_id: str) -> tuple[bool, str]:
    """Clone a GitHub repository into the managed workspace directory."""
    workspace = Path(settings.REPO_WORKSPACE_DIR)
    workspace.mkdir(parents=True, exist_ok=True)

    clone_dir = workspace / project_id
    if clone_dir.exists():
        return True, str(clone_dir)

    proc = await asyncio.create_subprocess_exec(
        "git", "clone", repo_url, str(clone_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode().strip() if stderr else "Unknown clone error"
        return False, error_msg

    return True, str(clone_dir)
