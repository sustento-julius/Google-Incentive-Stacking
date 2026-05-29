"""Thin wrapper around Google Gemini with a no-op fallback.

If ``GEMINI_API_KEY`` is set and ``google-genai`` is installed, ``LLMClient``
calls Gemini. Otherwise ``available`` is False and callers use their own
deterministic templates. This keeps the whole pipeline runnable with zero
external dependencies while letting Gemini elevate the prose when present.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from ..config import Settings

log = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self._client = None
        self._init_error: str | None = None
        if self.settings.has_llm:
            self._try_init()

    def _try_init(self) -> None:
        try:
            from google import genai

            self._client = genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options={"headers": {"User-Agent": "three-mins-local"}},
            )
        except Exception as exc:  # pragma: no cover - depends on env
            self._init_error = str(exc)
            log.warning("Gemini client init failed (%s); using templates.", exc)
            self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None

    def generate(self, prompt: str, system: str = "", temperature: float = 0.8) -> Optional[str]:
        """Return generated text, or None if the LLM is unavailable/failed."""
        if not self.available:
            return None
        try:
            config: dict[str, Any] = {"temperature": temperature}
            if system:
                config["system_instruction"] = system
            resp = self._client.models.generate_content(
                model=self.settings.llm_model,
                contents=prompt,
                config=config,
            )
            return (resp.text or "").strip() or None
        except Exception as exc:  # pragma: no cover - network/runtime
            log.warning("Gemini generation failed (%s); using template.", exc)
            return None

    def generate_json(self, prompt: str, system: str = "", temperature: float = 0.7) -> Optional[dict]:
        """Generate and parse a JSON object, tolerating ```json fences."""
        raw = self.generate(prompt, system=system, temperature=temperature)
        if not raw:
            return None
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to salvage the outermost {...}.
            start, end = cleaned.find("{"), cleaned.rfind("}")
            if 0 <= start < end:
                try:
                    return json.loads(cleaned[start : end + 1])
                except json.JSONDecodeError:
                    return None
            return None
