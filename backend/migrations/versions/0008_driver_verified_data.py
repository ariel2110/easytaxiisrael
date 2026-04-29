"""
Migration 0008 — Driver verified data + compliance profile extensions

- Creates `driver_verified_data` table (identity fields extracted from Persona)
- Adds `background_check_approved`, `background_check_expiry` to `driver_compliance_profiles`
- Adds `taxi_license_approved`, `taxi_license_expiry` to `driver_compliance_profiles`

Revision chain: 0007_passenger_profile → 0008_driver_verified_data
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0008_driver_verified_data"
down_revision = "0007_passenger_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── driver_verified_data ────────────────────────────────────────────────
    op.create_table(
        "driver_verified_data",
        sa.Column("id",                  UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id",           UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("persona_inquiry_id",  sa.String(128), nullable=False, index=True),
        # Government ID
        sa.Column("verified_name_first", sa.String(120), nullable=True),
        sa.Column("verified_name_last",  sa.String(120), nullable=True),
        sa.Column("id_number",           sa.String(64),  nullable=True),
        sa.Column("date_of_birth",       sa.Date,        nullable=True),
        sa.Column("issuing_country",     sa.String(8),   nullable=True),
        sa.Column("gov_id_expiry",       sa.Date,        nullable=True),
        sa.Column("gov_id_passed",       sa.Boolean,     nullable=False, server_default="false"),
        # Driver's license
        sa.Column("license_number",      sa.String(64),  nullable=True),
        sa.Column("license_class",       sa.String(32),  nullable=True),
        sa.Column("license_expiry_date", sa.Date,        nullable=True),
        sa.Column("license_passed",      sa.Boolean,     nullable=False, server_default="false"),
        # Selfie
        sa.Column("selfie_passed",       sa.Boolean,     nullable=False, server_default="false"),
        # Raw data
        sa.Column("raw_persona_data",    sa.Text,        nullable=True),
        sa.Column("verified_at",         sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── driver_compliance_profiles: new columns ─────────────────────────────
    op.add_column(
        "driver_compliance_profiles",
        sa.Column("background_check_approved", sa.Boolean, nullable=False, server_default="false"),
    )
    op.add_column(
        "driver_compliance_profiles",
        sa.Column("background_check_expiry", sa.Date, nullable=True),
    )
    op.add_column(
        "driver_compliance_profiles",
        sa.Column("taxi_license_approved", sa.Boolean, nullable=False, server_default="false"),
    )
    op.add_column(
        "driver_compliance_profiles",
        sa.Column("taxi_license_expiry", sa.Date, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("driver_compliance_profiles", "taxi_license_expiry")
    op.drop_column("driver_compliance_profiles", "taxi_license_approved")
    op.drop_column("driver_compliance_profiles", "background_check_expiry")
    op.drop_column("driver_compliance_profiles", "background_check_approved")
    op.drop_table("driver_verified_data")
