"""Manual smoke test for the Routing Agent.

Run from the agentic-ai folder with a local Ollama server up:
    python test_routing_agent.py

collector-B has the lighter load, so a correct run should pick it.
"""

from agents.routing_agent import route_pickup

CATEGORY = "Recyclable"
RESIDENT_ZONE_ID = "zone-north-1"
COLLECTOR_LOADS = {"collector-A": 3, "collector-B": 1}


def main() -> None:
    print("Routing pickup request...")
    print(f"  category:        {CATEGORY}")
    print(f"  resident zone:   {RESIDENT_ZONE_ID}")
    print(f"  collector loads: {COLLECTOR_LOADS}")
    print()

    result = route_pickup(CATEGORY, RESIDENT_ZONE_ID, COLLECTOR_LOADS)

    print("Routing decision:")
    print(f"  collector_id:   {result.get('collector_id')}")
    print(f"  scheduled_date: {result.get('scheduled_date')}")
    print(f"  zone_id:        {result.get('zone_id')}")
    print(f"  reasoning:      {result.get('reasoning')}")


if __name__ == "__main__":
    main()
