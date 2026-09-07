# ABOUTME: Validates repos, detects test automation, scans test cases, and clones GitHub repos.
# ABOUTME: Rejects repos that lack existing test automation since the tool only optimizes existing suites.

import asyncio
import re
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


FRAMEWORK_INDICATORS: dict[str, list[str]] = {
    "pytest": ["pytest.ini", "conftest.py", "setup.cfg", "tox.ini"],
    "jest": ["jest.config.js", "jest.config.ts", "jest.config.mjs", "jest.config.cjs"],
    "vitest": ["vitest.config.js", "vitest.config.ts", "vitest.config.mjs"],
    "playwright": ["playwright.config.js", "playwright.config.ts"],
    "cypress": ["cypress.config.js", "cypress.config.ts"],
    "mocha": [".mocharc.yml", ".mocharc.json", ".mocharc.js"],
    "karma": ["karma.conf.js"],
    "phpunit": ["phpunit.xml", "phpunit.xml.dist"],
    "junit": ["build.gradle", "pom.xml"],
}

PATTERN_FRAMEWORK_MAP: dict[str, str] = {
    "test_*.py": "pytest",
    "*_test.py": "pytest",
    "*_test.go": "go test",
    "*.test.ts": "jest/vitest",
    "*.test.tsx": "jest/vitest",
    "*.test.js": "jest/vitest",
    "*.test.jsx": "jest/vitest",
    "*.spec.ts": "playwright/jasmine",
    "*.spec.tsx": "playwright/jasmine",
    "*.spec.js": "playwright/jasmine",
    "*.spec.jsx": "playwright/jasmine",
    "*Test.java": "junit",
    "*Tests.cs": "nunit/xunit",
}


_PYTHON_TEST_RE = re.compile(r"^\s*(?:async\s+)?def\s+(test_\w+)", re.MULTILINE)
_JS_TEST_RE = re.compile(r"""\b(?:it|test)\s*\(\s*(['"`])(.+?)\1""", re.MULTILINE)
_JS_DESCRIBE_RE = re.compile(r"""\bdescribe\s*\(\s*(['"`])(.+?)\1""", re.MULTILINE)
_JAVA_TEST_RE = re.compile(r"@Test\b.*?\n\s*(?:public\s+)?void\s+(\w+)", re.MULTILINE)
_GO_TEST_RE = re.compile(r"^func\s+(Test\w+)\(", re.MULTILINE)
_CSHARP_TEST_RE = re.compile(
    r"\[(?:Test|Fact|Theory)\]\s*\n\s*(?:public\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(",
    re.MULTILINE,
)


def _extract_test_names(file_path: Path) -> list[str]:
    """Parse a test file and return individual test function/case names."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    suffix = file_path.suffix.lower()
    names: list[str] = []

    if suffix == ".py":
        names = _PYTHON_TEST_RE.findall(content)
    elif suffix in (".ts", ".tsx", ".js", ".jsx"):
        describes = _JS_DESCRIBE_RE.findall(content)
        tests = _JS_TEST_RE.findall(content)
        for _, desc_name in describes:
            names.append(f"[describe] {desc_name}")
        for _, test_name in tests:
            names.append(test_name)
    elif suffix == ".java":
        names = _JAVA_TEST_RE.findall(content)
    elif suffix == ".go":
        names = _GO_TEST_RE.findall(content)
    elif suffix == ".cs":
        names = _CSHARP_TEST_RE.findall(content)

    return names


def _discover_test_files(repo_path: Path) -> tuple[dict[str, int], set[str], dict[str, list[Path]]]:
    """Walk the repo and find all test files, grouped by directory.

    Returns (breakdown, test_dirs, dir_to_files) where dir_to_files maps
    directory display names to lists of absolute file paths.
    """
    breakdown: dict[str, int] = {}
    test_dirs: set[str] = set()
    seen_files: set[Path] = set()
    dir_to_files: dict[str, list[Path]] = {}

    def _collect_from(search_dir: Path, display_name: str) -> None:
        for pattern in TEST_FILE_PATTERNS:
            matches = [
                p for p in search_dir.rglob(pattern)
                if _is_project_path(p.relative_to(repo_path))
                and p not in seen_files
            ]
            if matches:
                breakdown[pattern] = breakdown.get(pattern, 0) + len(matches)
                seen_files.update(matches)
                test_dirs.add(display_name)
                dir_to_files.setdefault(display_name, []).extend(matches)

    search_roots = [repo_path]
    for child in repo_path.iterdir():
        if child.is_dir() and child.name not in EXCLUDED_DIRS and child.name not in TEST_DIRECTORIES:
            search_roots.append(child)

    for root in search_roots:
        for dir_name in TEST_DIRECTORIES:
            candidate = root / dir_name
            if candidate.is_dir():
                rel = str(candidate.relative_to(repo_path)).replace("\\", "/") + "/"
                _collect_from(candidate, rel)

    for child in repo_path.iterdir():
        if not child.is_dir():
            continue
        if child.name in EXCLUDED_DIRS:
            continue
        if child.name in TEST_DIRECTORIES:
            continue
        if "test" not in child.name.lower():
            continue
        _collect_from(child, child.name + "/")

    return breakdown, test_dirs, dir_to_files


def _detect_frameworks(repo_path: Path, breakdown: dict[str, int]) -> list[str]:
    """Detect test frameworks from config files and file patterns."""
    frameworks: set[str] = set()
    for config_name, fw_name in [
        (cfg, fw)
        for fw, cfgs in FRAMEWORK_INDICATORS.items()
        for cfg in cfgs
    ]:
        if (repo_path / config_name).is_file():
            frameworks.add(fw_name)

    for pattern, fw in PATTERN_FRAMEWORK_MAP.items():
        if pattern in breakdown:
            frameworks.add(fw.split("/")[0])

    return sorted(frameworks)


def count_test_files(repo_path: Path) -> dict:
    """Scan a repo for test files, extract test names, and return structured stats.

    Returns a dict with total_files, total_tests, frameworks, breakdown,
    test_directories, and test_tree (files with their test function names
    grouped by directory).
    """
    breakdown, test_dirs, dir_to_files = _discover_test_files(repo_path)
    frameworks = _detect_frameworks(repo_path, breakdown)

    test_tree: list[dict] = []
    total_tests = 0

    for dir_display in sorted(dir_to_files.keys()):
        files_data: list[dict] = []
        for file_path in sorted(dir_to_files[dir_display]):
            test_names = _extract_test_names(file_path)
            total_tests += len(test_names)
            rel_path = str(file_path.relative_to(repo_path)).replace("\\", "/")
            files_data.append({
                "path": rel_path,
                "name": file_path.name,
                "tests": test_names,
            })
        test_tree.append({
            "directory": dir_display,
            "files": files_data,
        })

    total_files = sum(len(fd["files"]) for fd in test_tree)

    return {
        "total_files": total_files,
        "total_tests": total_tests,
        "frameworks": frameworks,
        "breakdown": breakdown,
        "test_directories": sorted(test_dirs),
        "test_tree": test_tree,
    }


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
