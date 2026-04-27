"""Initial schema — all tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-26 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("role", sa.Enum("driver", "passenger", "admin", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("device_token", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_role_is_active", "users", ["role", "is_active"])

    # ── rides ────────────────────────────────────────────────
    op.create_table(
        "rides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("passenger_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.Enum("pending", "assigned", "accepted", "in_progress", "completed", "cancelled", name="ridestatus"), nullable=False, server_default="pending"),
        sa.Column("pickup_lat", sa.Float(), nullable=False),
        sa.Column("pickup_lng", sa.Float(), nullable=False),
        sa.Column("dropoff_lat", sa.Float(), nullable=False),
        sa.Column("dropoff_lng", sa.Float(), nullable=False),
        sa.Column("pickup_address", sa.String(255), nullable=True),
        sa.Column("dropoff_address", sa.String(255), nullable=True),
        sa.Column("cancellation_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fare_ils", sa.Float(), nullable=True),
    )
    op.create_index("ix_rides_passenger_id", "rides", ["passenger_id"])
    op.create_index("ix_rides_driver_id", "rides", ["driver_id"])
    op.create_index("ix_rides_status", "rides", ["status"])

    # ── driver_location_events ────────────────────────────────
    op.create_table(
        "driver_location_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_location_ride_id", "driver_location_events", ["ride_id"])
    op.create_index("ix_location_driver_id", "driver_location_events", ["driver_id"])
    op.create_index("ix_location_recorded_at", "driver_location_events", ["recorded_at"])

    # ── ride_payments ─────────────────────────────────────────
    op.create_table(
        "ride_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rides.id"), nullable=False, unique=True),
        sa.Column("passenger_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("distance_km", sa.Numeric(12, 4), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("driver_earnings", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.Enum("pending", "completed", "failed", name="paymentstatus"), nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── driver_wallets ────────────────────────────────────────
    op.create_table(
        "driver_wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── wallet_entries ────────────────────────────────────────
    op.create_table(
        "wallet_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_wallets.id"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(12, 2), nullable=False),
        sa.Column("entry_type", sa.Enum("credit", "debit", name="walletentrytype"), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_wallet_entries_wallet_id", "wallet_entries", ["wallet_id"])

    # ── ratings ───────────────────────────────────────────────
    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rater_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ratee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.Enum("passenger_to_driver", "driver_to_passenger", name="ratingdirection"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="ck_ratings_score_range"),
        sa.UniqueConstraint("ride_id", "direction", name="uq_ratings_ride_direction"),
    )
    op.create_index("ix_ratings_ride_id", "ratings", ["ride_id"])
    op.create_index("ix_ratings_ratee_id", "ratings", ["ratee_id"])

    # ── audit_logs ────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.Enum(
            "login", "logout", "token_refresh", "otp_requested", "otp_verified",
            "ride_requested", "ride_accepted", "ride_rejected", "ride_started",
            "ride_ended", "ride_cancelled", "payment_processed", "payment_failed",
            "admin_review_document", "admin_evaluate_driver", "admin_expiry_sweep",
            "admin_flag_update", "rate_limit_exceeded", "unauthorized_access",
            name="auditaction",
        ), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(36), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── driver_documents ─────────────────────────────────────
    op.create_table(
        "driver_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.Enum(
            "national_id", "driving_license", "vehicle_registration",
            "vehicle_insurance", "background_check", "profile_photo",
            name="documenttype",
        ), nullable=False),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "expired", name="documentstatus"), nullable=False, server_default="pending"),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("rejection_reason", sa.String(255), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_driver_documents_driver_id", "driver_documents", ["driver_id"])

    # ── driver_compliance_profiles ────────────────────────────
    op.create_table(
        "driver_compliance_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("compliance_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_compliant", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── driver_legal_statuses ─────────────────────────────────
    op.create_table(
        "driver_legal_statuses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("license_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("insurance_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("vehicle_valid", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("documents_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("compliance_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.Enum("approved", "warning", "blocked", name="legalcompliancestatus"), nullable=False, server_default="blocked"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── compliance_steps ─────────────────────────────────────
    op.create_table(
        "compliance_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_name", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_compliance_steps_driver_id", "compliance_steps", ["driver_id"])

    # ── legal_documents ───────────────────────────────────────
    op.create_table(
        "legal_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(100), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_legal_documents_driver_id", "legal_documents", ["driver_id"])

    # ── leads ─────────────────────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("status", sa.Enum("new", "contacted", "converted", "lost", name="leadstatus"), nullable=False, server_default="new"),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_contacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── campaigns ────────────────────────────────────────────
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("message_template", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("draft", "active", "paused", "completed", name="campaignstatus"), nullable=False, server_default="draft"),
        sa.Column("target_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conversion_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("campaigns")
    op.drop_table("leads")
    op.drop_table("legal_documents")
    op.drop_table("compliance_steps")
    op.drop_table("driver_legal_statuses")
    op.drop_table("driver_compliance_profiles")
    op.drop_table("driver_documents")
    op.drop_table("audit_logs")
    op.drop_table("ratings")
    op.drop_table("wallet_entries")
    op.drop_table("driver_wallets")
    op.drop_table("ride_payments")
    op.drop_table("driver_location_events")
    op.drop_table("rides")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS ridestatus")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS walletentrytype")
    op.execute("DROP TYPE IF EXISTS ratingdirection")
    op.execute("DROP TYPE IF EXISTS auditaction")
    op.execute("DROP TYPE IF EXISTS documenttype")
    op.execute("DROP TYPE IF EXISTS documentstatus")
    op.execute("DROP TYPE IF EXISTS legalcompliancestatus")
    op.execute("DROP TYPE IF EXISTS leadstatus")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
