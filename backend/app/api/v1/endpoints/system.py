# ABOUTME: System-level endpoints for OS filesystem browsing.
# ABOUTME: Lets the frontend navigate the host filesystem to select repo paths.

import platform
import string
from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

HIDDEN_PREFIXES = {".", "$"}
SKIP_NAMES = {
    "node_modules", "__pycache__", ".git", ".venv", "venv",
    "$Recycle.Bin", "System Volume Information", "Recovery",
    "ProgramData", "Windows",
}


class SystemDir(BaseModel):
    name: str
    path: str
    has_children: bool


class SystemDirList(BaseModel):
    current_path: str
    parent_path: str | None
    dirs: list[SystemDir]


def _list_drives() -> list[SystemDir]:
    """List available drive letters on Windows."""
    drives: list[SystemDir] = []
    for letter in string.ascii_uppercase:
        drive = Path(f"{letter}:\\")
        if drive.exists():
            drives.append(SystemDir(
                name=f"{letter}:\\",
                path=f"{letter}:\\",
                has_children=True,
            ))
    return drives


def _list_dirs(target: Path) -> list[SystemDir]:
    """List subdirectories at a path, skipping hidden/system dirs."""
    dirs: list[SystemDir] = []
    try:
        for child in sorted(target.iterdir()):
            if not child.is_dir():
                continue
            if child.name in SKIP_NAMES:
                continue
            if any(child.name.startswith(p) for p in HIDDEN_PREFIXES):
                continue
            has_children = False
            try:
                has_children = any(
                    c.is_dir() for c in child.iterdir()
                    if c.name not in SKIP_NAMES
                    and not any(c.name.startswith(p) for p in HIDDEN_PREFIXES)
                )
            except PermissionError:
                pass
            dirs.append(SystemDir(
                name=child.name,
                path=str(child).replace("/", "\\") if platform.system() == "Windows" else str(child),
                has_children=has_children,
            ))
    except PermissionError:
        pass
    return dirs


@router.get("/dirs", response_model=SystemDirList)
async def list_system_dirs(
    path: str = Query("", description="OS path to list. Empty returns drive roots (Windows) or / (Unix)."),
) -> dict:
    if not path:
        if platform.system() == "Windows":
            return {
                "current_path": "",
                "parent_path": None,
                "dirs": _list_drives(),
            }
        return {
            "current_path": "/",
            "parent_path": None,
            "dirs": _list_dirs(Path("/")),
        }

    target = Path(path).resolve()
    if not target.is_dir():
        return {
            "current_path": str(target),
            "parent_path": str(target.parent) if target.parent != target else None,
            "dirs": [],
        }

    parent = str(target.parent) if target.parent != target else None
    if platform.system() == "Windows" and str(target) == str(target.anchor):
        parent = ""

    return {
        "current_path": str(target),
        "parent_path": parent,
        "dirs": _list_dirs(target),
    }
