"""Add driver_applications table and driverapplicationstatus enum

Revision ID: 0015_driver_applications
Revises: 0014_auth_status_v2
Create Date: 2026-05-02
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015_driver_applications"
down_revision = "0014_auth_status_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL to avoid SQLAlchemy Enum auto-create issues
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE driverapplicationstatus AS ENUM (
                'submitted', 'sumsub_pending', 'docs_required',
                'ai_review', 'pending_admin', 'approved', 'rejected'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS driver_applications (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            driver_type      VARCHAR(32)  NOT NULL DEFAULT 'rideshare',
            status           driverapplicationstatus NOT NULL DEFAULT 'submitted',
            has_vehicle      BOOLEAN NOT NULL DEFAULT false,
            vehicle_number   VARCHAR(20),
            vehicle_make     VARCHAR(64),
            vehicle_model    VARCHAR(64),
            vehicle_year     INTEGER,
            years_driving    INTEGER,
            motivation       TEXT,
            admin_notes      TEXT,
            rejection_reason TEXT,
            reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at      TIMESTAMPTZ,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_driver_applications_user_id
        ON driver_applications (user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_driver_applications_status
        ON driver_applications (status);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS driver_applications;")
    op.execute("DROP TYPE IF EXISTS driverapplicationstatus;")
