"""
Migration 0009 — KYC Applications (replaces Persona.com)

Creates:
  - Enum type: kycapplicationstatus
  - Enum type: kycdocumenttype
  - Enum type: kycdocumentstatus
  - Table: kyc_applications
  - Table: kyc_documents

Revision chain: 0008_driver_verified_data → 0009_kyc_application
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0009_kyc_application"
down_revision = "0008_driver_verified_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Create enum types with raw SQL (avoids SQLAlchemy dispatch conflicts) ─
    op.execute("""
        CREATE TYPE kycapplicationstatus AS ENUM (
            'draft','submitted','processing','needs_review',
            'approved','rejected','resubmit'
        )
    """)
    op.execute("""
        CREATE TYPE kycdocumenttype AS ENUM (
            'govt_id','driving_license','vehicle_registration','vehicle_insurance',
            'police_clearance','selfie','professional_license','taxi_badge',
            'vehicle_inspection','medical_clearance'
        )
    """)
    op.execute("""
        CREATE TYPE kycdocumentstatus AS ENUM (
            'pending','analysed','approved','rejected'
        )
    """)

    # ── kyc_applications ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE kyc_applications (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            driver_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            driver_type                 VARCHAR(32) NOT NULL,
            status                      kycapplicationstatus NOT NULL DEFAULT 'draft',

            agent1_result               TEXT,
            agent1_verdict              VARCHAR(16),
            agent1_model                VARCHAR(64),

            agent2_result               TEXT,
            agent2_verdict              VARCHAR(16),
            agent2_model                VARCHAR(64),

            final_verdict               VARCHAR(16),
            rejection_reasons           TEXT,
            admin_notes                 TEXT,
            reviewed_by                 UUID REFERENCES users(id) ON DELETE SET NULL,

            verified_name               VARCHAR(120),
            id_number                   VARCHAR(64),
            date_of_birth               VARCHAR(16),
            license_class               VARCHAR(16),
            license_expiry              VARCHAR(16),
            insurance_covers_rideshare  BOOLEAN NOT NULL DEFAULT FALSE,
            compliance_score            INTEGER NOT NULL DEFAULT 0,

            submitted_at                TIMESTAMPTZ,
            completed_at                TIMESTAMPTZ,
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_kyc_applications_driver_id ON kyc_applications (driver_id)")
    op.execute("CREATE INDEX ix_kyc_applications_status    ON kyc_applications (status)")

    # ── kyc_documents ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE kyc_documents (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id      UUID NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
            document_type       kycdocumenttype NOT NULL,
            file_key            VARCHAR(512) NOT NULL,
            status              kycdocumentstatus NOT NULL DEFAULT 'pending',
            agent1_data         TEXT,
            agent1_issues       TEXT,
            agent1_confidence   INTEGER,
            uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_kyc_documents_application_id ON kyc_documents (application_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS kyc_documents")
    op.execute("DROP TABLE IF EXISTS kyc_applications")
    op.execute("DROP TYPE IF EXISTS kycdocumentstatus")
    op.execute("DROP TYPE IF EXISTS kycdocumenttype")
    op.execute("DROP TYPE IF EXISTS kycapplicationstatus")
