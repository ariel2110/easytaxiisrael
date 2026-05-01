"""
Migration: add new columns to leads table for the driver leads board.
Run once via: python -c "from scripts.migrate_leads import run; import asyncio; asyncio.run(run())"
"""
from __future__ import annotations

import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal


async def run() -> None:
    async with AsyncSessionLocal() as db:
        migrations = [
            # New status enum values (PostgreSQL requires ALTER TYPE)
            "ALTER TYPE leadstatus ADD VALUE IF NOT EXISTS 'approved'",
            "ALTER TYPE leadstatus ADD VALUE IF NOT EXISTS 'sent'",
            # New source enum value
            "ALTER TYPE leadsource ADD VALUE IF NOT EXISTS 'google_places'",
            # New columns
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_capable BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS message_text TEXT",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS area VARCHAR(80)",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_type VARCHAR(80)",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(120)",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(120)",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(255)",
        ]
        for sql in migrations:
            try:
                await db.execute(text(sql))
                print(f"✅ {sql[:60]}...")
            except Exception as e:
                print(f"⚠️  {sql[:60]}... → {e}")
        await db.commit()
        print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(run())
