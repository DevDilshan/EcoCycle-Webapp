# ♻️ EcoCycle

Waste pickup platform for residents, collectors and admins. Residents request a
pickup; an AI agent pipeline classifies the waste, checks it against business
rules, and either assigns a collector automatically or flags it for an admin.

```
frontend/       💻 React + Vite web app (admin, resident, collector)
mobile/         📱 Flutter app — planned, talks to the same backend
backend/        ⚙️  ASP.NET Core 8 Web API — the shared API for web AND mobile
agentic-ai/     🤖 Python FastAPI service running the four AI agents
backend.Tests/  🧪 xUnit tests
```

Database is PostgreSQL on Supabase. Supabase also issues the JWTs used for
authentication — **by both the web app and the Flutter app**.

---

## 🔄 How a pickup flows through the system

1. A resident submits a pickup (`POST /api/pickuprequests`) — from the web app
   or, once built, the Flutter app. Same endpoint either way.
   
2. The backend calls the Python agent service, which runs four agents in order:
   - 🧠 **Classifier** — decides the waste category. OpenAI reads the resident's
     description; Gemini describes the photo when one is supplied.
   - ✅ **Validator** — deterministic business rules (hazardous waste, max 2 bulk
     pickups per resident per month). No AI, no network.
   - 🚛 **Routing** — picks the collector with the lowest pending load. Skipped
     when the Validator found a broken rule.
   - 📨 **Notifier** — flagged pickups only: recommends approve / reject /
     request_revision and drafts a message for the resident.
     
3. Back in C#, `ComplianceRules` runs a second pass for checks Python cannot do:
   e-waste detection, contamination wording, and which findings count against
   the resident's record.
   
4. ✅ **Clean pickup** → a `RouteAssignment` is created, pickup becomes
   `Scheduled`. 🚩 **Flagged pickup** → an `ApprovalRequest` is created holding
   the full pipeline result as JSON, and the pickup waits at `Classified`.
   
5. When an admin approves a flagged pickup, the backend routes it **then** —
   using current collector loads, not the ones captured at submission, because a
   flagged pickup can sit in review for days.

> ⚠️ If the agent service is unreachable, the pickup is still saved as `Pending`
> and the failure is logged. A resident's submission never fails because the AI
> is down.

---

## 🚀 Running it locally

You need three terminals. Start them in this order.

### 1. 🤖 Agent service (Python)

```bash
cd agentic-ai
python -m venv .venv          # first time only
.venv\Scripts\activate        # Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env          # first time only, then fill in the keys
uvicorn api:app --reload --port 8000
```

> 💡 The venv must be activated in **every new terminal**, or you get
> `ModuleNotFoundError`. Check it is up at <http://127.0.0.1:8000/docs>.

### 2. ⚙️ Backend (.NET 8)

```bash
cd backend
dotnet run                    # http://localhost:5051, opens Swagger
```

### 3. 💻 Frontend (React)

```bash
cd frontend
npm install                   # first time only
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` to `localhost:5051`, so the ports above matter.

### 4. 📱 Mobile (Flutter) — when it exists

```bash
cd mobile
flutter pub get
flutter run                   # point it at the backend, see the mobile section
```

---

## 🔑 Configuration

Secrets live in `.env` files that are **gitignored**. Copy the `.env.example`
templates and fill in real values. 🚫 Never commit a real key.

### Repository root `.env` — read by the backend

| Variable | Purpose |
| --- | --- |
| `SUPABASE_CONNECTION_STRING` | PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL, used as the JWT issuer |
| `SUPABASE_JWT_SECRET` | Validates incoming JWTs |
| `AGENT_SERVICE_URL` | Agent service base URL (default `http://localhost:8000`) |
| `INTERNAL_API_KEY` | Shared secret sent to the agent service |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (default `http://localhost:5173`) |

### `agentic-ai/.env` — read by the agent service

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required. All agent reasoning runs on `gpt-4o-mini`. |
| `INTERNAL_API_KEY` | ⚠️ **Must match the root `.env` value**, or every call is 401 |
| `GEMINI_API_KEY` | Optional. Without it, photos are ignored and classification is text-only. |

---

## 🌐 API

All endpoints are under `/api` and require a Supabase JWT as
`Authorization: Bearer <token>`. Roles are `admin`, `collector`, `resident`
(`user` is treated as `resident` — it is the fallback for accounts whose role
was never set).

