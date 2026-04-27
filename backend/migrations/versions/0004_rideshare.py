"""Add driver_type to users; add rideshare_profiles and rideshare_documents tables

Revision ID: 0004_rideshare
Revises: 0003_vehicle
Create Date: 2026-04-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_rideshare"
down_revision = "0003_vehicle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add driver_type column to users ───────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "driver_type",
            sa.Enum("licensed_taxi", "rideshare", name="drivertype"),
            nullable=True,
        ),
    )

    # ── rideshare_profiles ────────────────────────────────────────────────
    op.create_table(
        "rideshare_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending_legislation", "documents_pending",
                "documents_submitted", "ready",
                name="ridesharestatus",
            ),
            nullable=False,
            server_default="pending_legislation",
        ),
        sa.Column("acknowledged_no_payment", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_ip", sa.String(64), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
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
    op.create_index(
        "ix_rideshare_profiles_driver_id", "rideshare_profiles", ["driver_id"], unique=True
    )
    op.create_index("ix_rideshare_profiles_status", "rideshare_profiles", ["status"])

    # ── rideshare_documents ────────────────────────────────────────────────
    op.create_table(
        "rideshare_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "doc_type",
            sa.Enum(
                "drivers_license", "vehicle_registration",
                "insurance_mandatory", "insurance_commercial",
                "vehicle_inspection", "profile_photo", "identity_document",
                "background_check", "training_certificate",
                "criminal_record_extract",
                name="ridesharedoctype",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="ridesharedocstatus"),
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
    op.create_index("ix_rideshare_documents_driver_id", "rideshare_documents", ["driver_id"])
    op.create_index("ix_rideshare_documents_doc_type", "rideshare_documents", ["doc_type"])
    op.create_index("ix_rideshare_documents_status", "rideshare_documents", ["status"])


def downgrade() -> None:
    op.drop_index("ix_rideshare_documents_status", table_name="rideshare_documents")
    op.drop_index("ix_rideshare_documents_doc_type", table_name="rideshare_documents")
    op.drop_index("ix_rideshare_documents_driver_id", table_name="rideshare_documents")
    op.drop_table("rideshare_documents")
    op.execute("DROP TYPE IF EXISTS ridesharedocstatus")
    op.execute("DROP TYPE IF EXISTS ridesharedoctype")

    op.drop_index("ix_rideshare_profiles_status", table_name="rideshare_profiles")
    op.drop_index("ix_rideshare_profiles_driver_id", table_name="rideshare_profiles")
    op.drop_table("rideshare_profiles")
    op.execute("DROP TYPE IF EXISTS ridesharestatus")

    op.drop_column("users", "driver_type")
    op.execute("DROP TYPE IF EXISTS drivertype")
