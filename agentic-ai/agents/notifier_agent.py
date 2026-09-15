"""Notifier / Approval Agent: recommends admin actions and drafts notifications.

When a pickup is flagged for admin review (low confidence, hazardous waste,
possible contamination), this agent reads the classification context and returns:
  - a recommended action (approve, reject, or request_revision)
  - a short summary for the admin dashboard
  - a resident-facing notification message

Python validates the LLM output so bad enum values or empty messages never
leave the agent unchanged.
"""

import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_llm import call_llm, parse_json_response

MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1

VALID_RECOMMENDATIONS = frozenset({"approve", "reject", "request_revision"})


def evaluate_approval_request(
    flag_reason: str,
    category: str,
    confidence: float,
    classification_reasoning: str,
    complaint_description: str | None = None,
) -> dict:
    """Recommend an admin action and draft notification messages.

    Args:
        flag_reason: Why the pickup was flagged (from ApprovalRequest.FlagReason).
        category: Waste category from classification (e.g. "Hazardous", "Recyclable").
        confidence: Classifier confidence between 0 and 1.
        classification_reasoning: Text explanation from the waste classifier.
        complaint_description: Optional resident complaint tied to the same pickup.

    Returns:
        A dict with:
            recommendation:          "approve", "reject", or "request_revision"
            admin_summary:           brief note for the admin review screen
            resident_notification:   message to send the resident after review
            reasoning:               one sentence explaining the recommendation

    Raises:
        ValueError: if the LLM never returns valid JSON or passes validation.
    """
    complaint_block = ""
    if complaint_description:
        complaint_block = f"""
Resident complaint:
{complaint_description.strip()}
"""

    prompt = f"""You are the Notifier / Approval Agent for EcoCycle, a waste pickup platform.

A pickup request was flagged and needs admin review. Recommend what the admin should do
and draft notification text.

Flag reason: {flag_reason.strip()}
Waste category: {category}
Classification confidence: {confidence:.2f}
Classifier reasoning: {classification_reasoning.strip()}
{complaint_block}
Decision guidelines:
- "approve" — flag looks like a false alarm; pickup can proceed.
- "reject" — clear policy violation (hazardous/e-waste, obvious contamination, or complaint confirms a serious issue).
- "request_revision" — unclear evidence; resident should re-submit photos or clarify waste contents.
- If a resident complaint supports the flag, lean toward reject or request_revision.
- If confidence is very low but category is benign, lean toward request_revision rather than reject.
- Keep admin_summary under 2 sentences.
- Keep resident_notification polite, under 3 sentences, and actionable.

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "recommendation": "<approve|reject|request_revision>",
  "admin_summary": "<brief note for admin>",
  "resident_notification": "<message for the resident>",
  "reasoning": "<one sentence explaining the recommendation>"
}}"""

    decision = _ask_llm_for_decision(prompt)
    _validate_decision(decision)
    return decision


def _validate_decision(decision: dict) -> None:
    recommendation = decision.get("recommendation", "").strip().lower()
    if recommendation not in VALID_RECOMMENDATIONS:
        raise ValueError(
            f"LLM recommendation {recommendation!r} is not one of "
            f"{sorted(VALID_RECOMMENDATIONS)}"
        )

    for field in ("admin_summary", "resident_notification", "reasoning"):
        value = decision.get(field, "")
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"LLM returned empty or missing {field!r}")

    decision["recommendation"] = recommendation


def _ask_llm_for_decision(prompt: str) -> dict:
    """Call the LLM until it returns parsable, valid JSON."""
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            decision = parse_json_response(call_llm(prompt))
            _validate_decision(decision)
            return decision
        except ValueError as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS)

    raise ValueError(
        f"LLM did not return valid approval JSON after {MAX_ATTEMPTS} attempts. "
        f"Last error: {last_error}"
    )
