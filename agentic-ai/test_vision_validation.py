"""Deterministic tests for the waste-photo validator (vision_llm).

Run from the agentic-ai folder:
    python -m pytest test_vision_validation.py -v

This is the check behind the pickup form's "the photo is not clear / not waste"
messages. The OpenAI vision call and the image download are stubbed, so the
tests are offline and deterministic. They assert the response SCHEMA, the
fail-open behaviour (never block a resident when the check cannot run), and that
the two judgements -- is_clear and is_waste -- are reported independently.
"""
import pytest

import vision_llm
from vision_llm import validate_waste_image


class _FakeResponse:
    """Minimal stand-in for a requests.Response carrying a chat-completion body."""
    def __init__(self, content: str):
        self._content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def _stub_vision(monkeypatch, content: str):
    """Make the key present, the image 'downloadable', and the model reply `content`."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")
    monkeypatch.setattr(vision_llm, "_fetch_image", lambda url: (b"fake-bytes", "image/jpeg"))
    monkeypatch.setattr(vision_llm.requests, "post", lambda *a, **k: _FakeResponse(content))


EXPECTED_KEYS = {"checked", "is_clear", "is_waste", "reason"}


# --- schema ---------------------------------------------------------------

def test_result_always_has_the_four_keys(monkeypatch):
    _stub_vision(monkeypatch, '{"is_clear": true, "is_waste": true, "reason": "ok"}')
    result = validate_waste_image("https://example.com/x.jpg")
    assert set(result.keys()) == EXPECTED_KEYS


# --- the two judgements are independent -----------------------------------

def test_clear_waste_photo_passes(monkeypatch):
    _stub_vision(monkeypatch, '{"is_clear": true, "is_waste": true, "reason": "bin bags"}')
    result = validate_waste_image("https://example.com/waste.jpg")
    assert result["checked"] is True
    assert result["is_clear"] is True
    assert result["is_waste"] is True


def test_blurry_photo_is_flagged_not_clear(monkeypatch):
    _stub_vision(monkeypatch, '{"is_clear": false, "is_waste": true, "reason": "out of focus"}')
    result = validate_waste_image("https://example.com/blurry.jpg")
    assert result["checked"] is True
    assert result["is_clear"] is False


def test_clear_selfie_is_clear_but_not_waste(monkeypatch):
    # The exact case the prompt fix targets: a sharp photo that is not waste must
    # come back is_clear=true, is_waste=false (so the UI says "not waste").
    _stub_vision(monkeypatch, '{"is_clear": true, "is_waste": false, "reason": "a person"}')
    result = validate_waste_image("https://example.com/selfie.jpg")
    assert result["is_clear"] is True
    assert result["is_waste"] is False


# --- fail-open ------------------------------------------------------------

def test_missing_api_key_skips_and_lets_the_submission_through(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = validate_waste_image("https://example.com/x.jpg")
    assert result["checked"] is False
    assert result["is_clear"] is True
    assert result["is_waste"] is True


def test_unfetchable_image_skips(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")

    def _boom(url):
        raise RuntimeError("cannot fetch")

    monkeypatch.setattr(vision_llm, "_fetch_image", _boom)
    result = validate_waste_image("https://example.com/x.jpg")
    assert result["checked"] is False
    assert result["is_clear"] is True
    assert result["is_waste"] is True


def test_malformed_model_reply_skips(monkeypatch):
    # The model answered, but not with JSON -> treated as "could not verify".
    _stub_vision(monkeypatch, "sorry, I can't do that")
    result = validate_waste_image("https://example.com/x.jpg")
    assert result["checked"] is False
