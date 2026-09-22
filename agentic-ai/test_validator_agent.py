"""Smoke test for the Validator Agent.

The Validator is plain code (no LLM), so unlike the other agent smoke tests this
one checks the expected result instead of only printing it. Run from the
agentic-ai folder:
    python test_validator_agent.py
"""

import sys
from datetime import date

from agents.validator_agent import (
    EXCESSIVE_BULK_PICKUPS,
    HAZARDOUS_CATEGORY,
    validate_pickup,
)

# Fixed "today" so the month-boundary cases never depend on when the test runs.
TODAY = date(2026, 9, 17)
RUNS = 3


def bulk(created_at: str) -> dict:
    return {"category": "Bulk", "created_at": created_at}


# (name, category, resident_history, expected violated_rules)
CASES = [
    ("recyclable, no history", "Recyclable", [], []),
    ("hazardous is flagged", "Hazardous", [], [HAZARDOUS_CATEGORY]),
    ("1st bulk pickup this month", "Bulk", [], []),
    ("2nd bulk pickup this month (max is 2)", "Bulk", [bulk("2026-09-03")], []),
    ("3rd bulk pickup this month", "Bulk",
     [bulk("2026-09-03"), bulk("2026-09-10")], [EXCESSIVE_BULK_PICKUPS]),
    ("last month's bulk pickups don't count", "Bulk",
     [bulk("2026-08-20"), bulk("2026-08-28")], []),
    ("non-bulk pickup ignores bulk history", "Recyclable",
     [bulk("2026-09-03"), bulk("2026-09-10")], []),
    ("category capitalisation is normalised", "hazardous", [], [HAZARDOUS_CATEGORY]),
    ("ISO timestamps in history", "Bulk",
     [bulk("2026-09-03T08:15:00Z"), bulk("2026-09-10T17:40:00+05:30")], [EXCESSIVE_BULK_PICKUPS]),
    ("months are compared in UTC", "Bulk",
     [bulk("2026-09-01T02:00:00+05:30"), bulk("2026-09-05")], []),  # 1st is 31 Aug in UTC
]

# (name, category, resident_history) -> must raise ValueError
BAD_INPUTS = [
    ("invented category", "Electronic Waste", []),
    ("empty category", "", []),
    ("history is not a list", "Bulk", None),
    ("history entry missing created_at", "Bulk", [{"category": "Bulk"}]),
    ("history entry with invented category", "Bulk", [{"category": "Fridge", "created_at": "2026-09-03"}]),
    ("history entry with unparseable date", "Bulk", [{"category": "Bulk", "created_at": "yesterday"}]),
]


def check_case(name, category, history, expected_rules) -> bool:
    results = [validate_pickup(category, history, today=TODAY) for _ in range(RUNS)]
    result = results[0]
    problems = []
    if set(result) != {"is_valid", "violated_rules", "requires_approval"}:
        problems.append(f"unexpected keys {sorted(result)}")
    if result.get("violated_rules") != expected_rules:
        problems.append(f"violated_rules {result.get('violated_rules')} != {expected_rules}")
    if result.get("is_valid") is not (not expected_rules):
        problems.append(f"is_valid {result.get('is_valid')!r}")
    if result.get("requires_approval") is not bool(expected_rules):
        problems.append(f"requires_approval {result.get('requires_approval')!r}")
    if any(r != result for r in results):
        problems.append(f"not consistent across {RUNS} runs")
    print(f"  {'PASS' if not problems else 'FAIL'}  {name}" + (f"  -> {'; '.join(problems)}" if problems else ""))
    return not problems


def check_rejected(name, category, history) -> bool:
    try:
        validate_pickup(category, history, today=TODAY)
    except ValueError as error:
        print(f"  PASS  rejects {name}  ({error})")
        return True
    print(f"  FAIL  rejects {name}  -> no ValueError raised")
    return False


def main() -> int:
    print("Validator Agent - rule checks:")
    passed = [check_case(*case) for case in CASES]
    print("\nValidator Agent - bad input:")
    passed += [check_rejected(*case) for case in BAD_INPUTS]
    failures = passed.count(False)
    print(f"\n{len(passed) - failures}/{len(passed)} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
