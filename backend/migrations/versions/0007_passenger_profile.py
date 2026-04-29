"""Add full_name and email to users for passenger onboarding

Revision ID: 0007_passenger_profile
Revises: 0006_driver_type
Create Date: 2026-04-28 00:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_passenger_profile"
down_revision = "0006_driver_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "full_name")
    op.drop_column("users", "email")
