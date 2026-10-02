"""FastAPI wrapper around the agent pipeline.

Exposes the orchestrator over HTTP so the C# backend can call it without
hosting Python logic itself. The endpoints are deliberately thin: all the
decision-making lives in orchestrator.py, and this module only translates
between JSON and those two function calls.

Error handling follows the orchestrator's own split. A ValueError means the
caller sent something the agents refused -- a missing field, a pickup that was
already routed -- so it maps to 400. Anything else (a timeout, a bad API key,
an unreachable model) is ours, not the caller's, and stays a 500.

Both working endpoints sit behind a shared secret in the X-Internal-Key header,
because every call they serve spends money at OpenAI. /health stays open so the
backend can always tell a dead service from a rejected request.
"""

import os
import secrets

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from agents.notifier_agent import explain_missed_collection
from agents.routing_agent import route_pickup
from orchestrator import route_approved_pickup, run_pipeline

load_dotenv()

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

app = FastAPI(
    title="EcoCycle Agent Pipeline",
    description="Classifier -> Validator -> Routing -> Notifier, over HTTP.",
)


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Reject any request that does not carry the shared internal secret.

    FastAPI maps the `x_internal_key` argument to the "X-Internal-Key" header
    automatically (underscores become hyphens), and returns 401 rather than
    FastAPI's default 422 for a missing header, so a caller that forgot the
    header and one that sent a wrong key get the same answer.

    A missing INTERNAL_API_KEY is treated as a fatal misconfiguration, not as
    "no auth required" -- the alternative is a service that silently runs wide
    open the one time someone forgets to set it.
    """
    if not INTERNAL_API_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "INTERNAL_API_KEY is not set on the agent service. Add it to "
                "the .env file in the agentic-ai folder (see .env.example)."
            ),
        )

    # compare_digest keeps the comparison time independent of how many leading
    # characters happen to match, so the key cannot be guessed byte by byte.
    if x_internal_key is None or not secrets.compare_digest(
        x_internal_key, INTERNAL_API_KEY
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid X-Internal-Key header",
        )


class RunPipelineRequest(BaseModel):
    """One pickup request, the same shape run_pipeline() documents."""

    description: str
    resident_zone_id: str
    routing_context: dict
    photo_url: str | None = None
    resident_history: list[dict] | None = None
    complaint_description: str | None = None


class RouteApprovedRequest(BaseModel):
    """A flagged pickup an admin has approved, plus the slots as they are now."""

    pickup_request: dict
    pipeline_result: dict
    routing_context: dict = Field(
        ...,
        description=(
            "CURRENT routing slots, not the snapshot taken at submission. "
            "Routing was deferred precisely so this could be fresh."
        ),
    )


@app.get("/health")
def health() -> dict:
    """Liveness check, so the backend can tell 'agent service down' from
    'agent service up but the pickup was rejected'."""
    return {"status": "ok"}


@app.post("/run-pipeline", dependencies=[Depends(require_internal_key)])
def post_run_pipeline(request: RunPipelineRequest) -> dict:
    """Run a pickup request through all four agents.

    Returns the orchestrator's result as-is. Note that `routing` is null when a
    business rule was broken -- the pickup is waiting on an admin, and
    /route-approved-pickup assigns it once approved.
    """
    try:
        return run_pipeline(request.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class ChooseSlotRequest(BaseModel):
    """Slots to choose between, for a pickup that is already classified."""

    routing_context: dict


@app.post("/choose-slot", dependencies=[Depends(require_internal_key)])
def post_choose_slot(request: ChooseSlotRequest) -> dict:
    """Pick a collector and day for a pickup that already has a category.

    Used when a pickup needs scheduling again rather than classifying again: a
    stop the collector missed, a resident asking for a second attempt, or the
    next occurrence of a recurring collection. Re-running the whole pipeline for
    those would re-classify a photo that has not changed, and cost a vision call
    to learn what is already known.
    """
    try:
        return route_pickup(request.routing_context)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class ExplainMissedRequest(BaseModel):
    """A collection that could not be made, in the collector's own words."""

    reason: str
    description: str = ""
    next_visit: str | None = None


@app.post("/explain-missed", dependencies=[Depends(require_internal_key)])
def post_explain_missed(request: ExplainMissedRequest) -> dict:
    """Turn a collector's shorthand into a message the resident can read.

    "Gate locked" is true and useful to the office, but shown to a household
    unchanged it reads as an accusation. This writes the version they see.
    """
    try:
        return explain_missed_collection(
            reason=request.reason,
            description=request.description,
            next_visit=request.next_visit,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/route-approved-pickup", dependencies=[Depends(require_internal_key)])
def post_route_approved_pickup(request: RouteApprovedRequest) -> dict:
    """Assign a collector to a flagged pickup that an admin has approved.

    The supplied routing_context overwrites whatever the stored pickup_request
    carried, so a stale snapshot replayed from the database cannot quietly win
    over the fresh slots the caller just fetched.
    """
    pickup_request = {
        **request.pickup_request,
        "routing_context": request.routing_context,
    }
    try:
        return route_approved_pickup(pickup_request, request.pipeline_result)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
