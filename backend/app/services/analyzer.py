# ABOUTME: LangGraph workflow for matching acceptance criteria to existing tests.
# ABOUTME: Parses BDD input, builds repo context, invokes LLM, and returns structured matches.

import json
from pathlib import Path
from typing import Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from app.services.repo_manager import count_test_files

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


class AnalysisState(TypedDict):
    ac_content: str
    repo_path: str
    test_path: str | None
    business_summary: str
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

    system_prompt = _load_prompt("analysis_system.md")
    user_template = _load_prompt("analysis_user.md")
    business_summary = state.get("business_summary", "")
    user_message = user_template.format(
        ac_content=state["ac_content"],
        business_summary=business_summary if business_summary else "No business summary available yet.",
        test_context=state["test_context"],
    )

    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ])

    return {**state, "llm_response": response.content}


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def format_results(state: AnalysisState) -> dict:
    """Parse the LLM response into structured analysis results."""
    raw = state.get("llm_response", "")

    try:
        parsed = json.loads(_strip_code_fences(raw))
    except (json.JSONDecodeError, ValueError):
        parsed = {
            "matches": [],
            "missing_scenarios": [],
            "summary": "Failed to parse LLM response",
            "coverage_assessment": None,
        }

    _VALID_RELEVANCE = {"direct", "required changes"}
    for match in parsed.get("matches", []):
        if match.get("relevance") not in _VALID_RELEVANCE:
            match["relevance"] = "required changes"
        if not isinstance(match.get("modifications_needed"), list):
            match["modifications_needed"] = []

    _VALID_TYPES = {"positive", "negative", "edge_case", "boundary"}
    _VALID_PRIORITIES = {"high", "medium", "low"}
    for scenario in parsed.get("missing_scenarios", []):
        if scenario.get("type") not in _VALID_TYPES:
            scenario["type"] = "positive"
        if scenario.get("priority") not in _VALID_PRIORITIES:
            scenario["priority"] = "medium"
        if not isinstance(scenario.get("steps"), list):
            scenario["steps"] = []

    return {
        **state,
        "result": {
            "matches": parsed.get("matches", []),
            "missing_scenarios": parsed.get("missing_scenarios", []),
            "summary": parsed.get("summary", ""),
            "coverage_assessment": parsed.get("coverage_assessment"),
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


def _build_test_context(repo_path: str, test_path: str | None) -> str:
    """Build a formatted test context string from the repo's test tree."""
    stats = count_test_files(Path(repo_path), test_path=test_path)
    test_tree = stats.get("test_tree", [])

    parts: list[str] = []
    parts.append(f"Frameworks detected: {', '.join(stats.get('frameworks', []))}")
    parts.append(f"Total test files: {stats.get('total_files', 0)}")
    parts.append(f"Total test cases: {stats.get('total_tests', 0)}")
    parts.append("")

    for directory in test_tree:
        parts.append(f"Directory: {directory['directory']}")
        for file_info in directory["files"]:
            parts.append(f"  File: {file_info['path']}")
            for test_name in file_info["tests"]:
                parts.append(f"    - {test_name}")
        parts.append("")

    return "\n".join(parts)


async def generate_summaries(
    repo_path: str,
    test_path: str | None,
    llm: BaseChatModel,
) -> dict[str, str]:
    """Generate business and functional summaries from the test suite."""
    test_context = _build_test_context(repo_path, test_path)

    business_sys = _load_prompt("business_summary_system.md")
    business_user = _load_prompt("business_summary_user.md").format(test_context=test_context)

    functional_sys = _load_prompt("functional_summary_system.md")
    functional_user = _load_prompt("functional_summary_user.md").format(test_context=test_context)

    import asyncio
    business_resp, functional_resp = await asyncio.gather(
        llm.ainvoke([SystemMessage(content=business_sys), HumanMessage(content=business_user)]),
        llm.ainvoke([SystemMessage(content=functional_sys), HumanMessage(content=functional_user)]),
    )

    return {
        "business_summary": business_resp.content,
        "functional_summary": functional_resp.content,
    }


async def find_related_tests(
    ac_content: str,
    repo_path: str,
    test_path: str | None,
    llm: BaseChatModel,
    business_summary: str = "",
) -> dict:
    """Run the analysis workflow and return structured results."""
    graph = get_analysis_graph()

    initial_state = {
        "ac_content": ac_content,
        "repo_path": repo_path,
        "test_path": test_path,
        "business_summary": business_summary,
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
