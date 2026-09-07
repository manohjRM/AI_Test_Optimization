# ABOUTME: Validates repos, detects test automation, and clones GitHub repos.
# ABOUTME: Rejects repos that lack existing test automation since the tool only optimizes existing suites.

import asyncio
from pathlib import Path

from app.core.config import settings

TEST_DIRECTORIES = [
    "tests", "test", "__tests__", "spec", "e2e", "cypress",
    "integration_tests", "functional_tests",
]

TEST_CONFIG_FILES = [
    "pytest.ini", "conftest.py", "setup.cfg", "tox.ini",
    "jest.config.js", "jest.config.ts", "jest.config.mjs", "jest.config.cjs",
    "vitest.config.js", "vitest.config.ts", "vitest.config.mjs",
    "playwright.config.js", "playwright.config.ts",
    "cypress.config.js", "cypress.config.ts",
    ".mocharc.yml", ".mocharc.json", ".mocharc.js",
    "karma.conf.js",
    "phpunit.xml", "phpunit.xml.dist",
    "build.gradle", "pom.xml",
]

TEST_FILE_PATTERNS = [
    "test_*.py", "*_test.py", "*_test.go",
    "*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx",
    "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx",
    "*Test.java", "*Tests.cs",
]

EXCLUDED_DIRS = {
    ".venv", "venv", "env", ".env",
    "node_modules",
    ".git",
    "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".tox",
    "dist", "build", ".next", "out",
    "site-packages",
}


def _is_project_path(path: Path) -> bool:
    """Return False if any component of the path is an excluded directory."""
    return not any(part in EXCLUDED_DIRS for part in path.parts)


def _has_test_files_in_dir(directory: Path) -> bool:
    """Check if a directory contains files matching test naming patterns."""
    for pattern in TEST_FILE_PATTERNS:
        if any(directory.rglob(pattern)):
            return True
    return False


def detect_test_automation(repo_path: Path) -> tuple[bool, str | None]:
    """Check whether a repo contains existing test automation.

    Returns (has_tests, detail_message).
    detail_message describes what was found, or why detection failed.
    Excludes virtual environments, node_modules, and other non-project directories.

    Detection strategy (strongest signals first):
    1. Known test directories (tests/, __tests__/, spec/, etc.) with test files inside
    2. Test framework config files (pytest.ini, jest.config.*, etc.)
    3. Test files in project directories whose name contains "test"
    """
    found_signals: list[str] = []

    for dir_name in TEST_DIRECTORIES:
        candidate = repo_path / dir_name
        if candidate.is_dir() and _has_test_files_in_dir(candidate):
            found_signals.append(f"test directory with test files: {dir_name}/")

    for config_name in TEST_CONFIG_FILES:
        if (repo_path / config_name).is_file():
            found_signals.append(f"config file: {config_name}")

    if not found_signals:
        for child in repo_path.iterdir():
            if not child.is_dir():
                continue
            if child.name in EXCLUDED_DIRS:
                continue
            if "test" not in child.name.lower():
                continue
            if _has_test_files_in_dir(child):
                found_signals.append(
                    f"test files found in directory: {child.name}/"
                )

    if found_signals:
        detail = "Detected test automation: " + "; ".join(found_signals)
        return True, detail

    return False, None


def validate_local_repo(path: str) -> tuple[bool, str]:
    """Check that a local path is a git repo with existing test automation."""
    repo_path = Path(path)
    if not repo_path.exists():
        return False, f"Path does not exist: {path}"
    if not repo_path.is_dir():
        return False, f"Path is not a directory: {path}"
    if not (repo_path / ".git").is_dir():
        return False, f"Path is not a git repository (no .git directory): {path}"

    has_tests, detail = detect_test_automation(repo_path)
    if not has_tests:
        return False, (
            f"No test automation detected in repository: {path}. "
            "This tool optimizes existing test suites — it requires a repo that "
            "already contains test files, test directories (e.g. tests/, __tests__/, spec/), "
            "or test framework configuration (e.g. pytest.ini, jest.config.*, playwright.config.*)."
        )

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


async def validate_cloned_repo(clone_dir: str) -> tuple[bool, str]:
    """Validate that a cloned repo contains test automation."""
    has_tests, detail = detect_test_automation(Path(clone_dir))
    if not has_tests:
        return False, (
            "No test automation detected in the cloned repository. "
            "This tool optimizes existing test suites — it requires a repo that "
            "already contains test files, test directories (e.g. tests/, __tests__/, spec/), "
            "or test framework configuration (e.g. pytest.ini, jest.config.*, playwright.config.*)."
        )
    return True, clone_dir
