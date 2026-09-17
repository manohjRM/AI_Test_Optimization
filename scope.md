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
| LLM Providers   | Anthropic Claude / OpenAI GPT / OpenAI-compatible (user-configurable) |

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
        └─► GitHub URL (HTTPS with PAT or SSH) → tool clones it locally
    │
    │  Validation: must have test automation (test dirs, config files, test files)
    │  If no .git: prompt user → run git init if accepted
    │
    ▼
Project Detail (inside a project)
    │
    ├─► Edit name/description (repo path is read-only)
    ├─► Application Summary (business + functional, generated from test suite)
    ├─► Test Suite: auto-detected test stats + explorer tree
    │   ├─► Config-driven detection (reads playwright.config, cypress.config, etc.)
    │   ├─► Manual test path override via directory browser if auto-detection fails
    │   └─► Shows: file count, test count, frameworks, file→function tree
    │
    ├─► Acceptance Criteria management:
    │   ├─► Paste BDD (Given/When/Then) in text box → Save
    │   ├─► Edit / Delete saved criteria
    │   ├─► Analyze individual AC or Analyze All at once
    │   └─► (Future) JIRA / Azure DevOps ticket number → fetch AC
    │
    ▼
AI Analysis (LangGraph workflow)
    │
    ├─► Parse BDD acceptance criteria into scenarios
    ├─► Build context from repo test tree + business summary
    ├─► Invoke LLM to match AC against existing tests
    └─► Return structured actionable output:
        ├─► Direct matches (no changes needed)
        ├─► Required changes (with specific modification list per test)
        ├─► Missing scenarios (with BDD steps, priority, type, suggested file)
        └─► Coverage assessment
    │
    ▼
Output
    │
    ├─► Interactive coverage cards (click to expand details)
    ├─► Per-AC: View persisted results, Download HTML report
    ├─► Download All: consolidated styled HTML report across all ACs
    ├─► (Future) Generate or modify test scripts
    └─► (Future) Run tests from the tool via CLI
