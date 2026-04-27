"""
Rating model — passengers rate drivers (and optionally drivers rate passengers)
after a completed ride.  One rating per ride per direction.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base


class RatingDirection(str, enum.Enum):
    passenger_to_driver = "passenger_to_driver"
    driver_to_passenger = "driver_to_passenger"


class Rating(Base):
    """
    Immutable rating left after a completed ride.

    Constraints:
      - score must be 1–5
      - one rating per (ride_id, direction)
    """

    __tablename__ = "ratings"

    __table_args__ = (
        UniqueConstraint("ride_id", "direction", name="uq_ratings_ride_direction"),
        CheckConstraint("score BETWEEN 1 AND 5", name="ck_ratings_score_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rides.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ratee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    direction: Mapped[RatingDirection] = mapped_column(
        Enum(RatingDirection), nullable=False
    )

    score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–5
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships (lazy="raise" to prevent accidental N+1)
    ride = relationship("Ride", lazy="raise")
    rater = relationship("User", foreign_keys=[rater_id], lazy="raise")
    ratee = relationship("User", foreign_keys=[ratee_id], lazy="raise")
