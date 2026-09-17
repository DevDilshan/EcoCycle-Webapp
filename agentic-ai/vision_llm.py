"""Image recognition via the Gemini API.

The local Ollama model is text-only, so when we want the system to actually
'see' a pickup photo we hand the image to Gemini and get back a short factual
description of what is in it. That description is then fed to the local
Classifier model as extra evidence.

This module is deliberately fail-soft: describe_image returns None (never
raises) whenever the key is missing, the SDK is absent, the network is down,
the photo cannot be fetched, or Gemini errors -- so the caller can fall back to
description-only classification instead of the whole pipeline crashing.
"""

import os
from typing import Optional, Tuple

import requests

GEMINI_MODEL = "gemini-2.5-flash"
IMAGE_FETCH_TIMEOUT_SECONDS = 30

_DESCRIBE_PROMPT = (
    "You are helping a waste-management system. Look at this photo and describe "
    "ONLY the discarded items you can see, in one or two plain sentences. "
    "Mention the objects, their likely material, and rough size. "
    "Do not classify or give advice -- just describe what is visible."
)


def describe_image(photo_url: str) -> Optional[str]:
    """Return a short description of the waste in `photo_url`, or None on failure.

    Every failure mode collapses to None so the classifier can fall back to the
    resident's text description. Nothing here raises.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        image_bytes, mime_type = _fetch_image(photo_url)
    except Exception:
        return None  # unreachable URL, timeout, non-image, etc.

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                _DESCRIBE_PROMPT,
            ],
        )
        description = (response.text or "").strip()
        return description or None
    except Exception:
        # Missing SDK, bad key, quota, network, safety block -- all non-fatal.
        return None


def _fetch_image(photo_url: str) -> Tuple[bytes, str]:
    """Download the image bytes and detect a usable MIME type."""
    response = requests.get(photo_url, timeout=IMAGE_FETCH_TIMEOUT_SECONDS)
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "")
    mime_type = content_type.split(";")[0].strip()
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"  # sensible default when the server is vague

    return response.content, mime_type