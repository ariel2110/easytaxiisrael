"""Add persona_inquiries table for KYC integration

Revision ID: 0002_persona
Revises: 0001_initial
Create Date: 2026-04-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_persona"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "persona_inquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("persona_inquiry_id", sa.String(128), nullable=False, unique=True),
        sa.Column(
            "status",
            sa.Enum(
                "created", "started", "completed",
                "approved", "declined", "expired",
                name="personainquirystatus",
            ),
            nullable=False,
            server_default="created",
        ),
        sa.Column("session_token", sa.String(512), nullable=True),
        sa.Column("template_id", sa.String(128), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_persona_inquiries_driver_id", "persona_inquiries", ["driver_id"])
    op.create_index(
        "ix_persona_inquiries_persona_inquiry_id",
        "persona_inquiries",
        ["persona_inquiry_id"],
        unique=True,
    )
    op.create_index("ix_persona_inquiries_status", "persona_inquiries", ["status"])


def downgrade() -> None:
    op.drop_index("ix_persona_inquiries_status", table_name="persona_inquiries")
    op.drop_index(
        "ix_persona_inquiries_persona_inquiry_id", table_name="persona_inquiries"
    )
    op.drop_index("ix_persona_inquiries_driver_id", table_name="persona_inquiries")
    op.drop_table("persona_inquiries")
    op.execute("DROP TYPE IF EXISTS personainquirystatus")
