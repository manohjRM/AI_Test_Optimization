# ABOUTME: LangGraph workflow for matching acceptance criteria to existing tests.
# ABOUTME: Parses BDD input, builds repo context, invokes LLM, and returns structured matches.

import json
from pathlib import Path
from typing import Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from app.services.repo_manager import count_test_files

ANALYSIS_SYSTEM_PROMPT = """You are a test analysis assistant. Your job is to analyze acceptance criteria (BDD format) and find which existing test cases in a repository are related to those criteria.

You will receive:
1. Acceptance criteria (Given/When/Then or similar BDD format)
2. A list of existing test files with their test function/case names

For each related test, explain WHY it's related and classify the relevance:
- "direct": The test directly validates the acceptance criteria
- "partial": The test covers part of the criteria or a closely related scenario
- "related": The test is in the same functional area but doesn't directly validate the criteria

Respond ONLY with valid JSON in this exact format:
{
  "matches": [
    {
      "file_path": "path/to/test_file.py",
      "test_name": "test_function_name",
      "relevance": "direct|partial|related",
      "explanation": "Why this test is related to the acceptance criteria"
    }
  ],
  "summary": "Brief summary of the analysis",
  "suggestions": ["Suggestion for improving test coverage based on the criteria"]
}

If no existing tests match the criteria, return an empty matches array with a summary explaining that no related tests were found and suggestions for what tests should be created."""


class AnalysisState(TypedDict):
    ac_content: str
    repo_path: str
    test_path: str | None
    test_tree: list[dict]
    test_context: str
    llm_response: str
    result: dict
    llm: Any


def parse_criteria(state: AnalysisState) -> dict:
    """No transformation needed — the raw BDD text is passed directly to the LLM."""
    return state


def build_context(state: AnalysisState) -> dict:
    """Scan the repo and build a formatted test context string for the LLM."""
    repo_path = Path(state["repo_path"])
    stats = count_test_files(repo_path, test_path=state.get("test_path"))
    test_tree = stats.get("test_tree", [])

    context_parts: list[str] = []
    context_parts.append(f"Frameworks detected: {', '.join(stats.get('frameworks', []))}")
    context_parts.append(f"Total test files: {stats.get('total_files', 0)}")
    context_parts.append(f"Total test cases: {stats.get('total_tests', 0)}")
    context_parts.append("")

    for directory in test_tree:
        context_parts.append(f"Directory: {directory['directory']}")
        for file_info in directory["files"]:
            context_parts.append(f"  File: {file_info['path']}")
            for test_name in file_info["tests"]:
                context_parts.append(f"    - {test_name}")
        context_parts.append("")

    return {
        **state,
        "test_tree": test_tree,
        "test_context": "\n".join(context_parts),
    }


async def match_tests(state: AnalysisState) -> dict:
    """Invoke the LLM to find related tests. Requires 'llm' in config."""
    llm: BaseChatModel = state["llm"]  # type: ignore[typeddict-item]

    user_message = f"""## Acceptance Criteria

{state["ac_content"]}

## Existing Test Cases in Repository

{state["test_context"]}

Analyze the acceptance criteria and find which existing tests are related. Return your response as JSON."""

    response = await llm.ainvoke([
        SystemMessage(content=ANALYSIS_SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ])

    return {**state, "llm_response": response.content}


def format_results(state: AnalysisState) -> dict:
    """Parse the LLM response into structured analysis results."""
    raw = state.get("llm_response", "")

    try:
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        parsed = json.loads(cleaned.strip())
    except (json.JSONDecodeError, ValueError):
        parsed = {
            "matches": [],
            "summary": "Failed to parse LLM response",
            "suggestions": ["Try rephrasing the acceptance criteria"],
        }

    for match in parsed.get("matches", []):
        if match.get("relevance") not in ("direct", "partial", "related"):
            match["relevance"] = "related"

    return {
        **state,
        "result": {
            "matches": parsed.get("matches", []),
            "summary": parsed.get("summary", ""),
            "suggestions": parsed.get("suggestions", []),
        },
    }


def build_analysis_graph() -> StateGraph:
    """Construct the LangGraph workflow for test analysis."""
    graph = StateGraph(AnalysisState)

    graph.add_node("parse_criteria", parse_criteria)
    graph.add_node("build_context", build_context)
    graph.add_node("match_tests", match_tests)
    graph.add_node("format_results", format_results)

    graph.set_entry_point("parse_criteria")
    graph.add_edge("parse_criteria", "build_context")
    graph.add_edge("build_context", "match_tests")
    graph.add_edge("match_tests", "format_results")
    graph.add_edge("format_results", END)

    return graph.compile()


_compiled_graph = None


def get_analysis_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_analysis_graph()
    return _compiled_graph


async def find_related_tests(
    ac_content: str,
    repo_path: str,
    test_path: str | None,
    llm: BaseChatModel,
) -> dict:
    """Run the analysis workflow and return structured results."""
    graph = get_analysis_graph()

    initial_state = {
        "ac_content": ac_content,
        "repo_path": repo_path,
        "test_path": test_path,
        "test_tree": [],
        "test_context": "",
        "llm_response": "",
        "result": {},
        "llm": llm,
    }

    final_state = await graph.ainvoke(initial_state)
    return final_state.get("result", {
        "matches": [],
        "summary": "Analysis failed",
        "suggestions": [],
    })
