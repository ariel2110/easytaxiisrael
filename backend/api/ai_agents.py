"""
Admin AI Agents management API.
Provides listing, chat, enable/disable, and key-update for all LLM providers.
Keys are stored in infra/.env (gitignored).
"""
from __future__ import annotations

import os
import re
import httpx
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.config import settings
from core.dependencies import require_roles
from models.user import User, UserRole

router = APIRouter(prefix="/admin/ai-agents", tags=["admin", "ai-agents"])

# ── Agent definitions ────────────────────────────────────────────────────────

AGENT_DEFS: list[dict[str, Any]] = [
    {
        "id": "openai",
        "name": "OpenAI",
        "icon": "🤖",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "default_model": "gpt-4o",
        "key_field": "OPENAI_API_KEY",
        "base_url": "https://api.openai.com/v1/chat/completions",
        "provider": "openai",
    },
    {
        "id": "anthropic",
        "name": "Claude (Anthropic)",
        "icon": "🧠",
        "models": ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
        "default_model": "claude-sonnet-4-5",
        "key_field": "ANTHROPIC_API_KEY",
        "base_url": "https://api.anthropic.com/v1/messages",
        "provider": "anthropic",
    },
    {
        "id": "gemini",
        "name": "Gemini (Google)",
        "icon": "✨",
        "models": ["gemini-flash-latest", "gemini-1.5-pro", "gemini-pro"],
        "default_model": "gemini-flash-latest",
        "key_field": "GOOGLE_AI_API_KEY",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "provider": "gemini",
    },
    {
        "id": "grok",
        "name": "Grok (xAI)",
        "icon": "⚡",
        "models": ["grok-3", "grok-3-fast", "grok-3-mini", "grok-2"],
        "default_model": "grok-3-fast",
        "key_field": "XAI_API_KEY",
        "base_url": "https://api.x.ai/v1/chat/completions",
        "provider": "openai_compat",
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "icon": "🔍",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "default_model": "deepseek-chat",
        "key_field": "DEEPSEEK_API_KEY",
        "base_url": "https://api.deepseek.com/v1/chat/completions",
        "provider": "openai_compat",
    },
    {
        "id": "kimi",
        "name": "Kimi (Moonshot)",
        "icon": "🌙",
        "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        "default_model": "moonshot-v1-8k",
        "key_field": "KIMI_API_KEY",
        "base_url": "https://api.moonshot.cn/v1/chat/completions",
        "provider": "openai_compat",
    },
]


def _get_key(key_field: str) -> str | None:
    return getattr(settings, key_field, None)


def _mask(key: str | None) -> str:
    if not key:
        return ""
    if len(key) <= 12:
        return "•" * len(key)
    return key[:6] + "•" * (len(key) - 10) + key[-4:]


# ── Schemas ──────────────────────────────────────────────────────────────────

class AgentSummary(BaseModel):
    id: str
    name: str
    icon: str
    models: list[str]
    default_model: str
    enabled: bool
    key_masked: str


class ChatRequest(BaseModel):
    message: str
    model: str | None = None


class ChatResponse(BaseModel):
    agent_id: str
    model: str
    reply: str


class UpdateKeyRequest(BaseModel):
    api_key: str


class UpdateKeyResponse(BaseModel):
    agent_id: str
    key_masked: str


# ── Helpers: call each provider ──────────────────────────────────────────────

async def _chat_openai_compat(base_url: str, api_key: str, model: str, message: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": message}], "max_tokens": 1024},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Provider error {r.status_code}: {r.text[:300]}")
    data = r.json()
    return data["choices"][0]["message"]["content"]


async def _chat_anthropic(api_key: str, model: str, message: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": message}]},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Anthropic error {r.status_code}: {r.text[:300]}")
    data = r.json()
    return data["content"][0]["text"]


