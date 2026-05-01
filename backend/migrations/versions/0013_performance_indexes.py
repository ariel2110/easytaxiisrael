"""performance indexes on hot tables

Revision ID: 0013_performance_indexes
Revises: 0012_passenger_wallet
Create Date: 2026-05-01

NOTE: Most critical indexes (users, rides, ride_payments, leads, audit_logs,
driver_wallets, wallet_entries, passenger_wallets) were already created by
prior migrations. This migration is a no-op marker to document that all
performance indexes are in place after the health audit of 2026-05-01.
"""
from alembic import op

revision = "0013_performance_indexes"
down_revision = "0012_passenger_wallet"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All critical indexes already exist from prior migrations.
    # Verify the combined composite index on users(role, is_active) covers
    # both role-only and status-only queries. No new DDL required.
    pass


def downgrade() -> None:
    pass
