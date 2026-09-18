"""Validator Agent: checks a classified pickup against EcoCycle's business rules.

Unlike the Classifier and Routing agents, this one does not call the LLM. The
rules are deterministic ("hazardous waste needs special handling", "max 2 bulk
pickups per resident per month"), so they are plain Python: the same input
always gives the same verdict, and every verdict is explained by the rule codes
it returns.

The rule codes and limits match the backend's RewardRules (C#), so this agent
and POST /api/rewards/validate always reach the same decision.
"""

import os
import sys
from datetime import date, datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Reuse the Classifier's category list so the two agents can never disagree
# about which categories exist.
from agents.classifier_agent import VALID_CATEGORIES

HAZARDOUS_CATEGORY = "HAZARDOUS_CATEGORY"
EXCESSIVE_BULK_PICKUPS = "EXCESSIVE_BULK_PICKUPS"

BULK_CATEGORY = "Bulk"
MAX_BULK_PICKUPS_PER_MONTH = 2


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
