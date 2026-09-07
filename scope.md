# AI-Driven Regression Test Script Optimizer

This document is the project brain — scope, architecture, flow, and checklists all live here.

---

## Project Goal

A tool that takes user input (acceptance criteria, typically in BDD format), analyzes an existing test codebase, and uses AI to generate or modify regression test scripts. The system reduces manual effort, improves coverage, and accelerates the regression testing cycle.

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 16 (TypeScript, Tailwind)   |
| Backend     | FastAPI (Python 3.13, uv)           |
| Database    | PostgreSQL + pgvector               |
| AI          | LLM orchestration (provider TBD)    |

## Core Flow (Milestone 1 — MVP)

```
Dashboard (landing page)
    │
    │  List of existing projects
    │  [Create Project] button
    │
    ▼
Create Project
    │
    ├─► Project name + description
    └─► Repository (MANDATORY — pick one):
        ├─► Option A: Local repo path (already on disk)
        └─► Option B: GitHub repo URL → tool clones it locally
    │
    ▼
Project Detail (inside a project)
    │
    ├─► Provide acceptance criteria:
    │   ├─► Option A: Paste BDD (Given/When/Then) in text box
    │   └─► Option B: JIRA / Azure DevOps ticket number → fetch AC
    │
    ▼
AI Orchestration
    │
    ├─► Analyze the provided acceptance criteria
    ├─► Scan the target repo for existing test structure, patterns, frameworks
    └─► Generate or modify test scripts that satisfy the criteria
    │
    ▼
Output
    │
    ├─► Display generated / modified test scripts in the UI
    ├─► Show explanation of what was generated and why
    └─► Allow user to copy, download, or push changes
```

---

## Delivery Chunks

Development is split into incremental chunks. Each chunk produces a testable, demo-able outcome before the next one starts.

### Chunk 1: Project Management + Repo Setup
> **Goal:** User can create and list projects tied to a repository.

**Frontend:**
- [ ] Dashboard page (landing page) — lists all projects
- [ ] "Create Project" button on dashboard
- [ ] Create Project page/form with:
  - [ ] Project name (required)
  - [ ] Description (optional)
  - [ ] Repo source toggle: "Local Path" vs "GitHub URL" (required)
  - [ ] Input field for local path OR GitHub URL based on toggle
  - [ ] Form validation — repo field is mandatory
  - [ ] Submit → creates project → redirects to dashboard
- [ ] Project card/row on dashboard showing name, repo info, created date
- [ ] Click project → navigates to project detail page (placeholder for Chunk 2)

**Backend:**
- [ ] `Project` model (id, name, description, repo_type, repo_url, local_path, status, created_at, updated_at)
- [ ] `Project` Pydantic schemas (create, read, update)
- [ ] CRUD API endpoints: POST /projects, GET /projects, GET /projects/{id}, DELETE /projects/{id}
- [ ] Local path validation — check directory exists and contains a git repo
- [ ] GitHub clone — clone remote repo to managed workspace directory
- [ ] Return repo status (valid, cloning, cloned, error) in project response

**Infrastructure:**
- [ ] PostgreSQL database setup + Alembic migration for `projects` table
- [ ] Managed workspace directory for cloned repos (configurable path)

**Definition of Done:** User can open the app, see an empty dashboard, click "Create Project", provide a name + local repo path or GitHub URL, submit, and see the project appear on the dashboard with correct repo status.

---

### Chunk 2: BDD Input + Repo Scanning
> **Goal:** Inside a project, user provides acceptance criteria and the system scans the repo.

- [ ] Project detail page with input area for BDD acceptance criteria
- [ ] Framework/language auto-detection from repo scan
- [ ] Display repo structure and detected test setup
- [ ] Store acceptance criteria per project in database
- [ ] JIRA integration: fetch AC from ticket number
- [ ] Azure DevOps integration: fetch AC from work item ID

**Definition of Done:** User opens a project, sees the detected repo structure/framework, enters BDD criteria (or fetches from JIRA/Azure), and the system stores it ready for AI processing.

---

### Chunk 3: AI Orchestration — Script Generation
> **Goal:** AI generates or modifies test scripts based on BDD input + repo context.

