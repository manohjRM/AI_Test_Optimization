# ABOUTME: GeneratedScript ORM model — stores AI-generated/modified test code pending user review.
# ABOUTME: Links to a project and acceptance criteria, tracks generation source and apply status.

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScriptAction(str, enum.Enum):
    MODIFY = "modify"
    GENERATE = "generate"
    APPEND = "append"


class ScriptStatus(str, enum.Enum):
    PENDING = "pending"
    APPLIED = "applied"
    REJECTED = "rejected"


class GeneratedScript(Base):
    __tablename__ = "generated_scripts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    ac_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("acceptance_criteria.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[ScriptAction] = mapped_column(Enum(ScriptAction), nullable=False)
    status: Mapped[ScriptStatus] = mapped_column(
        Enum(ScriptStatus), nullable=False, default=ScriptStatus.PENDING
    )
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    source_item: Mapped[dict] = mapped_column(JSONB, nullable=False)
    original_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
