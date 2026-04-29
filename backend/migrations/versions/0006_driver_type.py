"""Add driver_type column to users

Revision ID: 0006_driver_type
Revises: 0005_auth_status
Create Date: 2026-04-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_driver_type"
down_revision = "0005_auth_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    drivertype_enum = sa.Enum("taxi", "rideshare", name="drivertype")
    drivertype_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column("driver_type", sa.Enum("taxi", "rideshare", name="drivertype"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "driver_type")
