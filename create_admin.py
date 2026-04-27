import sys
sys.path.insert(0, '/app')
import asyncio
import uuid
from core.database import AsyncSessionLocal
from models.user import User, UserRole
from sqlalchemy import select

PHONE = "+972546363350"

async def run():
    async with AsyncSessionLocal() as db:
        # Check if exists
        result = await db.execute(select(User).where(User.phone == PHONE))
        existing = result.scalar_one_or_none()
        if existing:
            existing.role = UserRole.admin
            existing.is_active = True
            await db.commit()
            print(f"UPDATED existing user {existing.id} to admin")
        else:
            user = User(
                id=uuid.uuid4(),
                phone=PHONE,
                role=UserRole.admin,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"CREATED admin user id={user.id} phone={PHONE}")

asyncio.run(run())
