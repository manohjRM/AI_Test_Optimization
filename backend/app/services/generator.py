# ABOUTME: AI service for generating and modifying test scripts.
# ABOUTME: Uses functional_summary as guardrails, invokes LLM with appropriate prompts.

from pathlib import Path

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


def _extract_code(response_text: str) -> str:
    """Extract code from LLM response, stripping markdown fences if present."""
    text = response_text.strip()
    if text.startswith("```"):
        first_newline = text.index("\n") if "\n" in text else 3
        text = text[first_newline + 1:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


async def modify_test_script(
    file_content: str,
    file_path: str,
    modifications_needed: list[str],
    ac_content: str,
    functional_summary: str,
    llm: BaseChatModel,
) -> str:
    """Invoke the LLM to modify an existing test file based on required changes."""
    system_prompt = _load_prompt("script_modify_system.md")
    user_template = _load_prompt("script_modify_user.md")
    user_message = user_template.format(
        file_path=file_path,
        file_content=file_content,
        modifications_needed="\n".join(f"- {m}" for m in modifications_needed),
        ac_content=ac_content,
        functional_summary=functional_summary,
    )
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ])
    return _extract_code(response.content)


async def generate_test_script(
    scenario_name: str,
    scenario_type: str,
    description: str,
    steps: list[str],
    suggested_file: str,
    existing_file_content: str | None,
    ac_content: str,
    functional_summary: str,
    llm: BaseChatModel,
) -> str:
    """Invoke the LLM to generate a new test or append to an existing file."""
    system_prompt = _load_prompt("script_generate_system.md")
    user_template = _load_prompt("script_generate_user.md")

    mode = "append_to_existing" if existing_file_content else "new_file"
    user_message = user_template.format(
        scenario_name=scenario_name,
        scenario_type=scenario_type,
        description=description,
        steps="\n".join(steps),
        suggested_file=suggested_file,
        mode=mode,
        existing_file_content=existing_file_content or "(This is a new file -- no existing content)",
        ac_content=ac_content,
        functional_summary=functional_summary,
    )
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ])
    return _extract_code(response.content)
