"""
Security middleware.

1. Rate limiting  — via slowapi (token-bucket per IP).
2. Request ID     — injects X-Request-ID into every response.
3. Security headers — basic hardening headers on every response.
"""

import uuid

from fastapi import FastAPI, Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ---------------------------------------------------------------------------
# Rate limiter (attach to app state)
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


def setup_rate_limiting(app: FastAPI) -> None:
    """Call once during app creation to attach the rate limiter."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# Request ID + Security headers middleware
# ---------------------------------------------------------------------------

async def security_headers_middleware(request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    response: Response = await call_next(request)

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' wss:; "
        "frame-ancestors 'none'"
    )
    # HSTS is set at the Nginx layer for full TLS environments
    return response
