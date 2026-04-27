import uuid
from decimal import Decimal

from pydantic import BaseModel

from services.ai.anomaly import AnomalyType
from services.ai.demand import DemandLevel


class DemandRead(BaseModel):
    score: float
    level: DemandLevel
    active_rides: int
    hour_weight: float
    dow_weight: float


class SurgeRead(BaseModel):
    multiplier: Decimal
    demand_level: DemandLevel
    available_drivers: int
    active_rides: int
    supply_ratio: float
    is_surging: bool


class AnomalyRead(BaseModel):
    anomaly_type: AnomalyType
    ride_id: uuid.UUID | None
    detail: str
    severity: str
    metadata: dict


class RideIntelligenceRead(BaseModel):
    demand: DemandRead
    surge: SurgeRead
    fare_multiplier: Decimal
    recommendation: str


class PlatformSnapshotRead(BaseModel):
    demand: DemandRead
    surge: SurgeRead
    anomalies: list[AnomalyRead]
    anomaly_count: int
