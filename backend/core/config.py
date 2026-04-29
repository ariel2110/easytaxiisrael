import base64

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_ENV: str = "development"
    DEBUG: bool = False
    APP_TITLE: str = "RideOS Platform API"
    APP_VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rideos"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    # Fare
    FARE_BASE: float = 2.50        # flat base fare in currency units
    FARE_PER_KM: float = 1.20      # per-kilometre rate
    PLATFORM_FEE_PCT: float = 15.0 # platform cut as a percentage of total
    TAX_PCT: float = 10.0          # tax as a percentage of total

    # Security — must be a valid 32-byte URL-safe base64 Fernet key.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str

    # CORS — comma-separated list of allowed origins (production)
    CORS_ORIGINS: str = "https://easytaxiisrael.com,https://www.easytaxiisrael.com,https://driver.easytaxiisrael.com"

    # WhatsApp (Evolution API)
    EVOLUTION_URL: str = "http://evolution-api:8080"
    EVOLUTION_API_KEY: str = "evolution_secret"
    EVOLUTION_INSTANCE: str = "easytaxi"
    # Platform's own WhatsApp phone number (digits only, with country code, no +)
    # Users send auth messages TO this number.
    WHATSAPP_PLATFORM_PHONE: str = "972546363350"

    # Persona KYC (https://withpersona.com)
    PERSONA_API_KEY: str = ""
    PERSONA_WEBHOOK_SECRET: str = ""
    PERSONA_TEMPLATE_ID: str = ""                    # Template 1: GovID (ת"ז) + Driver License + Selfie (liveness video)
    PERSONA_VEHICLE_TEMPLATE_ID: str = "itmpl_ACtCnpSYUfM5hTMSUV5UYzeYfVZZUx"  # Template 2: vehicle docs (ביטוח + טסט + רישוי)
    PERSONA_TAXI_LICENSE_TEMPLATE_ID: str = ""       # Template 3: רישיון נהיגה לרכב שכור (licensed_taxi only)
    PERSONA_API_VERSION: str = "2025-12-08"
    DRIVER_APP_URL: str = "https://driver.easytaxiisrael.com"  # used as redirect-uri after Persona KYC

    # ── Multi-Agent System — LLM API keys (all optional; agents fall back gracefully) ──
    # Onboarding + Support agents (GPT-4o Vision / GPT-4o mini)
    OPENAI_API_KEY: str | None = None
    # Compliance & Legal agent (Claude 3.5 Sonnet)
    ANTHROPIC_API_KEY: str | None = None
    # Dispatch agent (Llama 3.1 70B via Groq — ultra-low latency)
    GROQ_API_KEY: str | None = None
    # Orchestrator (Gemini 1.5 Pro — 2M token context)
    GOOGLE_AI_API_KEY: str | None = None
    # xAI / Grok
    XAI_API_KEY: str | None = None
    # DeepSeek
    DEEPSEEK_API_KEY: str | None = None
    # Kimi (Moonshot AI)
    KIMI_API_KEY: str | None = None
    # Serper (Google Search API)
    SERPER_API_KEY: str | None = None
    # Google Maps Platform
    GOOGLE_MAPS_API_KEY: str | None = None

    # Admin password login
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_fernet_key(cls, v: str) -> str:
        """
        Fernet requires a 32-byte key encoded as URL-safe base64 (44 chars).
        In DEBUG / development the default placeholder is allowed through with
        a warning; in production the app must fail fast.
        """
        try:
            raw = base64.urlsafe_b64decode(v + "==")  # add padding for safety
            if len(raw) != 32:
                raise ValueError("Decoded key must be exactly 32 bytes")
        except Exception as exc:
            # Treat as fatal in production; in dev just warn
            import os
            if os.getenv("APP_ENV", "development") == "production":
                raise ValueError(
                    "ENCRYPTION_KEY must be a valid Fernet key (32-byte URL-safe base64). "
                    "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                ) from exc
            import warnings
            warnings.warn(
                f"ENCRYPTION_KEY is not a valid Fernet key ({exc}). "
                "This is acceptable in development but WILL crash in production.",
                stacklevel=2,
            )
        return v


settings = Settings()
