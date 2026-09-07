# ABOUTME: Initial migration — creates projects and test_scripts tables.
# ABOUTME: Drops any pre-existing projects table from earlier manual setup.

"""create projects and test_scripts tables

Revision ID: 3f60245b8f16
Revises:
Create Date: 2026-09-08 00:54:41.448571

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "3f60245b8f16"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP TABLE IF EXISTS projects CASCADE")

    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "repo_type",
            sa.Enum("LOCAL", "GITHUB", name="repotype"),
            nullable=False,
        ),
        sa.Column("repo_url", sa.String(length=1024), nullable=False),
        sa.Column("local_path", sa.String(length=1024), nullable=True),
        sa.Column(
            "repo_status",
            sa.Enum(
                "PENDING", "VALID", "CLONING", "CLONED", "ERROR", name="repostatus"
            ),
            nullable=False,
        ),
        sa.Column("repo_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "test_scripts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("framework", sa.String(length=50), nullable=False),
        sa.Column("language", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("test_scripts")
    op.drop_table("projects")
    op.execute("DROP TYPE IF EXISTS repostatus")
    op.execute("DROP TYPE IF EXISTS repotype")
