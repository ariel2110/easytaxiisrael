"""
Migration 0010 — Sumsub applicants table

Creates:
  - Enum type: sumsubstatus
  - Table: sumsub_applicants

Revision chain: 0009_kyc_application → 0010_sumsub
"""
import sqlalchemy as sa
from alembic import op

revision = "0010_sumsub"
down_revision = "0009_kyc_application"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE sumsubstatus AS ENUM (
                'init', 'pending', 'completed', 'rejected', 'on_hold'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        CREATE TABLE sumsub_applicants (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            driver_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            sumsub_applicant_id   VARCHAR(128) NOT NULL UNIQUE,
            level_name            VARCHAR(64)  NOT NULL,
            status                sumsubstatus NOT NULL DEFAULT 'init',
            review_result         VARCHAR(16),
            reject_labels         TEXT,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_sumsub_applicants_driver_id          ON sumsub_applicants (driver_id)")
    op.execute("CREATE INDEX ix_sumsub_applicants_sumsub_applicant_id ON sumsub_applicants (sumsub_applicant_id)")
    op.execute("CREATE INDEX ix_sumsub_applicants_status              ON sumsub_applicants (status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sumsub_applicants")
    op.execute("DROP TYPE IF EXISTS sumsubstatus")
