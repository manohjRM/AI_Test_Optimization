# ABOUTME: LLM provider abstraction using LangChain's ChatModel interface.
# ABOUTME: Supports Anthropic and OpenAI with a config-driven factory and connection test.

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage


SUPPORTED_PROVIDERS = {
    "anthropic": {
        "default_model": "claude-sonnet-4-20250514",
        "models": [
            "claude-sonnet-4-20250514",
            "claude-haiku-4-20250514",
            "claude-opus-4-20250514",
        ],
    },
    "openai": {
        "default_model": "gpt-4o",
        "models": [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
        ],
    },
}


def get_chat_model(provider: str, api_key: str, model: str) -> BaseChatModel:
    """Create a LangChain ChatModel for the given provider."""
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(api_key=api_key, model=model)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(api_key=api_key, model=model)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


async def test_connection(provider: str, api_key: str, model: str) -> tuple[bool, str]:
    """Make a minimal LLM call to verify the key and model work."""
    if not api_key.strip():
        return False, "API key is empty"
    if not model.strip():
        return False, "Model name is empty"
    if provider not in SUPPORTED_PROVIDERS:
        return False, f"Unsupported provider: {provider}. Use: {', '.join(SUPPORTED_PROVIDERS)}"

    try:
        llm = get_chat_model(provider, api_key, model)
        response = await llm.ainvoke([HumanMessage(content="Say OK")])
        return True, f"Connected to {provider}/{model}"
    except Exception as e:
        error_msg = str(e)
        if "auth" in error_msg.lower() or "api key" in error_msg.lower() or "401" in error_msg:
            return False, "Invalid API key"
        if "model" in error_msg.lower() or "404" in error_msg:
            return False, f"Model not found: {model}"
        return False, f"Connection failed: {error_msg[:200]}"


async def get_configured_model(db_session) -> BaseChatModel | None:
    """Read settings from DB and return a configured ChatModel, or None if not configured."""
    from app.models.settings import Settings

    settings = await db_session.get(Settings, 1)
    if not settings or not settings.llm_api_key:
        return None

    return get_chat_model(settings.llm_provider, settings.llm_api_key, settings.llm_model)
