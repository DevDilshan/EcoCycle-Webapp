"""Validator Agent: policy checks on a classified pickup.

Two layers:
  1. Deterministic rules (hazardous category, bulk monthly limit) — always run,
     no LLM. Matches backend RewardRules / POST /api/rewards/validate.
  2. Optional LLM policy pass — reads description + classifier output for fuzzy
     issues (contamination, category mismatch). Controlled by VALIDATOR_USE_LLM
     in .env (default on when OPENAI_API_KEY is set).

Use validate_pickup() for rules-only; validate_pickup_full() for the pipeline.
"""

import os
import sys
import time
from datetime import date, datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Reuse the Classifier's category list so the two agents can never disagree
# about which categories exist.
from agents.classifier_agent import VALID_CATEGORIES

HAZARDOUS_CATEGORY = "HAZARDOUS_CATEGORY"
EXCESSIVE_BULK_PICKUPS = "EXCESSIVE_BULK_PICKUPS"

BULK_CATEGORY = "Bulk"
MAX_BULK_PICKUPS_PER_MONTH = 2

# LLM may only emit these codes; they are merged into violated_rules for the pipeline.
LLM_POLICY_RULES = frozenset({
    "POSSIBLE_CONTAMINATION",
    "CATEGORY_DESCRIPTION_MISMATCH",
    "PROHIBITED_ITEMS_MENTIONED",
    "MIXED_WASTE_CONCERN",
})

MAX_LLM_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1


def _llm_validator_enabled() -> bool:
    flag = (os.getenv("VALIDATOR_USE_LLM") or "true").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    return bool(os.getenv("OPENAI_API_KEY"))


def validate_pickup(category: str, resident_history: list, today: date | None = None) -> dict:
    """Check one classified pickup against the business rules.

    Args:
        category: The pickup's waste category from the Classifier Agent,
            e.g. "Hazardous" or "Bulk". Capitalisation is normalised.
        resident_history: The resident's earlier pickups, NOT including this
            one, e.g. [{"category": "Bulk", "created_at": "2026-09-03"}, ...].
            created_at can be a date, a datetime, or an ISO 8601 string.
        today: The date to validate against (UTC). Defaults to today's UTC date;
            tests pass a fixed date so month boundaries are predictable.

    Returns:
        A dict with:
            is_valid:           True when no rule is broken
            violated_rules:     rule codes that were broken, e.g. ["HAZARDOUS_CATEGORY"]
            requires_approval:  True when an admin must review the pickup

    Raises:
        ValueError: if the category or any history entry is invalid.
    """
    current_category = _normalise_category(category)

    if not isinstance(resident_history, list):
        raise ValueError(
            f"resident_history must be a list of past pickups, got {type(resident_history).__name__}"
        )
    history = [_parse_history_entry(entry) for entry in resident_history]

    today = today or datetime.now(timezone.utc).date()
    violated_rules = []

    # Rule 1: hazardous waste always needs an admin to arrange special handling.
    if current_category == "Hazardous":
        violated_rules.append(HAZARDOUS_CATEGORY)

    # Rule 2: max 2 bulk pickups per resident per calendar month (UTC).
    # Only applies when this pickup is itself bulk; the +1 counts this pickup.
    if current_category == BULK_CATEGORY:
        earlier_this_month = sum(
            1
            for past_category, past_date in history
            if past_category == BULK_CATEGORY
            and (past_date.year, past_date.month) == (today.year, today.month)
        )
        if earlier_this_month + 1 > MAX_BULK_PICKUPS_PER_MONTH:
            violated_rules.append(EXCESSIVE_BULK_PICKUPS)

    return {
        "is_valid": not violated_rules,
        "violated_rules": violated_rules,
        "requires_approval": bool(violated_rules),
    }


