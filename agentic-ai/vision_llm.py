"""Image recognition via the OpenAI API.

When a pickup has a photo, we hand the image to an OpenAI vision model and get
back a short factual description of what is in it. That description is then
fed to the Classifier's prompt as extra evidence.

Uses the same OPENAI_API_KEY as every other agent (see shared_llm.py), so the
agent service needs only one provider key.

Fail-soft by design: describe_image returns None (never raises) on any failure,
so the caller can fall back to description-only classification. But every
failure is LOGGED (at WARNING) rather than swallowed silently, so a
misconfigured key or an unavailable model is visible instead of mysterious.
"""

import base64
import logging
import os
from typing import Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
# Read the model from the environment so we are not hard-locked to one model.
# It must be a vision-capable model; gpt-4o-mini is, and is what the other
# agents already use.
OPENAI_VISION_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini")

IMAGE_FETCH_TIMEOUT_SECONDS = 30
VISION_REQUEST_TIMEOUT_SECONDS = 30
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
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # Not an error -- just not configured. Info, not warning.
        logger.info("OPENAI_API_KEY not set; skipping image recognition.")
        return None

    try:
        image_bytes, mime_type = _fetch_image(photo_url)
    except Exception as error:
        logger.warning("Could not fetch image %s: %s", photo_url, error)
        return None

    try:
        # The image is sent inline as a data URL rather than by link, so the
        # model sees exactly the bytes we fetched and OpenAI never has to reach
        # the storage host itself.
        encoded = base64.b64encode(image_bytes).decode("ascii")
        response = requests.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _DESCRIBE_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{encoded}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 200,
            },
            timeout=VISION_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        description = (response.json()["choices"][0]["message"]["content"] or "").strip()
        if not description:
            logger.warning(
                "OpenAI (%s) returned an empty description.", OPENAI_VISION_MODEL
            )
            return None
        return description
    except Exception as error:
        # Bad key, unavailable model, quota, timeout, unexpected response shape...
        logger.warning(
            "OpenAI image recognition failed (model=%s): %s", OPENAI_VISION_MODEL, error
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