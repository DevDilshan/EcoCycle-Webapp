"""Routing Agent: decides which collector handles a resident's pickup.

The agent does not hard-code the balancing rule. Instead it hands the LLM the
current state of the world (waste category, resident zone, per-collector load)
and asks it to pick a collector and justify the choice, so the decision comes
back with human-readable reasoning attached.

Anything the LLM has no judgement to add to -- the pickup date, the zone id --
is filled in by Python instead, because a model that has to invent a date will
occasionally invent a malformed one.
"""

import os
import sys
import time
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_llm import call_llm, parse_json_response

MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1


def route_pickup(category: str, resident_zone_id: str, collector_loads: dict) -> dict:
    """Assign a pickup request to the least-loaded collector.

    Args:
        category: The waste category being collected (e.g. "plastic", "organic").
        resident_zone_id: The zone the requesting resident belongs to.
        collector_loads: Mapping of collector id -> number of pickups already
            assigned to that collector, e.g. {"C001": 3, "C002": 1}.

    Returns:
        A dict with four keys:
            collector_id:    the collector chosen to do the pickup (from the LLM)
            scheduled_date:  tomorrow's date as "YYYY-MM-DD" (computed in Python)
            zone_id:         the zone the pickup is in (echoed from the input)
            reasoning:       a short explanation of why this collector was picked

    Raises:
        ValueError: if the LLM never returns parsable JSON across all attempts,
            or if it names a collector that is not in `collector_loads`.
    """
    loads_text = "\n".join(
        f"- {collector_id}: {load} pickups"
        for collector_id, load in collector_loads.items()
    )

    prompt = f"""You are the Routing Agent for a waste pickup system.

Assign this pickup request to the collector with the LOWEST current load.

Waste category: {category}
Resident zone: {resident_zone_id}
Current pickup load per collector:
{loads_text}

Rules:
- Choose the collector with the fewest pickups currently assigned.
- If there is a tie, choose the first one listed.
- The collector_id must be copied exactly from the list above.

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "collector_id": "<id of the chosen collector>",
  "reasoning": "<one sentence explaining the choice>"
}}"""

    decision = _ask_llm_for_decision(prompt)

    # Guard against the model inventing a collector that does not exist, or
    # subtly rewriting an id ("Collector-B" for "collector-B"). Without this
    # the bad id would flow straight into the database.
    collector_id = decision.get("collector_id")
    if collector_id not in collector_loads:
        raise ValueError(
            f"LLM chose collector {collector_id!r}, which is not one of the "
            f"available collectors: {sorted(collector_loads)}"
        )

    return {
        "collector_id": collector_id,
        "scheduled_date": (date.today() + timedelta(days=1)).isoformat(),
        "zone_id": resident_zone_id,
        "reasoning": decision.get("reasoning", ""),
    }


def _ask_llm_for_decision(prompt: str) -> dict:
    """Call the LLM until it returns parsable JSON, up to MAX_ATTEMPTS times.

    Small models fail at JSON formatting intermittently rather than
    consistently, so simply asking again usually succeeds. The short pause
    between attempts avoids hammering a server that is still busy.
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
