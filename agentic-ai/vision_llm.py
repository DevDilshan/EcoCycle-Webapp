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
import ipaddress
import json
import logging
import os
import socket
from typing import Optional, Tuple
from urllib.parse import urlparse

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
    _require_public_https_url(photo_url)
    response = requests.get(
        photo_url,
        timeout=IMAGE_FETCH_TIMEOUT_SECONDS,
        headers=IMAGE_FETCH_HEADERS,
        # A redirect could point back inside the network after the check above.
        allow_redirects=False,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "")
    mime_type = content_type.split(";")[0].strip()
    if not mime_type.startswith("image/"):
        mime_type = "image/jpeg"  # sensible default when the server is vague
    return response.content, mime_type


def _require_public_https_url(photo_url: str) -> None:
    """Refuse a photo URL that does not point at a public https address.

    The URL is supplied by the resident, and this service fetches it from inside
    the deployment. Without this check it could be pointed at localhost, a
    private address or a cloud metadata endpoint.
    """
    parsed = urlparse(photo_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Photo URL must be an https address.")

    port = parsed.port or 443
    for info in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError("Photo URL does not point at a public address.")


_VALIDATE_PROMPT = (
    "You are the upload gatekeeper for a household waste-pickup app. A resident "
    "uploaded this photo to request a waste collection. Judge two SEPARATE and "
    "INDEPENDENT things:\n"
    "1. is_clear: purely about image QUALITY. Can you make out what the photo "
    "shows? Set true if it is in focus and well-lit, EVEN IF the subject is not "
    "waste (a sharp selfie, a clear photo of a room, etc. are all is_clear=true). "
    "Set false ONLY when the image itself is unusable -- blurry, badly out of "
    "focus, too dark, overexposed, or just noise. Do NOT set false merely because "
    "the photo does not contain waste; that is the job of is_waste below.\n"
    "2. is_waste: purely about CONTENT. Does it show discarded waste, trash, "
    "recycling, or bulky/hazardous items to be collected? Set false if the main "
    "subject is something else (a person or selfie, a pet, a plain room or street, "
    "food being eaten, a document, etc.), regardless of how clear the photo is.\n"
    "Reply with ONLY a JSON object using exactly these keys:\n"
    '{"is_clear": true/false, "is_waste": true/false, "reason": "<one short sentence>"}'
)


def _validation_skipped(reason: str = "validation skipped") -> dict:
    # Fail-open: if we cannot check, do not block the resident's submission.
    return {"checked": False, "is_clear": True, "is_waste": True, "reason": reason}


def validate_waste_image(photo_url: str) -> dict:
    """Check that `photo_url` is a clear photo of actual waste.

    Returns {checked, is_clear, is_waste, reason}. `checked` is False when the
    check could not run (no key, unfetchable URL, model error) -- callers treat
    that as "could not verify" and let the submission through. Never raises.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.info("OPENAI_API_KEY not set; skipping image validation.")
        return _validation_skipped()

    try:
        image_bytes, mime_type = _fetch_image(photo_url)
    except Exception as error:
        logger.warning("Could not fetch image for validation %s: %s", photo_url, error)
        return _validation_skipped()

    try:
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
                            {"type": "text", "text": _VALIDATE_PROMPT},
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
                "response_format": {"type": "json_object"},
            },
            timeout=VISION_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = (response.json()["choices"][0]["message"]["content"] or "").strip()
        data = json.loads(content)
        return {
            "checked": True,
            "is_clear": bool(data.get("is_clear", True)),
            "is_waste": bool(data.get("is_waste", True)),
            "reason": str(data.get("reason", "")),
        }
    except Exception as error:
        logger.warning(
            "OpenAI image validation failed (model=%s): %s", OPENAI_VISION_MODEL, error
        )
        return _validation_skipped()
