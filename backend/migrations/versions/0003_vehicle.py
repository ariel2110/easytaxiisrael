"""Add vehicle_photos and vehicle_compliance tables

Revision ID: 0003_vehicle
Revises: 0002_persona
Create Date: 2026-04-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_vehicle"
down_revision = "0002_persona"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── vehicle_photos ────────────────────────────────────────────────────
    op.create_table(
        "vehicle_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "photo_type",
            sa.Enum(
                "front", "rear", "driver_side", "passenger_side",
                "interior_front", "interior_rear",
                name="vehiclephototype",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="vehiclephotostatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("file_key", sa.String(512), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_vehicle_photos_driver_id", "vehicle_photos", ["driver_id"])
    op.create_index("ix_vehicle_photos_photo_type", "vehicle_photos", ["photo_type"])
    op.create_index("ix_vehicle_photos_status", "vehicle_photos", ["status"])

    # ── vehicle_compliance ────────────────────────────────────────────────
    op.create_table(
        "vehicle_compliance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("insurance_mandatory_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("insurance_commercial_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("vehicle_test_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("registration_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("vehicle_age_ok", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("photos_complete", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="vehiclecompliancestatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("persona_inquiry_id", sa.String(128), nullable=True),
        sa.Column("rejection_notes", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_vehicle_compliance_driver_id", "vehicle_compliance", ["driver_id"], unique=True
    )
    op.create_index("ix_vehicle_compliance_status", "vehicle_compliance", ["status"])


def downgrade() -> None:
    op.drop_index("ix_vehicle_compliance_status", table_name="vehicle_compliance")
    op.drop_index("ix_vehicle_compliance_driver_id", table_name="vehicle_compliance")
    op.drop_table("vehicle_compliance")
    op.execute("DROP TYPE IF EXISTS vehiclecompliancestatus")

    op.drop_index("ix_vehicle_photos_status", table_name="vehicle_photos")
    op.drop_index("ix_vehicle_photos_photo_type", table_name="vehicle_photos")
    op.drop_index("ix_vehicle_photos_driver_id", table_name="vehicle_photos")
    op.drop_table("vehicle_photos")
    op.execute("DROP TYPE IF EXISTS vehiclephotostatus")
    op.execute("DROP TYPE IF EXISTS vehiclephototype")
