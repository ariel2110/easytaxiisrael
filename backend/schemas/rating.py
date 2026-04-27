from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    score: int = Field(..., ge=1, le=5, description="Rating 1–5")
    comment: str | None = Field(None, max_length=500)


class RatingRead(BaseModel):
    id: uuid.UUID
    ride_id: uuid.UUID
    rater_id: uuid.UUID
    ratee_id: uuid.UUID
    direction: str
    score: int
    comment: str | None

    model_config = {"from_attributes": True}


class DriverStats(BaseModel):
    driver_id: uuid.UUID
    average_score: float | None
    total_ratings: int
