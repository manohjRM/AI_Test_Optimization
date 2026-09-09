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
    "cypress.config.js", "cypress.config.ts", "cypress.config.cjs", "cypress.config.mjs",
    ".mocharc.yml", ".mocharc.json", ".mocharc.js",
    "karma.conf.js",
    "phpunit.xml", "phpunit.xml.dist",
    "build.gradle", "build.gradle.kts", "pom.xml",
]

TEST_FILE_PATTERNS = [
    "test_*.py", "*_test.py", "*_test.go",
    "*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx",
    "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx",
    "*.cy.ts", "*.cy.js", "*.cy.tsx", "*.cy.jsx",
    "*.feature",
    "*Test.java", "*Test.kt",
    "*Tests.cs",
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
    for jvm_file in [*directory.rglob("*.java"), *directory.rglob("*.kt")]:
        if _has_test_annotation(jvm_file):
            return True
    return False


def _has_test_annotation(file_path: Path) -> bool:
    """Check if a .java or .kt file contains @Test annotations (JUnit/TestNG)."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        return "@Test" in content
    except OSError:
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
    "cypress": ["cypress.config.js", "cypress.config.ts", "cypress.config.cjs", "cypress.config.mjs"],
    "mocha": [".mocharc.yml", ".mocharc.json", ".mocharc.js"],
    "karma": ["karma.conf.js"],
    "phpunit": ["phpunit.xml", "phpunit.xml.dist"],
    "junit": ["build.gradle", "build.gradle.kts", "pom.xml"],
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
    "*.cy.ts": "cypress",
    "*.cy.js": "cypress",
    "*.cy.tsx": "cypress",
    "*.cy.jsx": "cypress",
    "*.feature": "cucumber",
    "*Test.java": "junit",
    "*Test.kt": "junit",
    "*.java (@Test)": "junit",
    "*.kt (@Test)": "junit",
    "*Tests.cs": "nunit/xunit",
}


_PLAYWRIGHT_TESTDIR_RE = re.compile(r"""testDir\s*:\s*(['"`])(.+?)\1""")
_CYPRESS_SPECPATTERN_RE = re.compile(r"""specPattern\s*:\s*(['"`])(.+?)\1""")
_JEST_ROOTS_RE = re.compile(r"""roots\s*:\s*\[([^\]]+)\]""")
_JEST_TESTMATCH_RE = re.compile(r"""testMatch\s*:\s*\[([^\]]+)\]""")
_VITEST_DIR_RE = re.compile(r"""(?:dir|root)\s*:\s*(['"`])(.+?)\1""")
_VITEST_INCLUDE_RE = re.compile(r"""include\s*:\s*\[([^\]]+)\]""")


def _resolve_test_dir_from_config(repo_path: Path) -> list[Path]:
    """Parse framework config files to find configured test directories."""
    resolved: list[Path] = []

    for config_name in ["playwright.config.ts", "playwright.config.js"]:
        config_file = repo_path / config_name
        if config_file.is_file():
            try:
                content = config_file.read_text(encoding="utf-8", errors="replace")
                m = _PLAYWRIGHT_TESTDIR_RE.search(content)
                if m:
                    test_dir = repo_path / m.group(2)
                    if test_dir.is_dir():
                        resolved.append(test_dir)
            except OSError:
                pass
            break

    for config_name in ["cypress.config.ts", "cypress.config.js", "cypress.config.cjs", "cypress.config.mjs"]:
        config_file = repo_path / config_name
        if config_file.is_file():
            try:
                content = config_file.read_text(encoding="utf-8", errors="replace")
                m = _CYPRESS_SPECPATTERN_RE.search(content)
                if m:
                    spec_val = m.group(2)
                    parts = spec_val.replace("\\", "/").split("/")
                    dir_parts = [p for p in parts if "*" not in p and p]
                    if dir_parts:
                        test_dir = repo_path / "/".join(dir_parts)
                        if test_dir.is_dir():
                            resolved.append(test_dir)
                if not resolved:
                    for candidate in ["cypress/e2e", "cypress/integration"]:
                        d = repo_path / candidate
                        if d.is_dir():
                            resolved.append(d)
                            break
            except OSError:
                pass
            break

    for config_name in [
        "jest.config.ts", "jest.config.js", "jest.config.mjs", "jest.config.cjs",
    ]:
        config_file = repo_path / config_name
        if config_file.is_file():
            try:
                content = config_file.read_text(encoding="utf-8", errors="replace")
                m = _JEST_ROOTS_RE.search(content)
                if m:
                    for quoted in re.findall(r"""['"`](.+?)['"`]""", m.group(1)):
                        cleaned = quoted.replace("<rootDir>/", "").replace("<rootDir>", "")
                        if cleaned:
                            d = repo_path / cleaned
                            if d.is_dir():
                                resolved.append(d)
            except OSError:
                pass
            break

    for config_name in ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs"]:
        config_file = repo_path / config_name
        if config_file.is_file():
            try:
                content = config_file.read_text(encoding="utf-8", errors="replace")
                m = _VITEST_DIR_RE.search(content)
                if m:
                    d = repo_path / m.group(2)
                    if d.is_dir():
                        resolved.append(d)
            except OSError:
                pass
            break

    for marker in ["pom.xml", "build.gradle", "build.gradle.kts"]:
        if (repo_path / marker).is_file():
            java_test = repo_path / "src" / "test" / "java"
            if java_test.is_dir():
                resolved.append(java_test)
            break

    return resolved


_FEATURE_SCENARIO_RE = re.compile(
    r"^\s*(?:Scenario|Scenario Outline|Scenario Template):\s*(.+)$", re.MULTILINE
)

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
    elif suffix in (".java", ".kt"):
        names = _JAVA_TEST_RE.findall(content)
    elif suffix == ".go":
        names = _GO_TEST_RE.findall(content)
    elif suffix == ".cs":
        names = _CSHARP_TEST_RE.findall(content)
    elif suffix == ".feature":
        names = [s.strip() for s in _FEATURE_SCENARIO_RE.findall(content)]

    return names


def _discover_test_files(
    repo_path: Path,
    test_path: str | None = None,
) -> tuple[dict[str, int], set[str], dict[str, list[Path]]]:
    """Walk the repo and find all test files, grouped by directory.

    Discovery priority:
    1. User-specified test_path (if set)
    2. Config-based detection (playwright.config.*, jest.config.*, etc.)
    3. Java convention (src/test/java/ if Maven/Gradle detected)
    4. Heuristic scan (known dir names, dirs with "test" in name)

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
                if p.is_file()
                and _is_project_path(p.relative_to(repo_path))
                and p not in seen_files
            ]
            if matches:
                breakdown[pattern] = breakdown.get(pattern, 0) + len(matches)
                seen_files.update(matches)
                test_dirs.add(display_name)
                dir_to_files.setdefault(display_name, []).extend(matches)

        for ext, label in [("*.java", "*.java (@Test)"), ("*.kt", "*.kt (@Test)")]:
            annotation_matches = [
                p for p in search_dir.rglob(ext)
                if p.is_file()
                and _is_project_path(p.relative_to(repo_path))
                and p not in seen_files
                and _has_test_annotation(p)
            ]
            if annotation_matches:
                breakdown[label] = breakdown.get(label, 0) + len(annotation_matches)
                seen_files.update(annotation_matches)
                test_dirs.add(display_name)
                dir_to_files.setdefault(display_name, []).extend(annotation_matches)

    # Priority 1: user-specified test path
    if test_path:
        user_dir = repo_path / test_path
        if user_dir.is_dir():
            rel = str(user_dir.relative_to(repo_path)).replace("\\", "/") + "/"
            _collect_from(user_dir, rel)

    # Priority 2: config-based detection
    if not seen_files:
        config_dirs = _resolve_test_dir_from_config(repo_path)
        for config_dir in config_dirs:
            rel = str(config_dir.relative_to(repo_path)).replace("\\", "/") + "/"
            _collect_from(config_dir, rel)

    # Priority 3 + 4: heuristic scan (only if nothing found yet)
    if not seen_files:
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


def count_test_files(repo_path: Path, test_path: str | None = None) -> dict:
    """Scan a repo for test files, extract test names, and return structured stats.

    Returns a dict with total_files, total_tests, frameworks, breakdown,
    test_directories, and test_tree (files with their test function names
    grouped by directory).
    """
    breakdown, test_dirs, dir_to_files = _discover_test_files(repo_path, test_path)
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


def list_repo_dirs(repo_path: Path, relative_path: str = "") -> list[dict]:
    """List subdirectories at a given path within a repo for the directory browser."""
    target = (repo_path / relative_path).resolve()
    if not str(target).startswith(str(repo_path.resolve())):
        return []
    if not target.is_dir():
        return []

    dirs: list[dict] = []
    try:
        for child in sorted(target.iterdir()):
            if not child.is_dir():
                continue
            if child.name in EXCLUDED_DIRS:
                continue
            if child.name.startswith("."):
                continue
            rel = str(child.relative_to(repo_path)).replace("\\", "/")
            has_children = any(
                c.is_dir() and c.name not in EXCLUDED_DIRS and not c.name.startswith(".")
                for c in child.iterdir()
                if c.is_dir()
            )
            dirs.append({
                "name": child.name,
                "path": rel,
                "has_children": has_children,
            })
    except OSError:
        pass

    return dirs


NO_GIT_ERROR_PREFIX = "NO_GIT:"


def validate_local_repo(path: str) -> tuple[bool, str]:
    """Check that a local path is a directory with existing test automation.

    Returns a distinct error prefix (NO_GIT:) when .git is missing so
    the caller can offer to run git init instead of hard-failing.
    """
    repo_path = Path(path)
    if not repo_path.exists():
        return False, f"Path does not exist: {path}"
    if not repo_path.is_dir():
        return False, f"Path is not a directory: {path}"

    has_tests, detail = detect_test_automation(repo_path)
    if not has_tests:
        return False, (
            f"No test automation detected in repository: {path}. "
            "This tool optimizes existing test suites — it requires a repo that "
            "already contains test files, test directories (e.g. tests/, __tests__/, spec/), "
            "or test framework configuration (e.g. pytest.ini, jest.config.*, playwright.config.*)."
        )

    if not (repo_path / ".git").is_dir():
        return False, (
            f"{NO_GIT_ERROR_PREFIX}No git repository detected at: {path}. "
            "You can initialize one to continue."
        )

    return True, path


def init_git_repo(path: str) -> tuple[bool, str]:
    """Run git init in the given directory."""
    import subprocess

    repo_path = Path(path)
    if not repo_path.is_dir():
        return False, f"Path is not a directory: {path}"

    try:
        proc = subprocess.run(
            ["git", "init", str(repo_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        return False, f"git init failed: {e}"

    if proc.returncode != 0:
        return False, proc.stderr.strip() or "git init failed"

    return True, path


def clone_github_repo(repo_url: str, clone_path: str, git_token: str | None = None) -> tuple[bool, str]:
    """Clone a GitHub repository into the user-specified directory."""
    import subprocess

    clone_dir = Path(clone_path)
    if clone_dir.exists() and any(clone_dir.iterdir()):
        if (clone_dir / ".git").is_dir():
            return True, str(clone_dir)
        return False, f"Directory is not empty and is not a git repo: {clone_path}"

    clone_dir.mkdir(parents=True, exist_ok=True)

    clone_url = repo_url
    if git_token:
        if clone_url.startswith("https://"):
            clone_url = clone_url.replace("https://", f"https://{git_token}@", 1)

    try:
        proc = subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, str(clone_dir)],
            capture_output=True,
            text=True,
            timeout=600,
        )
    except subprocess.TimeoutExpired:
        return False, "Clone timed out after 10 minutes. Try a smaller repo or check your network."
    except Exception as e:
        return False, f"git clone failed: {e}"

    if proc.returncode != 0:
        return False, proc.stderr.strip() or "git clone failed"

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
