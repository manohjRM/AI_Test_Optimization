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
User Input
    │
    ├─► Option A: Paste acceptance criteria (BDD format) into text box
    │
    └─► Option B: Provide a JIRA / Azure DevOps ticket number
                   → Tool fetches AC / requirements via API
    │
    ▼
Provide Target Repository
    │
    ├─► Option A: Local repo path (already on disk)
    │
    └─► Option B: Git remote URL
                   → Tool clones the repo locally
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

## Milestone 1 — MVP Checklist

### 1. User Input — Acceptance Criteria

- [ ] Text input area that accepts BDD-format acceptance criteria (Given/When/Then)
- [ ] JIRA integration: user provides ticket number, tool fetches AC via JIRA REST API
- [ ] Azure DevOps integration: user provides work item ID, tool fetches AC via Azure API
- [ ] Input validation and preview before proceeding
- [ ] Store the fetched/pasted requirements for the session

### 2. Target Repository — Source Code Access

- [ ] Input field for local repository path (directory picker or text input)
- [ ] Input field for git remote URL (HTTPS or SSH)
- [ ] Clone remote repos to a managed temp/workspace directory on the backend
- [ ] Validate that the path/repo exists and is accessible
- [ ] Detect test framework and language from the repo (pytest, playwright, jest, junit, etc.)
- [ ] Scan repo structure: find existing test directories, config files, patterns

### 3. AI Orchestration — Script Generation

- [ ] Parse BDD acceptance criteria into structured test scenarios
- [ ] Analyze existing test code for patterns, conventions, and reusable utilities
- [ ] Generate new test scripts that match the repo's existing style and framework
- [ ] Modify existing test scripts when the AC updates existing functionality
- [ ] Validate generated code for syntax correctness
- [ ] Provide explanation of decisions made during generation

### 4. Output — Results & Actions

- [ ] Display generated/modified scripts in a code viewer with syntax highlighting
- [ ] Show diff view when modifying existing scripts
- [ ] Copy to clipboard functionality
- [ ] Download generated files
- [ ] Show AI explanation and suggestions alongside the code

### 5. Infrastructure & Plumbing

- [ ] PostgreSQL + pgvector database setup and migrations (Alembic)
- [ ] Backend API endpoints for the full flow (input → repo → generate → output)
- [ ] Frontend pages and components for each step of the flow
- [ ] Error handling and user feedback throughout the pipeline
- [ ] Environment configuration (.env, secrets management for JIRA/Azure tokens)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  Input    │  │  Repo    │  │  Results Viewer   │ │
│  │  Form     │→ │  Config  │→ │  (code + diff +   │ │
│  │  (BDD/    │  │  (local/ │  │   explanation)    │ │
│  │   JIRA/   │  │   git)   │  │                   │ │
│  │   Azure)  │  │          │  │                   │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (REST)
┌────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  JIRA /  │  │  Repo    │  │  AI Orchestrator  │ │
│  │  Azure   │  │  Manager │  │                   │ │
│  │  Client  │  │  (clone/ │  │  - Parse BDD      │ │
│  │          │  │   scan)  │  │  - Analyze repo   │ │
│  └──────────┘  └──────────┘  │  - Generate code  │ │
│                              └───────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │           PostgreSQL + pgvector              │   │
│  │  (requirements, scripts, embeddings, history)│   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Development Guidelines

- Follow TDD — write failing tests first, then implement.
- Keep frontend, backend, and AI logic cleanly separated.
- API versioning under `/api/v1`.
- All secrets (JIRA tokens, Azure PATs, LLM keys) via environment variables, never in code.
- Commit frequently, document architectural decisions in this file.

---

## Decisions Log

| Date       | Decision                                    | Rationale                                      |
|------------|---------------------------------------------|------------------------------------------------|
| 2026-09-08 | PostgreSQL + pgvector (single DB)           | Simpler ops vs separate vector DB; pgvector handles our scale |
| 2026-09-08 | Monorepo (frontend/ + backend/)             | Simpler development workflow for a single team |
| 2026-09-08 | Next.js 16 + FastAPI                        | User-specified tech stack                      |
| 2026-09-08 | BDD input + JIRA/Azure as primary input modes | Matches how QA teams typically work            |
