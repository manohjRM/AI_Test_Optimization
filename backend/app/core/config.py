# ABOUTME: Application configuration loaded from environment variables.
# ABOUTME: Centralizes all settings (database, CORS, API keys) via pydantic-settings.

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    PROJECT_NAME: str = "AI Test Optimization Agent"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/test_optimizer"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Repo workspace — where cloned GitHub repos are stored
    REPO_WORKSPACE_DIR: str = "./workspace/repos"

    # AI / LLM (placeholder — provider TBD)
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""


settings = Settings()
