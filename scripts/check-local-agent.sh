#!/usr/bin/env bash
# Quick local check: agent service + backend wiring (INTERNAL_API_KEY).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_URL="${AGENT_SERVICE_URL:-http://127.0.0.1:8000}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:5051}"

if [[ -f "$ROOT/backend/.env" ]]; then
  # shellcheck disable=SC1091
  set -a && source "$ROOT/backend/.env" && set +a
fi

KEY="${INTERNAL_API_KEY:-}"

echo "=== Agent ($AGENT_URL) ==="
curl -sf "$AGENT_URL/health" | head -c 200 && echo || { echo "Agent not reachable. Start: cd agentic-ai && uvicorn api:app --port 8000"; exit 1; }

if [[ -z "$KEY" ]]; then
  echo "INTERNAL_API_KEY missing in backend/.env"
  exit 1
fi

echo "=== Agent run-pipeline (auth) ==="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AGENT_URL/run-pipeline" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: $KEY" \
  -d '{"description":"probe recyclables","resident_zone_id":"00000000-0000-0000-0000-000000000001","routing_context":{"slots":[]}}')
echo "HTTP $code (expect 200)"
[[ "$code" == "200" ]] || exit 1

echo "=== Backend agent health ($BACKEND_URL/api/health/agent) ==="
curl -sf "$BACKEND_URL/api/health/agent" && echo || { echo "Backend not reachable. Start: cd backend && dotnet run"; exit 1; }

echo "OK — keys and URLs look good. Restart dotnet after .env changes."
