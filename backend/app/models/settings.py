# ABOUTME: Settings model — single-row table for app-wide configuration.
# ABOUTME: Stores LLM provider, API key, and model selection.

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="anthropic")
    llm_api_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    llm_model: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