def validate_pickup_llm(
    *,
    category: str,
    description: str,
    classification_reasoning: str,
    confidence: float,
) -> dict:
    """LLM policy pass: fuzzy checks on text the deterministic rules cannot see.

    Returns:
        violated_rules: allow-listed codes (may be empty)
        reasoning: one short sentence for admins
    """
    description = (description or "").strip()
    classification_reasoning = (classification_reasoning or "").strip()
    if not description:
        return {"violated_rules": [], "reasoning": "No resident description to review."}

    prompt = f"""You are the Policy Validator for EcoCycle, a council waste pickup service.

The waste Classifier already chose a category. Your job is NOT to re-classify — only
to flag policy concerns that need a human reviewer.

Resident description:
{description}

Classifier category: {category}
Classifier confidence: {confidence:.2f}
Classifier reasoning: {classification_reasoning or "(none)"}

Flag requires_review when ANY of these apply:
- Description suggests hazardous, chemical, battery, or e-waste items inconsistent with safe curbside collection
- Description clearly contradicts the classifier category (e.g. "only cardboard" but category Hazardous)
- Obvious mixed/contaminated waste (food + chemicals, sharps, etc.)
- Resident describes items that should not go in a standard pickup

If nothing concerning, set requires_review to false and violated_rules to [].

Use ONLY these violated_rules codes (zero or more):
- POSSIBLE_CONTAMINATION
- CATEGORY_DESCRIPTION_MISMATCH
- PROHIBITED_ITEMS_MENTIONED
- MIXED_WASTE_CONCERN

Respond ONLY with JSON, no extra text:
{{
  "requires_review": true or false,
  "violated_rules": ["<code>", ...],
  "reasoning": "<one sentence for an admin>"
}}"""

    from shared_llm import call_llm, parse_json_response

    last_error = None
    for attempt in range(1, MAX_LLM_ATTEMPTS + 1):
        try:
            parsed = parse_json_response(call_llm(prompt))
            requires_review = bool(parsed.get("requires_review"))
            raw_rules = parsed.get("violated_rules") or []
            if not isinstance(raw_rules, list):
                raise ValueError("violated_rules must be a list")
            rules = []
            for item in raw_rules:
                code = str(item).strip().upper()
                if code in LLM_POLICY_RULES:
                    if code not in rules:
                        rules.append(code)
            reasoning = (parsed.get("reasoning") or "").strip()
            if not reasoning:
                raise ValueError("reasoning must not be empty")
            if requires_review and not rules:
                rules.append("MIXED_WASTE_CONCERN")
            if not requires_review:
                rules = []
            return {"violated_rules": rules, "reasoning": reasoning}
        except ValueError as error:
            last_error = error
            if attempt < MAX_LLM_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS)

    raise ValueError(
        f"LLM policy validation failed after {MAX_LLM_ATTEMPTS} attempts: {last_error}"
    )


def validate_pickup_full(
    *,
    category: str,
    description: str,
    classification_reasoning: str,
    confidence: float,
    resident_history: list,
    today: date | None = None,
) -> dict:
    """Deterministic rules plus optional LLM policy pass (pipeline entry point)."""
    base = validate_pickup(category, resident_history, today=today)
    violated = list(base["violated_rules"])
    llm_review = None

    if _llm_validator_enabled():
        try:
            llm_review = validate_pickup_llm(
                category=category,
                description=description,
                classification_reasoning=classification_reasoning,
                confidence=confidence,
            )
            for code in llm_review.get("violated_rules") or []:
                if code not in violated:
                    violated.append(code)
        except (ValueError, RuntimeError) as error:
            # Fail open: deterministic rules still apply; pickup is not blocked by LLM outage.
            llm_review = {"skipped": True, "error": str(error)}

    return {
        "is_valid": not violated,
        "violated_rules": violated,
        "requires_approval": bool(violated),
        "llm_review": llm_review,
    }


def _normalise_category(category) -> str:
    """Return the canonical category name, or raise if it isn't a known one."""
    if isinstance(category, str):
        cleaned = category.strip().lower()
        for valid in VALID_CATEGORIES:
            if valid.lower() == cleaned:
                return valid
    raise ValueError(f"category {category!r} is not one of {VALID_CATEGORIES}")


def _parse_history_entry(entry) -> tuple:
    """Turn one history dict into (category, UTC date), rejecting bad data."""
    if not isinstance(entry, dict):
        raise ValueError(f"history entry must be a dict, got {entry!r}")
    if entry.get("created_at") is None:
        raise ValueError(f"history entry is missing created_at: {entry!r}")
    return _normalise_category(entry.get("category")), _to_utc_date(entry["created_at"])


def _to_utc_date(value) -> date:
    """Accept a date, datetime, or ISO 8601 string and return its UTC calendar date."""
    if isinstance(value, datetime):
        moment = value
    elif isinstance(value, date):
        return value
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            moment = datetime.fromisoformat(text)
        except ValueError:
            raise ValueError(f"created_at {value!r} is not an ISO 8601 date") from None
    else:
        raise ValueError(f"created_at {value!r} is not a date")

    # Timestamps without a timezone are treated as UTC, matching the backend.
    if moment.tzinfo is None:
        return moment.date()
    return moment.astimezone(timezone.utc).date()
