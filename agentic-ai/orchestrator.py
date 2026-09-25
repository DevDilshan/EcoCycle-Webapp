"""Orchestrator: runs one pickup request through all four agents in order.

Classifier -> Validator -> Routing -> Notifier/Approval.

Each agent takes flat arguments rather than a request dict, so the job here is
to unpack one pickup_request into the four different call shapes and collect
the results back into a single response the backend can persist in one go.

Two of the four steps are conditional, because both cost an LLM round trip:

  * Routing is skipped when the Validator found a broken business rule. There
    is no point assigning a collector to a pickup that cannot go ahead, and
    persisting that assignment would inflate the collector's load and push the
    next genuine pickup to someone else. A flagged pickup is routed after an
    admin approves it, against the collector loads as they are at that point.
  * The Notifier only runs when the pickup was actually flagged; it has
    nothing to say about a clean one.

Low confidence alone does NOT gate routing. A barely-confident "Recyclable" is
still almost certainly collectable, and holding it back would delay a
legitimate pickup for a precaution -- only a broken rule stops the assignment.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents.classifier_agent import classify_waste
from agents.notifier_agent import evaluate_approval_request
from agents.routing_agent import route_pickup
from agents.validator_agent import validate_pickup

# Below this, the classifier is guessing enough that a human should look even
# when no business rule was broken. Must stay in step with
# ComplianceRules.LowConfidenceThreshold on the C# side, which runs a second
# pass over this pipeline's result -- if the two drift, a pickup can pass here
# and be flagged there for the same confidence.
LOW_CONFIDENCE_THRESHOLD = 0.70

LOW_CONFIDENCE_FLAG = "LOW_CLASSIFICATION_CONFIDENCE"


def run_pipeline(pickup_request: dict) -> dict:
    """Run one pickup request through the full agent pipeline.

    Args:
        pickup_request: A dict describing the request:
            description:        required, the resident's own words
            photo_url:          optional, image for Gemini recognition
            resident_zone_id:   required, zone used for routing
            collector_loads:    required, {collector_id: pickups_assigned}
            resident_history:   optional, past pickups for the bulk-limit rule
            complaint_description: optional, resident complaint to weigh

    Returns:
        A dict with:
            classification: the Classifier's output
            validation:     the Validator's output
            routing:        the Routing Agent's output, or None when a business
                            rule was broken and the pickup was not assigned
            approval:       the Notifier's output, or None if not flagged
            flag_reason:    why review was needed, or None
            requires_approval: True when an admin must review this pickup

    Raises:
        ValueError: if a required field is missing, or any agent rejects its
            input or the model's output.
    """
    description = pickup_request.get("description")
    resident_zone_id = pickup_request.get("resident_zone_id")
    collector_loads = pickup_request.get("collector_loads")

    if not description or not str(description).strip():
        raise ValueError("pickup_request is missing 'description'")
    if not resident_zone_id:
        raise ValueError("pickup_request is missing 'resident_zone_id'")
    if not collector_loads:
        raise ValueError("pickup_request is missing 'collector_loads'")

    # 1. Classifier: what kind of waste is this?
    classification = classify_waste(
        photo_url=pickup_request.get("photo_url"),
        description=description,
    )
    category = classification["category"]

    # 2. Validator: does the category break a business rule? No LLM call here,
    #    so it is deterministic and free -- run it before spending anything.
    validation = validate_pickup(
        category=category,
        resident_history=pickup_request.get("resident_history") or [],
        today=pickup_request.get("today"),
    )

    # 3. Routing: which collector takes it? Gated on the rules specifically,
    #    not on requires_approval, so a low-confidence pickup still gets
    #    assigned while a hazardous one waits for an admin.
    routing = None
    if not validation["violated_rules"]:
        routing = route_pickup(
            category=category,
            resident_zone_id=resident_zone_id,
            collector_loads=collector_loads,
        )

    # 4. Notifier: only when something actually needs an admin's attention.
    flag_reason = _build_flag_reason(classification, validation)
    approval = None
    if flag_reason:
        approval = evaluate_approval_request(
            flag_reason=flag_reason,
            category=category,
            confidence=classification["confidence"],
            classification_reasoning=classification["reasoning"],
            complaint_description=pickup_request.get("complaint_description"),
        )

    return {
        "classification": classification,
        "validation": validation,
        "routing": routing,
        "approval": approval,
        "flag_reason": flag_reason,
        "requires_approval": flag_reason is not None,
    }


def route_approved_pickup(pickup_request: dict, pipeline_result: dict) -> dict:
    """Assign a collector to a flagged pickup that an admin has since approved.

    run_pipeline() deliberately leaves routing = None when a business rule was
    broken, so a pickup coming out of admin review has no collector yet. Call
    this once the admin approves it; the backend then stores the returned
    routing exactly as it would have stored run_pipeline()'s.

    `pickup_request["collector_loads"]` must be the loads as they are NOW, not
    the snapshot taken when the resident submitted. That freshness is the whole
    reason routing was deferred rather than done up front: a pickup can sit in
    the review queue for days, and the collector who was quietest then is not
    necessarily the quietest now.

    Args:
        pickup_request: Needs resident_zone_id and a CURRENT collector_loads.
        pipeline_result: What run_pipeline() returned for this pickup, so the
            stored category is reused instead of re-classifying (which would
            cost another LLM call and could return a different answer).

    Returns:
        The Routing Agent's output, same shape as run_pipeline()'s "routing".

    Raises:
        ValueError: if a required field is missing, if this pickup never
            needed approval, or if it was already routed.
    """
    resident_zone_id = pickup_request.get("resident_zone_id")
    collector_loads = pickup_request.get("collector_loads")

    if not resident_zone_id:
        raise ValueError("pickup_request is missing 'resident_zone_id'")
    if not collector_loads:
        raise ValueError(
            "pickup_request is missing 'collector_loads' -- pass the CURRENT "
            "loads, not the ones captured when the pickup was submitted"
        )

    # Guard the two ways this gets called wrongly: on a pickup that was never
    # held back, and on one that already has a collector. Either would hand a
    # second assignment to the scheduler for a single pickup.
    if not pipeline_result.get("requires_approval"):
        raise ValueError(
            "this pickup did not require approval; it was already routed by "
            "run_pipeline()"
        )
    if pipeline_result.get("routing") is not None:
        raise ValueError(
            "this pickup already has a routing decision: "
            f"{pipeline_result['routing']['collector_id']}"
        )

    return route_pickup(
        category=pipeline_result["classification"]["category"],
        resident_zone_id=resident_zone_id,
        collector_loads=collector_loads,
    )


def _build_flag_reason(classification: dict, validation: dict):
    """Combine the reasons for review into one line, or None if there are none.

    The Notifier takes a single free-text flag_reason, but a pickup can be
    flagged by the Validator's rules and by low confidence at the same time,
    so both are joined rather than letting one hide the other.
    """
    reasons = list(validation["violated_rules"])
    if classification["confidence"] < LOW_CONFIDENCE_THRESHOLD:
        reasons.append(
            f"{LOW_CONFIDENCE_FLAG} (confidence {classification['confidence']:.2f} "
            f"below {LOW_CONFIDENCE_THRESHOLD:.2f})"
        )

    return "; ".join(reasons) if reasons else None
