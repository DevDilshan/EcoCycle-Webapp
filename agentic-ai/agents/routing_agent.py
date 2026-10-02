"""Routing Agent: decides which collector takes a pickup, and on which day.

The agent is given a list of slots that are already known to be possible -- the
collector is equipped for the category, has capacity left that day, and the day
is one the zone is actually collected on. Those hard constraints are checked in
the backend, because getting them wrong is dangerous: hazardous waste on an
unlicensed vehicle, a sofa on a truck with no lift, a collector handed more
stops than their day holds.

What is left is the part that genuinely needs judgement, and that two sensible
people could answer differently:

  * the resident asked for Thursday, but the zone's round is Tuesday and Friday
  * the soonest slot is nearly full, the one after it is empty
  * the item is hazardous, so waiting six days is worse than usual
  * a bulky item is heavy on a collector who already has a long day

The agent weighs those and says why, in a sentence an admin can read and
disagree with. Its answer is then checked against the list it was given, so a
hallucinated collector or date can never reach the database.
"""

import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_llm import call_llm, parse_json_response

MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 1

# How many slots to describe to the model. Far more than this and the prompt
# turns into a wall of near-identical rows that makes the choice worse, not
# better; the backend already sorts them soonest-first.
MAX_OPTIONS_SHOWN = 12


def route_pickup(context: dict) -> dict:
    """Choose a collector and a day from the slots the backend offers.

    Args:
        context: A dict with
            category:       waste category, e.g. "Recyclable", "Hazardous"
            zone_name:      the zone being collected, for the explanation
            preferred_date: what the resident asked for ("YYYY-MM-DD"), or None
            is_restricted:  the category needs special handling
            options:        list of slots, each with collector_id,
                            collector_name, date, remaining_capacity,
                            is_collection_day and days_away

    Returns:
        A dict with:
            collector_id:   the chosen collector, copied from the options
            scheduled_date: the chosen day as "YYYY-MM-DD"
            reasoning:      one sentence explaining the trade-off

    Raises:
        ValueError: if there are no options, or the LLM never returns a choice
            that matches one of them.
    """
    options = context.get("options") or []
    if not options:
        raise ValueError(
            "No collector can take this pickup in the next two weeks: every "
            "candidate is either unequipped for the category or full."
        )

    shown = options[:MAX_OPTIONS_SHOWN]

    # One slot and nothing to weigh -- asking a model to choose from a list of
    # one costs a call and a second of latency to reach a foregone conclusion.
    if len(shown) == 1:
        only = shown[0]
        return {
            "collector_id": only["collector_id"],
            "scheduled_date": only["date"],
            "reasoning": (
                f"{only['collector_name']} on {only['date']} is the only slot available "
                f"for this pickup."
            ),
        }

    decision = _ask_llm_for_decision(_build_prompt(context, shown))

    # The model must choose a slot it was actually offered. Without this check a
    # plausible-looking but invented pairing would flow into the database and
    # put a collector somewhere they cannot go.
    chosen_id = decision.get("collector_id")
    chosen_date = decision.get("scheduled_date")
    if not any(o["collector_id"] == chosen_id and o["date"] == chosen_date for o in shown):
        raise ValueError(
            f"LLM chose collector {chosen_id!r} on {chosen_date!r}, which is not one of "
            f"the slots offered."
        )

    return {
        "collector_id": chosen_id,
        "scheduled_date": chosen_date,
        "reasoning": decision.get("reasoning", ""),
    }


def _build_prompt(context: dict, options: list) -> str:
    category = context.get("category", "General")
    zone_name = context.get("zone_name") or "this zone"
    preferred = context.get("preferred_date")
    restricted = context.get("is_restricted", False)

    rows = "\n".join(
        f"- slot {i + 1}: collector_id={o['collector_id']} ({o['collector_name']}), "
        f"date={o['date']}, {o['days_away']} day(s) away, "
        f"{o['remaining_capacity']} stop(s) still free"
        + (", on the zone's scheduled round" if o.get("is_collection_day") else "")
        for i, o in enumerate(options)
    )

    preferred_line = (
        f"The resident asked for {preferred}."
        if preferred
        else "The resident did not ask for a particular day."
    )

    urgency_line = (
        f"{category} needs special handling, so leaving it waiting is worse than usual."
        if restricted
        else f"{category} is ordinary waste with no special urgency."
    )

    return f"""You are the Routing Agent for a council waste collection service.

Choose ONE slot for a pickup in {zone_name}.

Waste category: {category}
{preferred_line}
{urgency_line}

Available slots (every one of these is already possible -- the collector is
equipped for this category, has room that day, and the day is one this zone is
collected on):
{rows}

How to choose, in this order:
1. If this waste needs special handling, take the SOONEST slot. Hazardous and
   bulky waste sitting outside a house is a problem in itself, and that outweighs
   the resident's preferred day.
2. Otherwise, prefer the resident's requested day if a slot falls on it.
3. Otherwise prefer the soonest slot.
4. Between two slots that are equally good on the above, prefer the one with more
   room left, so one day does not fill while others sit empty.

Never pick a slot far in the future when a nearer one is free, unless the nearer
one has almost no room left.

Respond ONLY with a JSON object, no extra text, using exactly these keys:
{{
  "collector_id": "<copied exactly from one slot above>",
  "scheduled_date": "<that same slot's date, YYYY-MM-DD>",
  "reasoning": "<one sentence saying why this slot beat the others>"
}}"""


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
