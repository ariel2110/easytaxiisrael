"""Add auth_status and last_wa_msg_id to users

Revision ID: 0005_auth_status
Revises: 0004_rideshare
Create Date: 2026-04-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_auth_status"
down_revision = "0004_rideshare"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the AuthStatus enum type
    authstatus_enum = sa.Enum(
        "pending",
        "whatsapp_verified",
        "persona_in_progress",
        "persona_completed",
        "approved",
        name="authstatus",
    )
    authstatus_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "auth_status",
            authstatus_enum,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "users",
        sa.Column("last_wa_msg_id", sa.String(128), nullable=True),
    )
    op.create_index("ix_users_auth_status", "users", ["auth_status"])


def downgrade() -> None:
    op.drop_index("ix_users_auth_status", table_name="users")
    op.drop_column("users", "last_wa_msg_id")
    op.drop_column("users", "auth_status")
    sa.Enum(name="authstatus").drop(op.get_bind(), checkfirst=True)
