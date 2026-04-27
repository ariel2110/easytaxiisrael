import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from models.ride import RideStatus


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class RideRequest(BaseModel):
    pickup_lat: float = Field(..., ge=-90, le=90, description="Latitude of pickup")
    pickup_lng: float = Field(..., ge=-180, le=180, description="Longitude of pickup")
    dropoff_lat: float = Field(..., ge=-90, le=90, description="Latitude of dropoff")
    dropoff_lng: float = Field(..., ge=-180, le=180, description="Longitude of dropoff")
    pickup_address: str | None = Field(None, max_length=255)
    dropoff_address: str | None = Field(None, max_length=255)

    @model_validator(mode="after")
    def pickup_and_dropoff_differ(self) -> "RideRequest":
        if (
            abs(self.pickup_lat - self.dropoff_lat) < 1e-6
            and abs(self.pickup_lng - self.dropoff_lng) < 1e-6
        ):
            raise ValueError("Pickup and dropoff cannot be the same location")
        return self


class CancelRequest(BaseModel):
    reason: str | None = Field(None, max_length=255)


# ---------------------------------------------------------------------------
# Response bodies
# ---------------------------------------------------------------------------

class RideRead(BaseModel):
    id: uuid.UUID
    passenger_id: uuid.UUID
    driver_id: uuid.UUID | None
    status: RideStatus
    cancellation_reason: str | None

    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    pickup_address: str | None
    dropoff_address: str | None

    created_at: datetime
    assigned_at: datetime | None
    accepted_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    fare_ils: float | None

    model_config = {"from_attributes": True}
