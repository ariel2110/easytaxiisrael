"""
Base agent class — shared LLM caller utilities for all agents.

Supports: OpenAI (GPT-4o), Anthropic (Claude), Groq (Llama/Mixtral), Google (Gemini).
Each method fails gracefully and returns None when the API key is not configured.
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from core.config import settings

log = logging.getLogger(__name__)


class AgentResult:
    """Uniform return type for all agent.run() calls."""

    def __init__(
        self,
        success: bool,
        data: dict,
        raw: str = "",
        model_used: str = "unknown",
    ) -> None:
        self.success = success
        self.data = data
        self.raw = raw
        self.model_used = model_used

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "model_used": self.model_used,
            **self.data,
        }


class BaseAgent(ABC):
    name: str = "base"

    # ── OpenAI ────────────────────────────────────────────────────────────────

    async def _call_openai(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        api_key: str | None = None,
        json_mode: bool = False,
    ) -> str | None:
        key = api_key or settings.OPENAI_API_KEY
        if not key:
            return None

        payload: dict[str, Any] = {"model": model, "messages": messages}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json=payload,
                )
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            log.warning("[%s] OpenAI call failed: %s", self.name, exc)
            return None

    # ── Anthropic (Claude) ────────────────────────────────────────────────────

    async def _call_anthropic(
        self,
        system: str,
        messages: list[dict],
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 2048,
    ) -> str | None:
        key = settings.ANTHROPIC_API_KEY
        if not key:
            return None

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": model,
                        "max_tokens": max_tokens,
                        "system": system,
                        "messages": messages,
                    },
                )
                r.raise_for_status()
                return r.json()["content"][0]["text"]
        except Exception as exc:
            log.warning("[%s] Anthropic call failed: %s", self.name, exc)
            return None

    # ── Groq ──────────────────────────────────────────────────────────────────

    async def _call_groq(
        self,
        messages: list[dict],
        model: str = "llama-3.1-70b-versatile",
        json_mode: bool = True,
    ) -> str | None:
        key = settings.GROQ_API_KEY
        if not key:
            return None

        payload: dict[str, Any] = {"model": model, "messages": messages}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json=payload,
                )
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            log.warning("[%s] Groq call failed: %s", self.name, exc)
            return None

    # ── DeepSeek ──────────────────────────────────────────────────────────────

    async def _call_deepseek(
        self,
        messages: list[dict],
        model: str = "deepseek-chat",
        json_mode: bool = False,
    ) -> str | None:
        key = settings.DEEPSEEK_API_KEY
        if not key:
            return None

        payload: dict[str, Any] = {"model": model, "messages": messages}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json=payload,
                )
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            log.warning("[%s] DeepSeek call failed: %s", self.name, exc)
            return None

    # ── Google Gemini ─────────────────────────────────────────────────────────

    async def _call_gemini(
        self,
        prompt: str,
        model: str = "gemini-1.5-pro",
    ) -> str | None:
        key = settings.GOOGLE_AI_API_KEY
        if not key:
            return None

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={key}"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                r.raise_for_status()
                return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            log.warning("[%s] Gemini call failed: %s", self.name, exc)
            return None

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_json(text: str) -> dict:
        """Extract JSON from LLM response; strips markdown fences if present."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            # Drop first line (```json) and last (```)
            text = "\n".join(lines[1:-1]).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {}

    @abstractmethod
    async def run(self, payload: dict) -> AgentResult: ...
