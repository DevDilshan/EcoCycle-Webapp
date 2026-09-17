"""Classifier Agent: decides what kind of waste a pickup request contains.

Two models cooperate:
  * Gemini (vision) 'looks' at the photo and describes the items -- image
    recognition the local text model cannot do itself.
  * The local Ollama model makes the actual category judgement, using the
    resident's description plus (when available) Gemini's visual description.

If image recognition is unavailable for any reason, the agent falls back to
classifying from the resident's text alone. The category is always validated
against an allow-list and the confidence clamped to 0..1, because small models
occasionally invent both.
"""

import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_llm import call_llm, parse_json_response
from vision_llm import describe_image

MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1

# The only categories the downstream system understands (must match the C#
# WasteCategory enum). Checked so a hallucinated category never reaches the DB.
VALID_CATEGORIES = ["General", "Recyclable", "Organic", "Hazardous", "Bulk"]


def classify_waste(photo_url: str, description: str) -> dict:
    """Classify a pickup request's waste from its photo and description.

    Returns a dict with keys:
        category:   one of VALID_CATEGORIES (validated)
        confidence: float in 0.0..1.0 (clamped)
        reasoning:  short explanation
        image_used: True if Gemini's visual description was included, else False

    Raises:
        ValueError: if `description` is empty, or the local model never returns
            a valid classification across all attempts.
    """
    if not description or not description.strip():
        raise ValueError("description must not be empty")

    # Image recognition (Gemini). None on any failure -> description-only.
    visual_description = describe_image(photo_url) if photo_url else None

    prompt = _build_prompt(description, visual_description)
    result = _ask_llm_for_classification(prompt)

    return {
        "category": _validate_category(result.get("category")),
        "confidence": _clamp_confidence(result.get("confidence")),
        "reasoning": result.get("reasoning", ""),
        "image_used": visual_description is not None,
    }


def _build_prompt(description: str, visual_description) -> str:
    categories_text = ", ".join(VALID_CATEGORIES)

    if visual_description:
        evidence = (
            f"Resident's description: {description}\n"
            f"What the photo shows (image recognition): {visual_description}"
        )
    else:
        evidence = (
            f"Resident's description: {description}\n"
            f"(No photo analysis available -- classify from the description alone.)"
        )

    return f"""You are the Classifier Agent for a waste pickup system.

Classify the waste described below into exactly ONE category.

{evidence}

Categories:
- General: ordinary household rubbish, not recyclable, organic, or hazardous
- Recyclable: paper, cardboard, glass, plastics, metal cans
- Organic: food scraps, garden and plant waste
- Hazardous: chemicals, batteries, paint, electronics, coolant, anything toxic
- Bulk: large items such as furniture, mattresses, or appliances

Rules:
- The category must be copied EXACTLY from this list: {categories_text}
- confidence is your certainty from 0.0 (guessing) to 1.0 (certain).

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "category": "<one category from the list>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<one sentence explaining the choice>"
}}"""


def _validate_category(category) -> str:
    """Return the canonical category, or raise if the model invented one."""
    if category in VALID_CATEGORIES:
        return category
    if isinstance(category, str):
        cleaned = category.strip().lower()
        for valid in VALID_CATEGORIES:
            if valid.lower() == cleaned:
                return valid
    raise ValueError(
        f"LLM returned category {category!r}, which is not one of {VALID_CATEGORIES}"
    )


def _clamp_confidence(value) -> float:
    """Coerce the model's confidence into a float in 0.0..1.0."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, number))


def _ask_llm_for_classification(prompt: str) -> dict:
    """Call the local model until it returns parsable JSON, up to MAX_ATTEMPTS."""
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return parse_json_response(call_llm(prompt))
        except ValueError as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS)

    raise ValueError(
        f"LLM did not return valid JSON after {MAX_ATTEMPTS} attempts. "
        f"Last error: {last_error}"
    )