"""
Multi-Agent System API endpoints.

POST /agents/onboard/verify-documents  → OnboardingAgent (document OCR)
POST /agents/support/message           → SupportAgent (chat)
POST /agents/dispatch/match            → DispatchAgent (admin/debug)
GET  /agents/compliance/check-surge    → ComplianceAgent (surge cap check)
POST /agents/compliance/evaluate-driver → ComplianceAgent (driver profile)
"""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from core.dependencies import get_current_user, require_roles
from models.user import User, UserRole
from services.agents.orchestrator import OrchestratorEvent, get_orchestrator

router = APIRouter(prefix="/agents", tags=["agents"])


# ── Request / Response schemas ────────────────────────────────────────────────


class DocumentItem(BaseModel):
    type: Literal["driving_license", "vehicle_registration", "vehicle_insurance"]
    image_url: str | None = None
    image_b64: str | None = None


class OnboardRequest(BaseModel):
    documents: list[DocumentItem] = Field(..., min_length=1)


class SupportMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    ride_id: uuid.UUID | None = None


class DriverDispatchProfile(BaseModel):
    id: str
    lat: float | None = None
    lng: float | None = None
    rating: float = 4.0
    completed_rides: int = 0
    hours_today: float = 0.0
    acceptance_rate: float = 0.8
    current_zone: str | None = None


class DispatchMatchRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    available_drivers: list[DriverDispatchProfile] = Field(..., min_length=1)
    time_of_day: str = "12:00"
    demand_level: float = Field(default=0.5, ge=0.0, le=1.0)


class EvaluateDriverRequest(BaseModel):
    driver_id: str
    license_valid: bool = False
    insurance_valid: bool = False
    avg_weekly_hours: float = 0.0
    hours_today: float = 0.0
    hours_week: float = 0.0


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/onboard/verify-documents")
async def verify_documents(
    body: OnboardRequest,
    current_user: User = Depends(require_roles(UserRole.driver, UserRole.admin)),
):
    """
    Submit driver documents for AI-powered verification (GPT-4o Vision).
    Returns approval status + per-document analysis.
    """
    orch = get_orchestrator()
    return await orch.handle(
        OrchestratorEvent.driver_onboard,
        {
            "documents": [d.model_dump() for d in body.documents],
            "driver": {"id": str(current_user.id)},
        },
    )


@router.post("/support/message")
async def support_message(
    body: SupportMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Send a support message; the AI agent (GPT-4o mini) responds instantly.
    Escalates to a human agent when necessary.
    """
    orch = get_orchestrator()
    return await orch.handle(
        OrchestratorEvent.support_message,
        {
            "message": body.message,
            "user_role": current_user.role.value,
            "context": {"ride_id": str(body.ride_id) if body.ride_id else None},
        },
    )


@router.post("/dispatch/match")
async def dispatch_match(
    body: DispatchMatchRequest,
    _: User = Depends(require_roles(UserRole.admin)),
):
    """
    [Admin / debug] Run the dispatch agent against a provided driver pool.
    In production, dispatch is called internally by the ride service.
    """
    orch = get_orchestrator()
    result = await orch.handle(
        OrchestratorEvent.ride_request,
        {
            **body.model_dump(),
            "available_drivers": [d.model_dump() for d in body.available_drivers],
        },
    )
    return result


@router.get("/compliance/check-surge")
async def check_surge(
    multiplier: float = Query(..., gt=0, le=10),
    _: User = Depends(require_roles(UserRole.admin)),
):
    """Check whether a surge multiplier is legally compliant (≤2.5× per Amendment 142)."""
    orch = get_orchestrator()
    result = await orch.handle(
        OrchestratorEvent.ride_request,
        {"surge_multiplier": multiplier, "available_drivers": [], "pickup_lat": 0, "pickup_lng": 0, "dropoff_lat": 0, "dropoff_lng": 0},
    )
    return result.get("compliance", {})


@router.post("/compliance/evaluate-driver")
async def evaluate_driver(
    body: EvaluateDriverRequest,
    _: User = Depends(require_roles(UserRole.admin)),
):
    """[Admin] Run the compliance agent against a driver profile."""
    from services.agents.compliance_agent import ComplianceAgent
    agent = ComplianceAgent()
    result = await agent.run({"action": "evaluate_driver", "driver": body.model_dump()})
    return result.to_dict()
