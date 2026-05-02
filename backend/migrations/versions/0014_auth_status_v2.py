"""Add docs_collecting and blocked to authstatus enum

Revision ID: 0014_auth_status_v2
Revises: 0013_performance_indexes
Create Date: 2026-05-02

Adds two new values to the authstatus PostgreSQL enum:
  - docs_collecting : driver is uploading additional documents via WhatsApp
  - blocked         : driver rejected by Sumsub or agent review

Note: PostgreSQL does NOT support removing enum values — downgrade is a no-op.
"""

from alembic import op

revision = "0014_auth_status_v2"
down_revision = "0013_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE authstatus ADD VALUE IF NOT EXISTS 'docs_collecting'")
    op.execute("ALTER TYPE authstatus ADD VALUE IF NOT EXISTS 'blocked'")


def downgrade() -> None:
    # Cannot remove enum values in PostgreSQL — intentional no-op
    pass
