# AI-Driven Regression Test Script Optimizer

This document is the project brain — scope, architecture, flow, checklists, and decisions. It serves as the system prompt for all planning, development, and modification tasks.

---

## Project Goal

A tool that takes user input (acceptance criteria, typically in BDD format), analyzes an existing test codebase, and uses AI to generate or modify regression test scripts. The system reduces manual effort, improves coverage, and accelerates the regression testing cycle.

**This tool is for existing projects with test automation only.** It does not create test automation from scratch — it optimizes, extends, and generates tests within repos that already have a test framework set up.

## Tech Stack

| Layer           | Technology                                        |
|-----------------|---------------------------------------------------|
| Frontend        | Next.js 16 (TypeScript, Tailwind CSS)             |
| Backend         | FastAPI (Python 3.13, uv)                         |
| Database        | PostgreSQL + pgvector                              |
| AI Orchestration| LangGraph + LangChain (provider-configurable)     |
| LLM Providers   | Anthropic Claude / OpenAI GPT (user-configurable) |

## Core Flow

```
Dashboard (landing page)
    │
    │  List of projects + Settings icon (LLM config)
    │  [Create Project] button
    │
    ▼
Create Project
    │
    ├─► Project name + description
    └─► Repository (MANDATORY):
        ├─► Local path (Browse button with folder picker modal)
        └─► GitHub URL → tool clones it locally
    │
    │  Validation: must have test automation (test dirs, config files, test files)
    │  If no .git: prompt user → run git init if accepted
    │
    ▼
Project Detail (inside a project)
    │
    ├─► Edit name/description (repo path is read-only)
    ├─► Test Suite: auto-detected test stats + explorer tree
    │   ├─► Config-driven detection (reads playwright.config, jest.config, etc.)
    │   ├─► Manual test path override via directory browser if auto-detection fails
    │   └─► Shows: file count, test count, frameworks, file→function tree
    │
    ├─► Acceptance Criteria input:
    │   ├─► Paste BDD (Given/When/Then) in text box
    │   └─► (Future) JIRA / Azure DevOps ticket number → fetch AC
    │
    ▼
AI Analysis (LangGraph workflow)
    │
    ├─► Parse BDD acceptance criteria into scenarios
    ├─► Build context from repo test tree + relevant test file contents
    ├─► Invoke LLM to match AC against existing tests
    └─► Return related tests grouped by relevance (direct/partial/related)
    │
    ▼
Output
    │
    ├─► Display matched tests with explanations
    ├─► (Future) Generate or modify test scripts
    ├─► (Future) Show diff, copy, download, push changes
    └─► (Future) Run tests from the tool via CLI
```

---

## What's Built (Completed)

### Chunk 1: Project Management + Repo Setup [DONE]
- [x] Dashboard page — lists all projects as cards with status badges
- [x] Create Project page with name, description, repo source toggle
- [x] Folder picker modal (path bar, breadcrumbs, lazy-loading OS directory tree)
- [x] Project card on dashboard showing name, repo info, status, created date
- [x] Project model (id, name, description, repo_type, repo_url, local_path, repo_status, repo_error, test_path)
- [x] CRUD endpoints: POST/GET/PATCH/DELETE /projects, GET /projects/{id}
- [x] Local path validation (exists, is directory, has test automation)
- [x] Git init support: if no .git detected, prompt user → run git init → create project
- [x] GitHub clone (async background task) with test automation validation
- [x] PostgreSQL + Alembic migrations (projects, test_scripts tables)
- [x] System directory browser endpoint (GET /system/dirs) for folder picker

### Project Detail Page [DONE]
- [x] Editable name/description with Save button (repo path read-only)
- [x] Delete project with confirmation → redirect to dashboard
- [x] Repository section: type, URL, local path, status badge (read-only)
- [x] Test Suite section with auto-refresh:
  - [x] Summary cards: test files, test cases, frameworks
  - [x] Detected frameworks tags
  - [x] Test Explorer tree: collapsible directories → files → test function names
  - [x] Config-driven test path detection (reads playwright.config, cypress.config, jest.config, vitest.config, Maven/Gradle conventions)
  - [x] Manual test_path override via in-repo directory browser when auto-detection fails
  - [x] Test path shown as tag with clear button
- [x] Run Tests stub (disabled button, "coming soon")

### Test Discovery Capabilities [DONE]
- [x] Config-based detection priority: user test_path > framework config > Java convention > heuristic
- [x] Supported frameworks: pytest, jest, vitest, playwright, cypress, mocha, karma, phpunit, junit, cucumber
- [x] File patterns: test_*.py, *_test.py, *.test.ts/js, *.spec.ts/js, *.cy.ts/js, *.feature, *Test.java, *Tests.cs, *_test.go
- [x] Test name extraction: Python (def test_*), JS/TS (it/test/describe), Java (@Test), Go (func Test*), C# ([Test]/[Fact]), Gherkin (Scenario/Scenario Outline)
- [x] Excluded dirs: .venv, node_modules, .git, __pycache__, dist, build, etc.
- [x] p.is_file() filter to prevent directory false matches

