"""Manual smoke test for the Routing Agent.

Run from the agentic-ai folder with a .env holding OPENAI_API_KEY:
    python test_routing_agent.py

The agent now chooses a SLOT -- a collector and a day -- from the options the
backend says are legal, rather than just the collector with the smallest number.
So this checks the thing that is actually worth checking: given identical slots,
it should answer differently depending on the waste.

  * Hazardous waste should take the SOONEST slot, even though the resident asked
    for a later day -- rubbish that needs special handling should not sit outside
    a house waiting for someone's preferred date.
  * Ordinary recycling should honour the resident's requested day.

If both cases give the same answer, the agent is not weighing urgency and the
prompt has regressed.
"""

from agents.routing_agent import route_pickup

# Three slots with the same collector, so only the DAY varies. The soonest is
# nearly full, which is the tension: soonest, or roomiest, or what was asked for?
SLOTS = [
    {
        "collector_id": "collector-B",
        "collector_name": "Ruwan Dias",
        "date": "2026-10-03",
        "days_away": 1,
        "remaining_capacity": 1,
        "is_collection_day": True,
    },
    {
        "collector_id": "collector-B",
        "collector_name": "Ruwan Dias",
        "date": "2026-10-06",
        "days_away": 4,
        "remaining_capacity": 9,
        "is_collection_day": True,
    },
    {
        "collector_id": "collector-B",
        "collector_name": "Ruwan Dias",
        "date": "2026-10-09",
        "days_away": 7,
        "remaining_capacity": 10,
        "is_collection_day": True,
    },
]

PREFERRED_DATE = "2026-10-09"
SOONEST_DATE = "2026-10-03"


def run(category: str, is_restricted: bool) -> dict:
    return route_pickup(
        {
            "category": category,
            "zone_name": "Nugegoda",
            "preferred_date": PREFERRED_DATE,
            "is_restricted": is_restricted,
            "options": SLOTS,
        }
    )


def main() -> None:
    print(f"Resident asked for {PREFERRED_DATE}; soonest slot is {SOONEST_DATE}.\n")

    hazardous = run("Hazardous", is_restricted=True)
    ordinary = run("Recyclable", is_restricted=False)

    print("Hazardous:")
    print(f"  chose:     {hazardous.get('scheduled_date')}")
    print(f"  reasoning: {hazardous.get('reasoning')}")
    print()
    print("Recyclable:")
    print(f"  chose:     {ordinary.get('scheduled_date')}")
    print(f"  reasoning: {ordinary.get('reasoning')}")
    print()

    # Checked rather than just printed, so a regression fails the run instead of
    # scrolling past in output nobody reads.
    problems = []
    if hazardous.get("scheduled_date") != SOONEST_DATE:
        problems.append(
            f"hazardous should take the soonest slot ({SOONEST_DATE}), "
            f"got {hazardous.get('scheduled_date')}"
        )
    if ordinary.get("scheduled_date") != PREFERRED_DATE:
        problems.append(
            f"ordinary waste should honour the resident's day ({PREFERRED_DATE}), "
            f"got {ordinary.get('scheduled_date')}"
        )

    if problems:
        for problem in problems:
            print(f"FAIL: {problem}")
        raise SystemExit(1)

    print("OK: urgency beat the resident's preference for hazardous waste,")
    print("    and the preference was honoured for ordinary waste.")


if __name__ == "__main__":
    main()
