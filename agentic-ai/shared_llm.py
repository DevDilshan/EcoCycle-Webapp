"""Shared helpers for talking to the OpenAI API.

Every agent in this package needs the same two things: a way to send a prompt
to the model, and a way to get structured JSON back out of the reply.
Keeping both here avoids each agent re-implementing (and re-breaking) them.

The API key is read from OPENAI_API_KEY, which is loaded from a .env file in
this folder (see .env.example) so the key never lands in source control.
"""

import json
import os

import requests
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
REQUEST_TIMEOUT_SECONDS = 30


def call_llm(prompt: str, model: str = "gpt-4o-mini") -> str:
    """Send `prompt` to OpenAI's chat completions endpoint and return the text.

    Callers get a plain string back rather than the full response envelope,
    which keeps every agent's code the same shape it had under Ollama.

    The 30-second timeout means a hung or unresponsive API call raises
    requests.exceptions.Timeout instead of blocking the caller forever.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Create a .env file in the agentic-ai "
            "folder containing a line like OPENAI_API_KEY=sk-... (or set the "
            "variable in your environment) before calling the LLM."
        )

    response = requests.post(
        OPENAI_URL,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


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