---

## Current Work: Chunk 2 — LLM Settings + BDD Input + AI Test Matching

### Part 1: LLM Settings (configurable via UI)
> **Goal:** User configures their LLM provider from the dashboard settings page.

**Backend:**
- [ ] `Settings` model (single-row: llm_provider, llm_api_key, llm_model)
- [ ] Schemas: SettingsRead (key masked), SettingsUpdate, ConnectionTestResult
- [ ] GET /settings, PATCH /settings, POST /settings/test-connection
- [ ] LLM service (`llm.py`): LangChain ChatModel factory, connection test
- [ ] Alembic migration for settings table

**Frontend:**
- [ ] Settings gear icon on dashboard header → links to /settings
- [ ] Settings page: provider dropdown, API key (password), model input
- [ ] "Test Connection" button → verify key/model with minimal LLM call
- [ ] "Save" button → only enabled after successful connection test

**Dependencies:** langgraph, langchain-core, langchain-anthropic, langchain-openai

### Part 2: BDD Input on Project Detail
> **Goal:** User enters acceptance criteria (BDD format) inside a project.

**Backend:**
- [ ] `AcceptanceCriteria` model (id, project_id FK, content, created_at)
- [ ] Schemas: ACCreate, ACRead
- [ ] POST /projects/{id}/acceptance-criteria, GET list, DELETE by id
- [ ] Alembic migration for acceptance_criteria table

**Frontend:**
- [ ] New "Acceptance Criteria" section on project detail page
- [ ] Textarea for BDD input (Given/When/Then)
- [ ] Save button, list of saved ACs, delete per AC
- [ ] "Analyze" button next to each saved AC

### Part 3: AI Test Matching (LangGraph)
> **Goal:** AI finds which existing tests are related to the acceptance criteria.

**Backend:**
- [ ] LangGraph workflow (`analyzer.py`) with nodes:
  1. `parse_criteria` — structure the raw BDD text
  2. `build_context` — read test tree + relevant test file contents
  3. `match_tests` — invoke LLM with AC + context
  4. `format_results` — parse into structured matches
- [ ] Schemas: AnalysisRequest, MatchedTest (file, test, relevance, explanation), AnalysisResult
- [ ] POST /projects/{id}/analyze — accepts ac_id, returns matched tests

**Frontend:**
- [ ] Loading spinner while LLM processes
- [ ] Results panel: matched tests grouped by relevance (direct/partial/related)
- [ ] Each match: file path, test name, explanation
- [ ] Summary from the LLM

**Definition of Done:** User configures LLM in settings, opens a project, enters BDD criteria, clicks Analyze, and sees which existing tests are related with explanations.

---

## Future Chunks

### Chunk 3: AI Script Generation + Modification
> AI generates new test scripts or modifies existing ones based on BDD + repo context.

- [ ] Generate new test scripts matching repo style and framework
- [ ] Modify existing scripts when AC updates functionality
- [ ] Syntax-highlighted code viewer + diff view
- [ ] Copy to clipboard, download files
- [ ] Validate generated code for syntax correctness

### Chunk 4: JIRA / Azure DevOps Integration
> Fetch acceptance criteria from issue trackers.

- [ ] JIRA REST API client (authenticate, fetch AC from ticket)
- [ ] Azure DevOps API client (authenticate, fetch AC from work item)
- [ ] Auto-populate BDD input from fetched data

### Chunk 5: Test Execution
> Run tests from the tool directly.

- [ ] Detect CLI command per framework (pytest, npx playwright test, etc.)
- [ ] Run button triggers background CLI execution at repo location
- [ ] Stream test output to the UI
- [ ] Show pass/fail results

### Chunk 6: Git Remote Clone Enhancements
> Robust remote repo handling.

