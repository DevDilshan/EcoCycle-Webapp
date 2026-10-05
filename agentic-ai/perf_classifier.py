"""Agentic AI latency measurement for the Classifier Agent.

Run from the agentic-ai folder with a .env holding OPENAI_API_KEY:
    python perf_classifier.py            # text-only, 10 runs
    python perf_classifier.py 20         # text-only, 20 runs
    python perf_classifier.py 10 <url>   # include image recognition

This makes REAL OpenAI calls, so it is a manual benchmark, not part of the
deterministic pytest suite (which never touches the network). It reports the
classifier's end-to-end latency and the success/failure rate over N runs -- the
"Agentic AI latency" evidence for the performance requirement. The deterministic
correctness of the agent is covered separately by test_classifier_eval.py.
"""
import os
import statistics
import sys
import time

from agents.classifier_agent import classify_waste

DESCRIPTION = "Two full bags of plastic bottles and some flattened cardboard."


def _percentile(sorted_values, pct):
    if not sorted_values:
        return 0.0
    rank = max(0, min(len(sorted_values) - 1,
                      int(-(-pct * len(sorted_values) // 100)) - 1))
    return sorted_values[rank]


def main() -> None:
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    photo_url = sys.argv[2] if len(sys.argv) > 2 else ""

    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Add it to agentic-ai/.env to run this "
              "live benchmark. Skipping.")
        return

    print(f"Classifier latency benchmark: {runs} runs, "
          f"{'with image' if photo_url else 'text-only'}\n")

    latencies = []
    failures = 0
    for i in range(1, runs + 1):
        start = time.perf_counter()
        try:
            result = classify_waste(photo_url, DESCRIPTION)
            elapsed_ms = (time.perf_counter() - start) * 1000
            latencies.append(elapsed_ms)
            print(f"  run {i:>2}: {elapsed_ms:7.0f} ms  -> {result['category']} "
                  f"(confidence {result['confidence']:.2f}, image_used={result['image_used']})")
        except Exception as error:  # a failed classification counts against the rate
            failures += 1
            print(f"  run {i:>2}: FAILED -> {type(error).__name__}: {error}")

    if not latencies:
        print("\nAll runs failed; no latency to report.")
        return

    latencies.sort()
    success_rate = 100.0 * len(latencies) / runs
    print("\n=== Classifier Agent latency ===")
    print(f"runs={runs}  failures={failures}  success={success_rate:.1f}%")
    print(f"latency ms: min={latencies[0]:.0f}  "
          f"p50={_percentile(latencies, 50):.0f}  "
          f"p95={_percentile(latencies, 95):.0f}  "
          f"max={latencies[-1]:.0f}  "
          f"mean={statistics.mean(latencies):.0f}")


if __name__ == "__main__":
    main()
