"""
Shared fixtures for all tests.

Environment variables are set HERE, before any app code is imported,
so that pydantic-settings picks them up at module load time.
"""
import os

# ── Must be set before any app imports ───────────────────────────────────────
os.environ.update(
    {
        "APP_ENV": "test",
        "DEBUG": "true",
        "JWT_SECRET_KEY": "test-jwt-secret-key-for-testing-purposes-only",
        # Valid 32-byte URL-safe base64 Fernet key
        "ENCRYPTION_KEY": "EWAsGNCsw5ZCknQr5j8Mv4bxYMfLFlfp4sbQ5FitfCk=",
        "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
        "REDIS_URL": "redis://localhost:6379/0",  # overridden by fakeredis patch
        "EVOLUTION_URL": "http://evolution-api-test:8080",
        "EVOLUTION_API_KEY": "test-evo-key",
        "EVOLUTION_INSTANCE": "test-instance",
        "ADMIN_USERNAME": "972500000000",
        "ADMIN_PASSWORD": "test-admin-password",
        "WHATSAPP_PLATFORM_PHONE": "972546363350",
    }
)

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import fakeredis.aioredis
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── App imports (after env vars) ─────────────────────────────────────────────
from core.database import Base, get_db
from core.security import create_access_token, create_refresh_token
from models.user import User, UserRole

# Import ALL models so they register with Base.metadata before create_all
import models.audit       # noqa: F401
import models.compliance  # noqa: F401
import models.driver_verified_data  # noqa: F401
import models.growth      # noqa: F401
import models.legal       # noqa: F401
import models.location    # noqa: F401
import models.payment     # noqa: F401
import models.persona     # noqa: F401
import models.rating      # noqa: F401
import models.rideshare   # noqa: F401
import models.ride        # noqa: F401
import models.vehicle     # noqa: F401

_TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
_test_engine = create_async_engine(_TEST_DB_URL, echo=False)
_TestSession = async_sessionmaker(_test_engine, expire_on_commit=False, autoflush=False)


# ── DB setup ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all SQLAlchemy tables once for the session."""
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await _test_engine.dispose()


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """Yield a raw test DB session (auto-committed; no rollback)."""
    async with _TestSession() as session:
        yield session


# ── Redis ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def fake_redis():
    """In-memory Redis replacement; flushed between tests."""
    r = fakeredis.aioredis.FakeRedis(decode_responses=True)
    return r


# ── HTTP client ───────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(fake_redis):
    """
    Full-stack AsyncClient backed by SQLite + fake Redis.
    WhatsApp httpx calls must be mocked per-test with respx or patch.
    """
    from main import app

    async def _override_get_db():
        async with _TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    with patch("core.security.redis_client", fake_redis), \
         patch("api.auth._redis_client", fake_redis), \
         patch("core.redis.redis_client", fake_redis):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ── User factory ──────────────────────────────────────────────────────────────

async def make_user(
    db: AsyncSession,
    phone: str,
    role: UserRole,
    active: bool = True,
    accepted_tos: bool = True,
) -> User:
    user = User(
        id=uuid.uuid4(),
        phone=phone,
        role=role,
        is_active=active,
        tos_accepted_at=datetime.now(timezone.utc) if accepted_tos else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def passenger(db):
    return await make_user(db, "972501111111", UserRole.passenger)


@pytest_asyncio.fixture
async def driver(db):
    return await make_user(db, "972502222222", UserRole.driver)


@pytest_asyncio.fixture
async def admin(db):
    return await make_user(db, "972500000000", UserRole.admin, accepted_tos=False)


# ── Token helpers ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def passenger_headers(fake_redis, passenger):
    with patch("core.security.redis_client", fake_redis):
        token = create_access_token(str(passenger.id), passenger.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(fake_redis, admin):
    with patch("core.security.redis_client", fake_redis):
        token = create_access_token(str(admin.id), admin.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def driver_headers(fake_redis, driver):
    with patch("core.security.redis_client", fake_redis):
        token = create_access_token(str(driver.id), driver.role.value)
    return {"Authorization": f"Bearer {token}"}
