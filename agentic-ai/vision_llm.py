"""Image recognition via the Gemini API.

The local Ollama model is text-only, so when we want the system to actually
'see' a pickup photo we hand the image to Gemini and get back a short factual
description of what is in it. That description is then fed to the local
Classifier model as extra evidence.

Fail-soft by design: describe_image returns None (never raises) on any failure,
so the caller can fall back to description-only classification. But every
failure is now LOGGED (at WARNING) rather than swallowed silently, so a
misconfigured key or an unavailable model is visible instead of mysterious.
"""

import logging
import os
from typing import Optional, Tuple

import requests

logger = logging.getLogger(__name__)

# Read the model from the environment so we are not hard-locked to one that
# Google may gate or retire. gemini-2.5-flash is unavailable to new API keys;
# gemini-3.5-flash is the current working default.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

IMAGE_FETCH_TIMEOUT_SECONDS = 30
# Some image hosts reject the default python-requests UA.
IMAGE_FETCH_HEADERS = {"User-Agent": "EcoCycle-Classifier/1.0 (waste-pickup classifier)"}

_DESCRIBE_PROMPT = (
    "You are helping a waste-management system. Look at this photo and describe "
    "ONLY the discarded items you can see, in one or two plain sentences. "
    "Mention the objects, their likely material, and rough size. "
    "Do not classify or give advice -- just describe what is visible."
)


def describe_image(photo_url: str) -> Optional[str]:
    """Return a short description of the waste in `photo_url`, or None on failure.

    Never raises. Every failure path logs why it fell back.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Not an error -- just not configured. Info, not warning.
        logger.info("GEMINI_API_KEY not set; skipping image recognition.")
        return None

    try:
        image_bytes, mime_type = _fetch_image(photo_url)
    except Exception as error:
        logger.warning("Could not fetch image %s: %s", photo_url, error)
        return None

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
        if not description:
            logger.warning("Gemini (%s) returned an empty description.", GEMINI_MODEL)
            return None
        return description
    except Exception as error:
        # Missing SDK, bad key, unavailable model (404), quota, safety block...
        logger.warning(
            "Gemini image recognition failed (model=%s): %s", GEMINI_MODEL, error
        )
        return None


def _fetch_image(photo_url: str) -> Tuple[bytes, str]:
    """Download the image bytes and detect a usable MIME type."""
    response = requests.get(
        photo_url,
        timeout=IMAGE_FETCH_TIMEOUT_SECONDS,
        headers=IMAGE_FETCH_HEADERS,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "")
    mime_type = content_type.split(";")[0].strip()
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"  # sensible default when the server is vague
    return response.content, mime_type