- [ ] Connect LLM provider
- [ ] Parse BDD into structured test scenarios
- [ ] Analyze existing test code for patterns, conventions, utilities
- [ ] Generate new test scripts matching repo style and framework
- [ ] Modify existing scripts when AC updates existing functionality
- [ ] Validate generated code for syntax correctness
- [ ] Provide explanation of generation decisions

**Definition of Done:** User submits BDD criteria in a project, and the AI produces test scripts that match the repo's existing style and framework.

---

### Chunk 4: Output & Review Experience
> **Goal:** Polished UI for reviewing, copying, and downloading generated scripts.

- [ ] Syntax-highlighted code viewer
- [ ] Diff view when modifying existing scripts
- [ ] Copy to clipboard
- [ ] Download generated files
- [ ] AI explanation and suggestions panel

**Definition of Done:** User can review generated scripts with proper syntax highlighting, see diffs, copy code, and download files.

---

### Chunk 5: JIRA / Azure DevOps Integration
> **Goal:** Fetch acceptance criteria directly from issue trackers.

- [ ] JIRA REST API client (authenticate, fetch ticket AC)
- [ ] Azure DevOps API client (authenticate, fetch work item AC)
- [ ] Settings page for API tokens/URLs
- [ ] Auto-populate input form from fetched data

**Definition of Done:** User enters a JIRA ticket or Azure work item ID, and the AC auto-populates in the project.

---

### Chunk 6: Git Remote Clone Support
> **Goal:** Robustly handle cloning and lifecycle of remote repos.

- [ ] Clone progress feedback in UI
- [ ] SSH key / token authentication for private repos
- [ ] Cleanup lifecycle for old cloned repos
- [ ] Re-pull / refresh support for already-cloned repos

**Definition of Done:** User provides a private or public GitHub URL, sees clone progress, and the repo is available for scanning.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                    │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Dashboard   │  │ Create       │  │ Project Detail   │ │
│  │ (project    │→ │ Project      │→ │ (BDD input +     │ │
│  │  list)      │  │ (name+repo)  │  │  results viewer) │ │
│  └────────────┘  └──────────────┘  └──────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (REST)
┌──────────────────────▼───────────────────────────────────┐
│                    Backend (FastAPI)                      │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Project    │  │ Repo Manager │  │ AI Orchestrator  │ │
│  │ CRUD       │  │ (validate /  │  │                  │ │
│  │            │  │  clone /     │  │ - Parse BDD      │ │
│  │            │  │  scan)       │  │ - Analyze repo   │ │
│  └────────────┘  └──────────────┘  │ - Generate code  │ │
│                                    └──────────────────┘ │
│  ┌────────────┐                                         │
│  │ JIRA /     │                                         │
│  │ Azure      │  ┌──────────────────────────────────┐   │
│  │ Client     │  │     PostgreSQL + pgvector         │   │
│  └────────────┘  │ (projects, scripts, embeddings)   │   │
│                  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Development Guidelines

- Follow TDD — write failing tests first, then implement.
- Keep frontend, backend, and AI logic cleanly separated.
- API versioning under `/api/v1`.
- All secrets (JIRA tokens, Azure PATs, LLM keys) via environment variables, never in code.
- Commit frequently, document architectural decisions in this file.
- Complete one chunk fully before starting the next.

---

## Decisions Log

| Date       | Decision                                    | Rationale                                      |
|------------|---------------------------------------------|------------------------------------------------|
| 2026-09-08 | PostgreSQL + pgvector (single DB)           | Simpler ops vs separate vector DB; pgvector handles our scale |
| 2026-09-08 | Monorepo (frontend/ + backend/)             | Simpler development workflow for a single team |
| 2026-09-08 | Next.js 16 + FastAPI                        | User-specified tech stack                      |
| 2026-09-08 | BDD input + JIRA/Azure as primary input modes | Matches how QA teams typically work            |
| 2026-09-08 | Project as top-level entity                 | Projects group repo + requirements + generated scripts; dashboard is the landing page |
| 2026-09-08 | 6-chunk incremental delivery                | Each chunk is independently testable and demo-able before moving on |
