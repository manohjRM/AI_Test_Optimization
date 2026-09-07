# ABOUTME: Project ORM model — the top-level entity that ties a repo to test generation work.
# ABOUTME: Each project points to exactly one repository (local path or cloned from GitHub).

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RepoType(str, enum.Enum):
    LOCAL = "local"
    GITHUB = "github"


class RepoStatus(str, enum.Enum):
    PENDING = "pending"
    VALID = "valid"
    CLONING = "cloning"
    CLONED = "cloned"
    ERROR = "error"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repo_type: Mapped[RepoType] = mapped_column(Enum(RepoType), nullable=False)
    repo_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    local_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    repo_status: Mapped[RepoStatus] = mapped_column(
        Enum(RepoStatus), nullable=False, default=RepoStatus.PENDING
    )
    repo_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