- [ ] Clone progress feedback in UI
- [ ] SSH key / token authentication for private repos
- [ ] Cleanup lifecycle for old clones
- [ ] Re-pull / refresh support

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                    │
│                                                              │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │Dashboard  │ │Create      │ │Project     │ │Settings    │ │
│  │(projects  │→│Project     │→│Detail      │ │(LLM config)│ │
│  │ + settings│ │(name+repo  │ │(AC input + │ │            │ │
│  │  icon)    │ │ + browse)  │ │ test tree +│ │            │ │
│  │           │ │            │ │ AI results)│ │            │ │
│  └──────────┘ └────────────┘ └────────────┘ └────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP (REST)
┌────────────────────────▼─────────────────────────────────────┐
│                     Backend (FastAPI)                         │
│                                                              │
│  ┌──────────┐ ┌────────────┐ ┌────────────────────────────┐ │
│  │Project   │ │Repo Manager│ │AI Orchestration (LangGraph)│ │
│  │CRUD      │ │- validate  │ │                            │ │
│  │          │ │- clone     │ │ parse_criteria             │ │
│  │Settings  │ │- scan      │ │      ▼                     │ │
│  │CRUD      │ │- count     │ │ build_context              │ │
│  │          │ │- detect    │ │      ▼                     │ │
│  │AC CRUD   │ │  framework │ │ match_tests (LLM call)     │ │
│  └──────────┘ └────────────┘ │      ▼                     │ │
│                              │ format_results             │ │
│  ┌──────────┐                └────────────────────────────┘ │
│  │LLM       │                                               │
│  │Service   │  ┌────────────────────────────────────────┐   │
│  │(LangChain│  │        PostgreSQL + pgvector           │   │
│  │ Anthropic│  │ projects, settings, acceptance_criteria│   │
│  │ OpenAI)  │  │ test_scripts, embeddings               │   │
│  └──────────┘  └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints (Current + Planned)

| Method | Path                                    | Status  | Description                         |
|--------|-----------------------------------------|---------|-------------------------------------|
| GET    | /health                                 | Done    | Health check                        |
| POST   | /projects/                              | Done    | Create project                      |
| GET    | /projects/                              | Done    | List projects                       |
| GET    | /projects/{id}                          | Done    | Get project                         |
| PATCH  | /projects/{id}                          | Done    | Update project (name/desc/test_path)|
| DELETE | /projects/{id}                          | Done    | Delete project                      |
| GET    | /projects/{id}/test-stats               | Done    | Scan repo, return test tree         |
| GET    | /projects/{id}/repo-dirs                | Done    | Browse dirs within a repo           |
| GET    | /system/dirs                            | Done    | Browse OS filesystem dirs           |
| GET    | /settings                               | Planned | Get LLM settings                    |
| PATCH  | /settings                               | Planned | Update LLM settings                 |
| POST   | /settings/test-connection               | Planned | Verify LLM connection               |
| POST   | /projects/{id}/acceptance-criteria      | Planned | Save AC                             |
| GET    | /projects/{id}/acceptance-criteria      | Planned | List ACs for project                |
| DELETE | /projects/{id}/acceptance-criteria/{aid}| Planned | Delete an AC                        |
| POST   | /projects/{id}/analyze                  | Planned | AI test matching                    |

## Development Guidelines

- Follow TDD — write failing tests first, then implement.
- Keep frontend, backend, and AI logic cleanly separated.
- API versioning under `/api/v1`.
- All secrets (LLM keys, JIRA tokens) via database settings or env vars, never in code.
- Commit frequently, document architectural decisions in this file.
- Complete one chunk fully before starting the next.
- Test discovery priority: user test_path > framework config > Java convention > heuristic.
- Repos must have existing test automation — this tool optimizes, not creates from scratch.
- Repo path is immutable once set — new repo = new project.

---

## Decisions Log

| Date       | Decision                                    | Rationale                                      |
|------------|---------------------------------------------|------------------------------------------------|
| 2026-09-08 | PostgreSQL + pgvector (single DB)           | Simpler ops vs separate vector DB; pgvector handles our scale |
| 2026-09-08 | Monorepo (frontend/ + backend/)             | Simpler development workflow for a single team |
| 2026-09-08 | Next.js 16 + FastAPI                        | User-specified tech stack                      |
| 2026-09-08 | BDD input + JIRA/Azure as primary input modes | Matches how QA teams typically work            |
| 2026-09-08 | Project as top-level entity                 | Projects group repo + requirements + generated scripts |
| 2026-09-08 | 6-chunk incremental delivery                | Each chunk is independently testable and demo-able |
| 2026-09-08 | Config-driven test path detection           | Read framework configs instead of guessing; user override as fallback |
| 2026-09-08 | Folder picker modal via backend API         | Browsers can't access OS filesystem paths; API-powered modal with path bar + breadcrumbs |
| 2026-09-08 | Allow projects without .git (offer git init)| Not all repos are git-initialized; prompt user and init if accepted |
| 2026-09-08 | sync subprocess.run for git init on Windows | asyncio.create_subprocess_exec fails in FastAPI's event loop on Windows |
| 2026-09-08 | LangGraph + LangChain for AI orchestration  | Graph-based workflow is extensible; LangChain gives provider abstraction (Anthropic/OpenAI) |
| 2026-09-08 | User-configurable LLM via settings page     | No hardcoded provider; user provides their own API key; connection validated before save |
