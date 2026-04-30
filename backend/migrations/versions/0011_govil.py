"""
Migration 0011 — vehicle_number field on users + govil_checks table

Adds:
  - users.vehicle_number (VARCHAR 20) — driver vehicle plate
  - Table: govil_vehicle_checks — cached results from data.gov.il API

Revision chain: 0010_sumsub → 0011_govil
"""
import sqlalchemy as sa
from alembic import op

revision = "0011_govil"
down_revision = "0010_sumsub"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add vehicle_number to users
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20)")

    # Create govil_vehicle_checks cache table
    op.execute("""
        CREATE TABLE IF NOT EXISTS govil_vehicle_checks (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            driver_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vehicle_number  VARCHAR(20) NOT NULL,
            checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            found           BOOLEAN NOT NULL DEFAULT FALSE,
            is_active       BOOLEAN NOT NULL DEFAULT FALSE,
            is_removed      BOOLEAN NOT NULL DEFAULT FALSE,
            is_taxi         BOOLEAN NOT NULL DEFAULT FALSE,
            manufacturer    VARCHAR(120),
            model           VARCHAR(120),
            color           VARCHAR(60),
            year            VARCHAR(10),
            ownership       VARCHAR(60),
            test_expiry     VARCHAR(30),
            last_test_date  VARCHAR(30),
            chassis         VARCHAR(60),
            fuel_type       VARCHAR(60),
            warnings        TEXT
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_govil_checks_driver ON govil_vehicle_checks(driver_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_govil_checks_vehicle ON govil_vehicle_checks(vehicle_number)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS govil_vehicle_checks")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS vehicle_number")
