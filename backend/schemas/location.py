import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LocationPush(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class LocationEventRead(BaseModel):
    id: uuid.UUID
    ride_id: uuid.UUID
    driver_id: uuid.UUID
    lat: float
    lng: float
    recorded_at: datetime

    model_config = {"from_attributes": True}
