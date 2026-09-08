# ABOUTME: LLM provider abstraction using LangChain's ChatModel interface.
# ABOUTME: Supports Anthropic, OpenAI, and any OpenAI-compatible provider via custom base URL.

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage


SUPPORTED_PROVIDERS = {
    "anthropic": {
        "description": "Anthropic (Claude)",
        "placeholder_models": "claude-sonnet-4-20250514, claude-haiku-4-20250514, claude-opus-4-20250514",
        "needs_base_url": False,
    },
    "openai": {
        "description": "OpenAI (GPT)",
        "placeholder_models": "gpt-4o, gpt-4o-mini, gpt-4-turbo",
        "needs_base_url": False,
    },
    "openai_compatible": {
        "description": "OpenAI-Compatible (PortKey, Azure, LiteLLM, Ollama, etc.)",
        "placeholder_models": "Depends on your provider",
        "needs_base_url": True,
    },
}


def get_chat_model(
    provider: str, api_key: str, model: str, base_url: str = ""
) -> BaseChatModel:
    """Create a LangChain ChatModel for the given provider."""
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        kwargs: dict = {"api_key": api_key, "model": model}
        if base_url:
            kwargs["base_url"] = base_url
        return ChatAnthropic(**kwargs)

    elif provider in ("openai", "openai_compatible"):
        from langchain_openai import ChatOpenAI

        kwargs = {"api_key": api_key, "model": model}
        if base_url:
            kwargs["base_url"] = base_url
        return ChatOpenAI(**kwargs)

    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


async def test_connection(
    provider: str, api_key: str, model: str, base_url: str = ""
) -> tuple[bool, str]:
    """Make a minimal LLM call to verify the key and model work."""
    if provider not in SUPPORTED_PROVIDERS:
        return False, f"Unsupported provider: {provider}. Use: {', '.join(SUPPORTED_PROVIDERS)}"

    if provider == "openai_compatible" and not base_url.strip():
        return False, "Base URL is required for OpenAI-compatible providers"

    if not model.strip():
        return False, "Model name is empty"

    try:
        llm = get_chat_model(provider, api_key, model, base_url)
        await llm.ainvoke([HumanMessage(content="Say OK")])
        display = f"{provider}/{model}"
        if base_url:
            display = f"{base_url} ({model})"
        return True, f"Connected to {display}"
    except Exception as e:
        error_msg = str(e)
        if "auth" in error_msg.lower() or "api key" in error_msg.lower() or "401" in error_msg:
            return False, "Invalid API key"
        if "model" in error_msg.lower() or "404" in error_msg:
            return False, f"Model not found: {model}"
        if "connect" in error_msg.lower() or "refused" in error_msg.lower():
            return False, f"Cannot reach server at: {base_url or 'default'}"
        return False, f"Connection failed: {error_msg[:200]}"


async def get_configured_model(db_session) -> BaseChatModel | None:
    """Read settings from DB and return a configured ChatModel, or None if not configured."""
    from app.models.settings import Settings

    settings = await db_session.get(Settings, 1)
    if not settings or not settings.llm_api_key:
        return None

    return get_chat_model(
        settings.llm_provider,
        settings.llm_api_key,
        settings.llm_model,
        settings.llm_base_url,
    )