async def _chat_gemini(api_key: str, model: str, message: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            url,
            headers={"X-goog-api-key": api_key, "Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": message}]}]},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini error {r.status_code}: {r.text[:300]}")
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AgentSummary], summary="List all AI agents")
async def list_agents(
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[AgentSummary]:
    result = []
    for ag in AGENT_DEFS:
        key = _get_key(ag["key_field"])
        result.append(AgentSummary(
            id=ag["id"],
            name=ag["name"],
            icon=ag["icon"],
            models=ag["models"],
            default_model=ag["default_model"],
            enabled=bool(key),
            key_masked=_mask(key),
        ))
    return result


@router.post("/{agent_id}/chat", response_model=ChatResponse, summary="Chat with an AI agent")
async def chat_with_agent(
    agent_id: str,
    body: ChatRequest,
    _: User = Depends(require_roles(UserRole.admin)),
) -> ChatResponse:
    ag = next((a for a in AGENT_DEFS if a["id"] == agent_id), None)
    if not ag:
        raise HTTPException(status_code=404, detail="Agent not found")

    key = _get_key(ag["key_field"])
    if not key:
        raise HTTPException(status_code=503, detail=f"API key not configured for {ag['name']}")

    model = body.model or ag["default_model"]
    provider = ag["provider"]

    if provider == "anthropic":
        reply = await _chat_anthropic(key, model, body.message)
    elif provider == "gemini":
        reply = await _chat_gemini(key, model, body.message)
    else:  # openai or openai_compat
        reply = await _chat_openai_compat(ag["base_url"], key, model, body.message)

    return ChatResponse(agent_id=agent_id, model=model, reply=reply)


@router.put("/{agent_id}/key", response_model=UpdateKeyResponse, summary="Update API key for an agent")
async def update_agent_key(
    agent_id: str,
    body: UpdateKeyRequest,
    _: User = Depends(require_roles(UserRole.admin)),
) -> UpdateKeyResponse:
    ag = next((a for a in AGENT_DEFS if a["id"] == agent_id), None)
    if not ag:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Basic sanity: non-empty
    new_key = body.api_key.strip()
    if not new_key:
        raise HTTPException(status_code=422, detail="API key cannot be empty")

    env_path = "/app/infra/.env"
    # Try both possible paths (container vs host)
    for candidate in ["/app/infra/.env", "/root/rideos-platform/infra/.env"]:
        if os.path.exists(candidate):
            env_path = candidate
            break

    key_field = ag["key_field"]

    # Read, replace or append
    try:
        with open(env_path, "r") as f:
            content = f.read()

        pattern = rf"^{re.escape(key_field)}=.*$"
        new_line = f"{key_field}={new_key}"
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, new_line, content, flags=re.MULTILINE)
        else:
            content = content.rstrip("\n") + f"\n{new_line}\n"

        with open(env_path, "w") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to write .env: {e}")

    # Update live settings object so next request uses the new key
    setattr(settings, key_field, new_key)

    return UpdateKeyResponse(agent_id=agent_id, key_masked=_mask(new_key))


@router.delete("/{agent_id}/key", status_code=204, summary="Disable an AI agent (clear key)")
async def disable_agent(
    agent_id: str,
    _: User = Depends(require_roles(UserRole.admin)),
) -> None:
    ag = next((a for a in AGENT_DEFS if a["id"] == agent_id), None)
    if not ag:
        raise HTTPException(status_code=404, detail="Agent not found")

    env_path = "/root/rideos-platform/infra/.env"
    for candidate in ["/app/infra/.env", "/root/rideos-platform/infra/.env"]:
        if os.path.exists(candidate):
            env_path = candidate
            break

    key_field = ag["key_field"]
    try:
        with open(env_path, "r") as f:
            content = f.read()
        pattern = rf"^{re.escape(key_field)}=.*$"
        content = re.sub(pattern, f"{key_field}=", content, flags=re.MULTILINE)
        with open(env_path, "w") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to write .env: {e}")

    setattr(settings, key_field, None)