| Area | Endpoints |
| --- | --- |
| 📦 Pickups | `POST /pickuprequests`, `GET /pickuprequests`, `GET /pickuprequests/{id}`, `GET /pickuprequests/{id}/status`, `PUT`, `DELETE` |
| 🚩 Approvals (admin) | `GET /approvals`, `GET /approvals/{id}`, `POST /approvals/{id}/approve`, `POST /approvals/{id}/reject` |
| 🚛 Routes | `GET /routes/{collectorId}/today`, `GET /routes/load-report`, `GET /routes/zone-load`, `POST /routes/assign/{pickupRequestId}`, `PUT /routes/{id}/reassign` |
| 🗺️ Zones | `GET /zones`, `POST /zones`, `PUT /zones/{id}`, `DELETE /zones/{id}` |
| 🎁 Rewards | `POST /rewards`, `GET /rewards/leaderboard`, `GET /rewards/{residentId}/history`, `POST /rewards/redeem` |
| 💬 Complaints | `POST /complaints`, `GET /complaints`, `PUT`, `DELETE` |
| 👤 Profiles | `GET /profiles?role=resident\|collector\|admin` |

Swagger UI is served in Development at `/swagger`.

Two endpoints worth knowing when building any client:

- `GET /pickuprequests` returns the AI result **inline** — `category`,
  `confidence`, `reasoning`, `classifiedAt`, `zoneName`, and
  `hasApprovalRequest` / `approvalStatus` / `flagReason`. There is no separate
  classification call.
- `GET /approvals/{id}` returns `agentInsight` — the agent's reasoning and
  recommendation — for the admin review screen.

---

## 📱 Mobile app (Flutter)

The Flutter client is a **second frontend on the same backend**. Nothing new is
needed server-side to support it: the API, the auth, and the AI pipeline are all
shared with the web app. Put it in a `mobile/` folder at the repo root.

### Auth

- 🔐 Sign in with the **Supabase Flutter SDK** (`supabase_flutter`), then send
  the resulting access token as `Authorization: Bearer <token>` on every call.
- The backend only **validates** tokens against `SUPABASE_URL` and
  `SUPABASE_JWT_SECRET` — it never issues them, and there is no separate
  login endpoint to call.
- 👤 Read the role from the token, not from local storage. The backend resolves
  it from the `role` claim, then `app_metadata`, then `user_metadata`,
  defaulting to `resident`.

### Talking to the API

- 🌍 **Base URL**: `http://10.0.2.2:5051/api` on the Android emulator
  (`localhost` there means the emulator itself), `http://localhost:5051/api` on
  iOS simulator, and the deployed URL in release builds. Make it a
  `--dart-define`, not a hardcoded string.
- ⏱️ **`POST /pickuprequests` takes 8–17 seconds** — the AI pipeline runs inline
  before responding. Set a client timeout above 30 s and show real progress, not
  a spinner that looks frozen.
- 🔤 **Enums are strings** (`"EWaste"`, `"Scheduled"`), so map them to Dart
  enums **by name, never by index** — the numeric order is not stable across the
  codebase.
- 🌐 CORS does not apply to a mobile app, so `ALLOWED_ORIGINS` is a web-only
  concern.

### Pickup status, and what to show the resident

| Status | Meaning |
| --- | --- |
| `Pending` | Not classified — the agent service was unavailable |
| `Classified` | 🚩 Flagged, waiting for an admin decision |
| `Scheduled` | ✅ Collector assigned, `scheduledDate` set |
| `Completed` | Collected |

### Suggested first screens

1. 📝 **Submit a pickup** — description, optional photo, preferred date
2. 📋 **My pickups** — list with status, category and the AI's reasoning
3. 🔔 **Pickup detail** — flag reason if any, assigned collector, scheduled date
4. 🎁 **Rewards** — points balance, history, leaderboard

---

## 🚢 Deploying

The backend has a [Dockerfile](backend/Dockerfile) — Render's native .NET
support is inconsistent, so deploy it as a Docker service with
`Root Directory = backend`. It binds `0.0.0.0` on `$PORT`.

The agent service has no Dockerfile yet. Run it with
`uvicorn api:app --host 0.0.0.0 --port $PORT` — the default host `127.0.0.1` is
not reachable from outside a container.

Set every variable from the Configuration tables in the host's environment.
Both services read real environment variables when no `.env` file is present.

---

## ⚠️ Known gaps

Things that work but are not finished, so nobody rediscovers them the hard way:

- ⏱️ **The AI pipeline runs inline on the request thread**, which is why pickup
  creation takes 8–17 seconds. It belongs in a background job — and this will be
  more noticeable on mobile than on desktop.
- 🎁 **Reward points are awarded entirely by hand.** Nothing grants them
  automatically on pickup completion, and there is no points-per-category table.
- 🔁 **`RewardRules` (C#) duplicates the Python Validator** — same rule codes,
  same limits. Still wired to `POST /rewards/validate`; remove once nothing
  depends on it.
- 🗺️ **Zones have a single coordinate, not a boundary**, so the admin map shows
  pins rather than areas.
- 🗄️ **A fresh database is missing two columns.** The migration adding
  `Complaints.AdminNotes` and `ApprovalRequests.ReviewNotes` was applied to the
  shared database but reconstructed later; verify a clean
  `dotnet ef database update` before relying on one.
- 🧪 **Frontend pages have not been clicked through end to end** after the agent
  integration; the backend paths have been tested live.
