"""Manual smoke test for the Classifier Agent.

Run from the agentic-ai folder with a local Ollama server up (ollama run phi3),
and GEMINI_API_KEY exported if you want to exercise real image recognition:
    python test_classifier_agent.py

Replace PHOTO_URL with a real, public image URL (e.g. a Supabase Storage URL)
to test Gemini. With the placeholder URL below, the image fetch fails on
purpose, so you'll see the graceful fallback (image_used = False).
"""

from agents.classifier_agent import classify_waste

PHOTO_URL = "https://example.com/pickups/old-fridge.jpg"  # replace with a real URL
DESCRIPTION = "An old broken refrigerator, about 1.7 metres tall, that no longer works."
RUNS = 3


def main() -> None:
    print("Classifying waste...")
    print(f"  photo_url:   {PHOTO_URL}")
    print(f"  description: {DESCRIPTION}")
    print()

    for run in range(1, RUNS + 1):
        result = classify_waste(PHOTO_URL, DESCRIPTION)
        print(f"Run {run}:")
        print(f"  category:   {result.get('category')}")
        print(f"  confidence: {result.get('confidence')}")
        print(f"  image_used: {result.get('image_used')}")
        print(f"  reasoning:  {result.get('reasoning')}")
        print()

    # Fallback path: no photo at all -> must classify from description only.
    print("Fallback (no photo)...")
    result = classify_waste("", DESCRIPTION)
    print(f"  category:   {result.get('category')}  image_used: {result.get('image_used')}")
    print()

    # Bad input must be rejected, not silently classified.
    print("Rejecting bad input (empty description)...")
    try:
        classify_waste(PHOTO_URL, "")
        print("  ERROR: expected a ValueError but none was raised")
    except ValueError as error:
        print(f"  OK, rejected: {error}")


if __name__ == "__main__":
    main()