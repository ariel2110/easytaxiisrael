from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.agents import router as agents_router
from api.ai import router as ai_router
from api.admin import router as admin_router
from api.auth import router as auth_router
from api.compliance import router as compliance_router
from api.growth import router as growth_router
from api.health import router as health_router
from api.legal import router as legal_router, tos_router
from api.payments import router as payments_router
from api.persona import router as persona_router
from api.rideshare import router as rideshare_router
from api.vehicle import router as vehicle_router
from api.ratings import router as ratings_router
from api.rides import router as rides_router
from api.tracking import router as tracking_router
from api.whatsapp import router as whatsapp_router
from core.config import settings
from core.database import engine
from core.redis import redis_client
from monitoring.metrics import setup_metrics
from security.middleware import security_headers_middleware, setup_rate_limiting


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Import all models so SQLAlchemy metadata is fully populated
    import models.audit       # noqa: F401
    import models.compliance  # noqa: F401
    import models.growth      # noqa: F401
    import models.legal       # noqa: F401
    import models.location    # noqa: F401
    import models.payment     # noqa: F401
    import models.persona     # noqa: F401
    import models.rating      # noqa: F401
    import models.rideshare   # noqa: F401
    import models.vehicle     # noqa: F401
    import models.ride        # noqa: F401
    import models.user        # noqa: F401

    from core.database import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield
    # Shutdown
    await engine.dispose()
    await redis_client.aclose()


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Security
setup_rate_limiting(app)
app.middleware("http")(security_headers_middleware)

# CORS — locked to explicit origins in production
_cors_origins = (
    ["*"] if settings.DEBUG
    else [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not settings.DEBUG,   # credentials require explicit origin list
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus
setup_metrics(app)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(rides_router)
app.include_router(tracking_router)
app.include_router(payments_router)
app.include_router(ai_router)
app.include_router(compliance_router)
app.include_router(legal_router)
app.include_router(tos_router)
app.include_router(growth_router)
app.include_router(ratings_router)
app.include_router(admin_router)
app.include_router(agents_router)
app.include_router(whatsapp_router)
app.include_router(persona_router)
app.include_router(rideshare_router)
app.include_router(vehicle_router)
