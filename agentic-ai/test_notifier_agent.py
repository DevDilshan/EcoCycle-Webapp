"""Manual smoke test for the Notifier / Approval Agent.

Run from the agentic-ai folder with a .env holding OPENAI_API_KEY:
    python test_notifier_agent.py

Uses a flagged hazardous pickup with low confidence and a resident complaint,
similar to what POST /api/pickuprequests/{id}/classify-evaluate would produce.
"""

from agents.notifier_agent import evaluate_approval_request

FLAG_REASON = (
    "Restricted waste category detected: Hazardous; "
    "Classification confidence too low (45%) — manual review required; "
    "Possible mixed or contaminated waste detected in classification reasoning"
)
CATEGORY = "Hazardous"
CONFIDENCE = 0.45
CLASSIFICATION_REASONING = (
    "Image shows mixed batteries and organic waste — possible contamination"
)
COMPLAINT = "Collector missed the scheduled pickup and left waste behind."


def main() -> None:
    print("Evaluating flagged approval request...")
    print(f"  flag reason:  {FLAG_REASON}")
    print(f"  category:     {CATEGORY}")
    print(f"  confidence:   {CONFIDENCE}")
    print(f"  reasoning:    {CLASSIFICATION_REASONING}")
    print(f"  complaint:    {COMPLAINT}")
    print()

    result = evaluate_approval_request(
        flag_reason=FLAG_REASON,
        category=CATEGORY,
        confidence=CONFIDENCE,
        classification_reasoning=CLASSIFICATION_REASONING,
        complaint_description=COMPLAINT,
    )

    print("Agent recommendation:")
    print(f"  recommendation:          {result.get('recommendation')}")
    print(f"  admin_summary:           {result.get('admin_summary')}")
    print(f"  resident_notification:   {result.get('resident_notification')}")
    print(f"  reasoning:               {result.get('reasoning')}")


if __name__ == "__main__":
    main()
