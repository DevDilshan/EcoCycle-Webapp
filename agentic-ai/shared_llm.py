"""Shared helpers for talking to a local Ollama LLM.

Every agent in this package needs the same two things: a way to send a prompt
to the local model, and a way to get structured JSON back out of the reply.
Keeping both here avoids each agent re-implementing (and re-breaking) them.
"""

import json

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
REQUEST_TIMEOUT_SECONDS = 30


def call_llm(prompt: str, model: str = "phi3") -> str:
    """Send `prompt` to the local Ollama server and return the model's text.

    Streaming is disabled so the whole answer arrives in one JSON payload,
    which keeps callers simple: they get a plain string back instead of
    having to consume a chunked response.

    The 30-second timeout means a hung or unresponsive Ollama server raises
    requests.exceptions.Timeout instead of blocking the caller forever.
    """
    response = requests.post(
        OLLAMA_URL,
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["response"]


def parse_json_response(text: str) -> dict:
    """Pull the first JSON object out of an LLM reply and parse it.

    Even when asked for "JSON only", models often wrap the object in extra
    prose ("Sure, here's the result:") or markdown fences, and smaller models
    sometimes emit the object twice. So rather than slicing from the first `{`
    to the last `}` -- which would swallow a second object and fail with
    "Extra data" -- we walk the text counting braces and stop at the point
    where the first object closes. Anything after that is ignored.
    """
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in LLM response: {text!r}")

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]

        # Braces inside a string literal are data, not structure, so track
        # whether we are currently inside one.
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])

    raise ValueError(f"No complete JSON object found in LLM response: {text!r}")
