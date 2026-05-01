"""
Migration 0012 — Passenger wallet + payment methods + business profile fields

Adds:
  - users: payment_profile, business_name, business_tax_id, business_email
  - Table: passenger_wallets
  - Table: passenger_wallet_entries
  - Table: passenger_payment_methods

Revision chain: 0011_govil → 0012_passenger_wallet
"""

import sqlalchemy as sa
from alembic import op

revision = "0012_passenger_wallet"
down_revision = "0011_govil"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Business profile columns on users
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_profile VARCHAR(20) NOT NULL DEFAULT 'personal'")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(120)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_tax_id VARCHAR(20)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_email VARCHAR(254)")

    # Passenger wallets
    op.execute("""
        CREATE TABLE IF NOT EXISTS passenger_wallets (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            passenger_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
            balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_passenger_wallets_passenger_id ON passenger_wallets(passenger_id)")

    # Passenger wallet entries (immutable ledger)
    op.execute("""
        CREATE TABLE IF NOT EXISTS passenger_wallet_entries (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_id           UUID NOT NULL REFERENCES passenger_wallets(id) ON DELETE RESTRICT,
            entry_type          VARCHAR(10) NOT NULL,
            amount              NUMERIC(12,2) NOT NULL,
            balance_after       NUMERIC(12,2) NOT NULL,
            description         VARCHAR(255),
            ride_id             UUID REFERENCES rides(id) ON DELETE SET NULL,
            grow_transaction_id VARCHAR(128),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_passenger_wallet_entries_wallet_id ON passenger_wallet_entries(wallet_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_passenger_wallet_entries_ride_id ON passenger_wallet_entries(ride_id)")

    # Passenger saved payment methods
    op.execute("""
        CREATE TABLE IF NOT EXISTS passenger_payment_methods (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            passenger_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            grow_token      VARCHAR(500) NOT NULL,
            card_last4      VARCHAR(4) NOT NULL,
            card_brand      VARCHAR(20) NOT NULL,
            card_expiry     VARCHAR(7),
            is_default      BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_passenger_payment_methods_passenger_id ON passenger_payment_methods(passenger_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS passenger_payment_methods")
    op.execute("DROP TABLE IF EXISTS passenger_wallet_entries")
    op.execute("DROP TABLE IF EXISTS passenger_wallets")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS payment_profile")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS business_name")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS business_tax_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS business_email")
