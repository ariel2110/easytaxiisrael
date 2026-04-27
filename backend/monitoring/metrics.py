"""
Prometheus metrics for the RideOS platform.

Exposes /metrics via prometheus-fastapi-instrumentator (standard HTTP metrics)
plus custom business counters.

Import `setup_metrics(app)` once in main.py.
Use the counter/gauge helpers anywhere in service code.
"""

from prometheus_client import Counter, Gauge, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# ---------------------------------------------------------------------------
# Custom business metrics
# ---------------------------------------------------------------------------

rides_created_total = Counter(
    "rideos_rides_created_total",
    "Total number of ride requests created",
)

rides_completed_total = Counter(
    "rideos_rides_completed_total",
    "Total number of rides completed successfully",
)

rides_cancelled_total = Counter(
    "rideos_rides_cancelled_total",
    "Total number of rides cancelled",
)

payments_processed_total = Counter(
    "rideos_payments_processed_total",
    "Total number of payments processed",
    ["status"],  # label: completed | failed
)

revenue_total = Counter(
    "rideos_revenue_total_cents",
    "Cumulative platform revenue in cents (integer to avoid float drift)",
)

active_drivers_gauge = Gauge(
    "rideos_active_drivers",
    "Number of drivers currently online and available",
)

surge_multiplier_gauge = Gauge(
    "rideos_surge_multiplier",
    "Current surge pricing multiplier",
)

anomalies_detected_total = Counter(
    "rideos_anomalies_detected_total",
    "Total anomalies detected by the AI layer",
    ["anomaly_type"],
)

auth_errors_total = Counter(
    "rideos_auth_errors_total",
    "Authentication / authorisation failures",
)

ws_connections_active = Gauge(
    "rideos_ws_connections_active",
    "Currently open WebSocket connections",
)

# ---------------------------------------------------------------------------
# HTTP request duration histogram (supplement to instrumentator)
# ---------------------------------------------------------------------------

request_duration = Histogram(
    "rideos_http_request_duration_seconds",
    "HTTP request latency by route",
    ["method", "route"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)


# ---------------------------------------------------------------------------
# Setup helper
# ---------------------------------------------------------------------------

def setup_metrics(app) -> None:
    """
    Attach Prometheus instrumentation to the FastAPI app.
    Exposes /metrics (no auth — restrict at Nginx level in production).
    """
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/health"],
    ).instrument(app).expose(app, endpoint="/metrics")
