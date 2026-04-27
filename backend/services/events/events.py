from enum import Enum


class RideEvent(str, Enum):
    ride_requested    = "ride_requested"
    driver_found      = "driver_found"
    driver_assigned   = "driver_assigned"
    driver_not_found  = "driver_not_found"
    ride_accepted     = "ride_accepted"
    ride_rejected     = "ride_rejected"
    ride_started      = "ride_started"
    ride_completed    = "ride_completed"
    ride_cancelled    = "ride_cancelled"
    location_updated  = "location_updated"
    payment_processed = "payment_processed"
    payment_failed    = "payment_failed"


class DriverEvent(str, Enum):
    documents_uploaded   = "documents_uploaded"
    onboarding_completed = "onboarding_completed"
    onboarding_rejected  = "onboarding_rejected"
    driver_blocked       = "driver_blocked"
    driver_unblocked     = "driver_unblocked"
    hours_limit_warning  = "hours_limit_warning"
    hours_limit_exceeded = "hours_limit_exceeded"


class SupportEvent(str, Enum):
    message_received   = "message_received"
    escalated_to_human = "escalated_to_human"
    ticket_resolved    = "ticket_resolved"
