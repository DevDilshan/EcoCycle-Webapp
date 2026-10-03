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


def _ask_llm_for_json(prompt: str) -> dict:
    """Call the LLM until it returns parsable JSON, with no field validation.

    Separate from _ask_llm_for_decision, which also enforces the approval
    recommendation enum. Reusing that one here made every call fail: this prompt
    has no recommendation to return.
    """
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


def explain_missed_collection(
    reason: str,
    description: str,
    next_visit: str | None = None,
) -> dict:
    """Turn a collector's shorthand into something a resident can read.

    A crew types "gate locked" or "bin not out" -- true, but curt, and written
    for the office rather than the household. Shown to a resident unchanged it
    reads as a complaint about them.

    Args:
        reason: What the collector wrote at the stop.
        description: What the pickup was, so the message can name it.
        next_visit: The rebooked date as "YYYY-MM-DD", or None if there is none.

    Returns:
        A dict with:
            resident_message: a short, plain message for the household
            admin_summary:    one line for the office

    Raises:
        ValueError: if the LLM never returns valid JSON.
    """
    if not reason or not reason.strip():
        raise ValueError("reason must not be empty")

    next_line = (
        f"The collection has been rebooked for {next_visit}."
        if next_visit
        else "No new date has been arranged yet."
    )

    prompt = f"""You are the Notifier Agent for a council waste collection service.

A collection could not be made. Write the message the resident will see.

What was being collected: {description or "a waste pickup"}
What the crew reported: {reason}
{next_line}

Rules for the resident message:
- Two sentences at most.
- Say plainly why it could not be collected.
- If there is a new date, say it.
- If the resident needs to do something differently, say it once, politely.
- Do not blame, lecture, or apologise at length. No greeting, no sign-off.

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "resident_message": "<what the household sees>",
  "admin_summary": "<one line for the office>"
}}"""

    result = _ask_llm_for_json(prompt)

    message = (result.get("resident_message") or "").strip()
    if not message:
        raise ValueError("LLM returned no resident_message")

    return {
        "resident_message": message,
        "admin_summary": (result.get("admin_summary") or "").strip(),
    }


def explain_decision(approved: bool, reason: str, description: str) -> dict:
    """Write the message a resident sees after an admin decides on their pickup.

    A rejection reason is written for the office -- "exceeds bulky limit",
    "hazardous, unlicensed vehicle". Shown to a household unchanged it reads as
    a refusal with no explanation and nothing they can do next.

    Args:
        approved: True if the pickup was approved, False if refused.
        reason: The admin's note or the flag reason, in their words.
        description: What the pickup was, so the message can name it.

    Returns:
        A dict with resident_message.

    Raises:
        ValueError: if the LLM never returns valid JSON.
    """
    if not reason or not reason.strip():
        raise ValueError("reason must not be empty")

    outcome = "approved and will be collected" if approved else "cannot be collected"

    prompt = f"""You are the Notifier Agent for a council waste collection service.

An admin has reviewed a pickup request. Write the message the resident sees.

What they asked to have collected: {description or "a waste pickup"}
The decision: the request {outcome}.
The reason given: {reason}

Rules:
- Two sentences at most.
- Say the outcome first, plainly.
- Give the reason in everyday words, not council shorthand.
- If it cannot be collected, say what they can do instead, if anything obvious
  follows from the reason. Do not invent a service that was not mentioned.
- No greeting, no sign-off, no apologising at length.

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "resident_message": "<what the household sees>"
}}"""

    result = _ask_llm_for_json(prompt)

    message = (result.get("resident_message") or "").strip()
    if not message:
        raise ValueError("LLM returned no resident_message")

    return {"resident_message": message}
