"""Manual smoke test for the Policy validator LLM pass.

Requires OPENAI_API_KEY in agentic-ai/.env and VALIDATOR_USE_LLM not disabled.
Run from the agentic-ai folder:
    python test_validator_llm_agent.py
"""

from agents.validator_agent import validate_pickup_full

CASE = {
    "category": "Recyclable",
    "description": "Mixed plastic bottles plus old car batteries and paint tins in the same bags.",
    "classification_reasoning": "Mostly plastic bottles visible",
    "confidence": 0.88,
    "resident_history": [],
}


def main() -> None:
    print("Running validate_pickup_full (rules + LLM)...")
    result = validate_pickup_full(**CASE)
    print("violated_rules:", result.get("violated_rules"))
    print("llm_review:", result.get("llm_review"))
    print("requires_approval:", result.get("requires_approval"))


if __name__ == "__main__":
    main()
