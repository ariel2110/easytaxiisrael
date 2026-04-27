import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user, require_roles
from models.user import User, UserRole
from schemas.ai import AnomalyRead, PlatformSnapshotRead, RideIntelligenceRead
from services.ai import router as ai_router

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get(
    "/intelligence",
    response_model=RideIntelligenceRead,
    summary="Current demand, surge multiplier, and ride advisory",
)
async def ride_intelligence(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RideIntelligenceRead:
    result = await ai_router.get_ride_intelligence(db)
    return RideIntelligenceRead(
        demand=result.demand.__dict__,
        surge=result.surge.__dict__,
        fare_multiplier=result.fare_multiplier,
        recommendation=result.recommendation,
    )


@router.get(
    "/platform/snapshot",
    response_model=PlatformSnapshotRead,
    summary="[Admin] Full platform AI snapshot: demand, surge, anomalies",
)
async def platform_snapshot(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> PlatformSnapshotRead:
    result = await ai_router.get_platform_snapshot(db)
    return PlatformSnapshotRead(
        demand=result.demand.__dict__,
        surge=result.surge.__dict__,
        anomalies=[a.__dict__ for a in result.anomalies],
        anomaly_count=result.anomaly_count,
    )


@router.get(
    "/rides/{ride_id}/anomalies",
    response_model=list[AnomalyRead],
    summary="[Admin] Check GPS anomalies for a specific ride",
)
async def ride_anomalies(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[AnomalyRead]:
    results = await ai_router.check_ride_location_anomalies(db, ride_id)
    return [a.__dict__ for a in results]