```

---

## What's Built (Completed)

### Chunk 1: Project Management + Repo Setup [DONE]
- [x] Dashboard page — lists all projects as cards with status badges
- [x] Create Project page with name, description, repo source toggle
- [x] Folder picker modal (path bar, breadcrumbs, lazy-loading OS directory tree)
- [x] Project card on dashboard showing name, repo info, status, created date
- [x] Project model (id, name, description, repo_type, repo_url, local_path, repo_status, repo_error, test_path, business_summary, functional_summary)
- [x] CRUD endpoints: POST/GET/PATCH/DELETE /projects, GET /projects/{id}
- [x] Local path validation (exists, is directory, has test automation)
- [x] Git init support: if no .git detected, prompt user → run git init → create project
- [x] GitHub clone: sync subprocess with --depth 1, 600s timeout, GIT_TERMINAL_PROMPT=0
- [x] GitHub auth: Basic auth via http.extraHeader for HTTPS, SSH URL support (git@...)
- [x] PostgreSQL + Alembic migrations
- [x] System directory browser endpoint (GET /system/dirs) for folder picker

### Chunk 1.5: Project Detail Page [DONE]
- [x] Editable name/description with Save button (repo path read-only)
- [x] Delete project with confirmation → redirect to dashboard
- [x] Repository section: type, URL, local path, status badge (read-only)
- [x] Test Suite section with auto-refresh:
  - [x] Summary cards: test files, test cases, frameworks
  - [x] Detected frameworks tags
  - [x] Test Explorer tree: collapsible directories → files → test function names
  - [x] Config-driven test path detection (reads playwright.config, cypress.config, jest.config, vitest.config, Maven/Gradle/Gradle.kts conventions)
  - [x] Manual test_path override via in-repo directory browser when auto-detection fails
  - [x] Test path shown as tag with clear button
- [x] Run Tests stub (disabled button, "coming soon")

### Test Discovery Capabilities [DONE]
- [x] Config-based detection priority: user test_path > framework config > Java convention > heuristic
- [x] Supported frameworks: pytest, jest, vitest, playwright, cypress, mocha, karma, phpunit, junit, cucumber
- [x] File patterns: test_*.py, *_test.py, *.test.ts/js, *.spec.ts/js, *.cy.ts/js, *.feature, *Test.java, *Test.kt, *Tests.cs, *_test.go
- [x] Test name extraction: Python (def test_*), JS/TS (it/test/describe), Java/Kotlin (@Test), Go (func Test*), C# ([Test]/[Fact]), Gherkin (Scenario/Scenario Outline)
- [x] Excluded dirs: .venv, node_modules, .git, __pycache__, dist, build, etc.
- [x] p.is_file() filter to prevent directory false matches

### Chunk 2: LLM Settings + BDD Input + AI Test Matching [DONE]

#### Part 1: LLM Settings
- [x] Settings model (single-row: llm_provider, llm_base_url, llm_api_key, llm_model)
- [x] Schemas: SettingsRead (key masked as has_api_key bool), SettingsUpdate, ConnectionTestRequest, ConnectionTestResult
- [x] GET /settings, PATCH /settings, POST /settings/test-connection
- [x] LLM service (llm.py): LangChain ChatModel factory supporting anthropic, openai, openai_compatible providers
- [x] Connection test: minimal LLM call to verify key/model before save
- [x] Settings page: provider dropdown, base URL (required for openai_compatible, toggleable for others), API key (password), model (free text), test connection, save (disabled until verified), back to dashboard
- [x] Settings gear icon on dashboard header

#### Part 2: BDD Input on Project Detail
- [x] AcceptanceCriteria model (id, project_id FK CASCADE, content, analysis_result JSONB, created_at, updated_at)
- [x] Schemas: ACCreate, ACRead (includes analysis_result)
- [x] POST /projects/{id}/acceptance-criteria (create)
- [x] GET /projects/{id}/acceptance-criteria (list)
- [x] PATCH /projects/{id}/acceptance-criteria/{aid} (update content)
- [x] DELETE /projects/{id}/acceptance-criteria/{aid}
- [x] Acceptance Criteria section on project detail page:
  - [x] Textarea for BDD input + Save Criteria button
  - [x] List of saved ACs with inline Edit (textarea swap), Delete, Analyze buttons
  - [x] View button to load persisted analysis result without re-running LLM
  - [x] Download button (per-AC) for styled HTML report
  - [x] Analyze All button — runs analysis on every saved AC sequentially with progress (1/N...)
  - [x] Download All button — consolidated HTML report combining all analyzed ACs

#### Part 3: AI Test Matching (LangGraph)
- [x] LangGraph workflow (analyzer.py) with nodes: parse_criteria → build_context → match_tests → format_results
- [x] LLM prompts stored as separate .md files in backend/app/prompts/ (easy to edit without code changes):
  - [x] analysis_system.md — structured analysis with rules for matches, missing scenarios, coverage
  - [x] analysis_user.md — template with {ac_content}, {business_summary}, {test_context}
  - [x] business_summary_system.md / business_summary_user.md
  - [x] functional_summary_system.md / functional_summary_user.md (guardrails for script generation agent)
- [x] Structured analysis output:
  - [x] matches: existing tests with relevance (direct / required changes) and modifications_needed list
  - [x] missing_scenarios: new tests with scenario_name, type (positive/negative/edge_case/boundary), description, BDD steps, priority (high/medium/low), suggested_file
  - [x] coverage_assessment: covered / partially_covered / not_covered lists
  - [x] summary: overall analysis text
- [x] Analysis result persisted as JSONB on acceptance_criteria record
- [x] POST /projects/{id}/analyze — accepts ac_id, returns structured AnalysisResult, saves to DB, auto-refreshes summaries
- [x] Business summary passed to analysis prompt for AC validation context

#### Application Summary
- [x] Two summaries generated in parallel from the test suite:
  - [x] Business summary: what the app does (business perspective) — used to validate AC appropriateness
  - [x] Functional summary: testing conventions as guardrails — framework, directory structure, file naming, test script patterns, rules for new test creation
- [x] Persisted on project record (business_summary, functional_summary columns)
- [x] POST /projects/{id}/generate-summary endpoint
- [x] Auto-refreshed after each AC analysis
- [x] Displayed in a popup modal with tabbed Business/Functional views
- [x] Generate / Regenerate button on project detail page

#### Analysis Results UI
- [x] Coverage cards derived from real data (not LLM text):
  - [x] Covered = direct match count
  - [x] Partially Covered = required changes count
  - [x] Not Covered = missing scenarios count
- [x] Cards are clickable toggles — expand/collapse detail panels
- [x] Direct match panel: test name, file path, explanation
- [x] Required changes panel: + modifications needed bullet list
- [x] Missing scenarios panel: grouped by priority (high/medium/low), with BDD steps, type badge, suggested file

#### HTML Report Download
- [x] Per-AC download: styled HTML with dark mode, stat tiles, color-coded cards
- [x] Download All: consolidated report with aggregate stats, table of contents with per-AC mini stats + anchor links, per-AC sections with dividers
- [x] Full-width responsive layout: CSS grid card layout (auto-fill, min 400px), word-break for long paths, print-friendly

---

## Future Chunks

### Chunk 3: AI Script Generation + Modification
> AI generates new test scripts or modifies existing ones based on BDD + repo context.
> The functional summary serves as guardrails — the generation agent follows the repo's conventions for directory placement, file naming, script structure, imports, and tags.

- [ ] Generate new test scripts for missing_scenarios (consume steps, type, suggested_file from analysis)
- [ ] Modify existing scripts for required_changes (consume modifications_needed list)
- [ ] Use functional summary as generation constraints (framework, patterns, skeleton template)
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
│  │ + settings│ │(name+repo  │ │(summary +  │ │(provider + │ │
│  │  icon)    │ │ + browse)  │ │ AC input + │ │ base URL + │ │
│  │           │ │            │ │ test tree +│ │ key+model) │ │
│  │           │ │            │ │ AI results+│ │            │ │
│  │           │ │            │ │ download)  │ │            │ │
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
│  │(+update) │ └────────────┘ │      ▼                     │ │
│  └──────────┘                │ format_results             │ │
│                              └────────────────────────────┘ │
│  ┌──────────┐  ┌──────────┐                                 │
│  │LLM       │  │Prompts   │  ┌────────────────────────────┐ │
│  │Service   │  │(.md files│  │      PostgreSQL + pgvector  │ │
│  │(LangChain│  │ analysis │  │ projects (+ summaries)     │ │
│  │ Anthropic│  │ business │  │ settings                   │ │
│  │ OpenAI   │  │ function)│  │ acceptance_criteria        │ │
│  │ Compat.) │  └──────────┘  │   (+ analysis_result JSONB)│ │
│  └──────────┘                └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path                                    | Status  | Description                              |
|--------|-----------------------------------------|---------|------------------------------------------|
| GET    | /health                                 | Done    | Health check                             |
| POST   | /projects/                              | Done    | Create project                           |
| GET    | /projects/                              | Done    | List projects                            |
| GET    | /projects/{id}                          | Done    | Get project                              |
| PATCH  | /projects/{id}                          | Done    | Update project (name/desc/test_path)     |
| DELETE | /projects/{id}                          | Done    | Delete project                           |
| GET    | /projects/{id}/test-stats               | Done    | Scan repo, return test tree              |
| GET    | /projects/{id}/repo-dirs                | Done    | Browse dirs within a repo                |
| POST   | /projects/{id}/generate-summary         | Done    | Generate business + functional summaries |
| POST   | /projects/{id}/acceptance-criteria      | Done    | Save AC                                  |
| GET    | /projects/{id}/acceptance-criteria      | Done    | List ACs for project (with results)      |
| PATCH  | /projects/{id}/acceptance-criteria/{aid}| Done    | Update AC content                        |
| DELETE | /projects/{id}/acceptance-criteria/{aid}| Done    | Delete an AC                             |
| POST   | /projects/{id}/analyze                  | Done    | AI test matching (saves result to AC)    |
| GET    | /system/dirs                            | Done    | Browse OS filesystem dirs                |
| GET    | /settings                               | Done    | Get LLM settings                         |
| PATCH  | /settings                               | Done    | Update LLM settings                      |
| POST   | /settings/test-connection               | Done    | Verify LLM connection                    |

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/repo_manager.py` | Test discovery: config-driven detection, file scanning, test name extraction |
| `backend/app/services/analyzer.py` | LangGraph workflow + summary generation |
| `backend/app/services/llm.py` | LangChain ChatModel factory + connection test |
| `backend/app/prompts/*.md` | All LLM prompts (analysis, business summary, functional summary) |
| `backend/app/api/v1/endpoints/projects.py` | Project + AC + analysis + summary endpoints |
| `backend/app/api/v1/endpoints/settings.py` | Settings CRUD + test connection |
| `frontend/src/app/projects/[id]/page.tsx` | Project detail page (AC, analysis, summaries, reports) |
| `frontend/src/app/settings/page.tsx` | LLM settings configuration |

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
- LLM prompts live as .md files in backend/app/prompts/ — edit prompts without touching code.
- Functional summary serves as guardrails for the script generation agent.
- Analysis results are persisted per-AC as JSONB for retrieval without re-running the LLM.

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
| 2026-09-09 | OpenAI-compatible provider support          | Users with self-hosted or third-party OpenAI-API-compatible endpoints (e.g., Ollama, LM Studio) |
| 2026-09-09 | Basic auth for GitHub HTTPS clone           | GitHub needs Basic auth (not Bearer); base64 x-access-token:PAT via http.extraHeader |
| 2026-09-09 | SSH URL support for git clone               | Org policies may block fine-grained PATs; SSH uses local keys, no token needed |
| 2026-09-10 | LLM prompts as separate .md files           | Easier to review and modify prompts without touching Python code |
| 2026-09-10 | Relevance categories: direct / required changes / no match | More actionable than direct/partial/related — maps to downstream actions |
| 2026-09-11 | Split summary into business + functional    | Business validates AC appropriateness; functional provides guardrails for script generation |
| 2026-09-11 | Enhanced analysis output with modifications_needed + missing_scenarios | Directly consumable by future script generation: each missing scenario has BDD steps, type, priority, suggested file |
| 2026-09-11 | Coverage cards derived from match/scenario counts | LLM coverage_assessment text drifted from actual data; cards now use real array lengths |
| 2026-09-11 | Summary in popup modal                      | Summaries can be large for big repos; modal keeps project detail page clean |
| 2026-09-17 | Functional summary as generation guardrails | Prompt extracts framework, directory structure, file naming, script patterns, and explicit rules for new test creation |
| 2026-09-17 | Inline edit for acceptance criteria          | Users need to refine BDD text without delete-and-recreate |
| 2026-09-17 | Analysis result persisted as JSONB on AC    | Avoids re-running LLM; View button loads saved result; Download works from persisted data |
| 2026-09-17 | HTML report download (single + all)         | Styled, dark-mode-aware, full-width responsive report with stat tiles, card grid, TOC for combined report |
| 2026-09-17 | Analyze All button                          | Runs analysis sequentially on every AC with progress indicator; refreshes all results in DB |
