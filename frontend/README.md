<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../frontend/public/brand/ecocycle-logo-light.svg">
  <img src="../frontend/public/brand/ecocycle-logo.svg" alt="EcoCycle" width="340">
</picture>

# EcoCycle Web

**The React web app for residents, collectors and council admins.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white) ![Leaflet](https://img.shields.io/badge/Leaflet-maps-199900?logo=leaflet&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-tests-6E9F18?logo=vitest&logoColor=white)

[🚀 Run it](#-run-it) · [🧭 What's inside](#-whats-inside) · [🔑 Configuration](#-configuration) · [🧪 Tests](#-tests) · [⬅️ Back to the project](../README.md)

</div>

## ♻️ About

One web app, three consoles. Which one you see depends on the role of the account you sign in with.

| Console | Who | What they do |
|---|---|---|
| 🏠 **Resident** | Households and businesses | Book a pickup with a photo and a map pin, follow its status, earn and redeem reward points, raise complaints |
| 🚛 **Collector** | Drivers | See today's and upcoming stops, open the route map, mark a stop collected or not collected |
| 🛠️ **Admin** | Council staff | Approve flagged pickups, manage zones and their outlines, assign routes, run the reward catalogue, handle complaints |

The public landing page shows where EcoCycle collects, with each zone's outline on a map.

---

## 🚀 Run it

```bash
npm install
cp .env.example .env        # first time only, then fill in the Supabase values
npm run dev                 # http://localhost:5173
```

Start the [API](../README.md#-running-locally) first. Vite proxies `/api` to `localhost:5051`, so leave `VITE_API_BASE_URL` empty when running locally.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the tests once |
| `npm run test:watch` | Re-run tests as files change |
| `npm run lint` | ESLint |

---

## 🧭 What's inside

```
src/
  pages/          📄 One folder per console (admin, collector, resident) plus sign-in pages
  components/     🧩 Shared pieces: admin, collector, resident, map, rewards, layout, public
  context/        🔐 Sign-in state (Supabase session)
  hooks/          🪝 Data loading and confirm dialogs
  lib/            🧰 API client, zone outline geometry, reward and pickup helpers
  styles/         🎨 CSS
  debug/          🔍 Development-only previews
public/
  brand/          ♻️ Logos
  images/rewards/ 🎁 Reward artwork
```

**Maps** use Leaflet with OpenStreetMap tiles. Zone outlines come from the API. The Sri Lanka area outlines an admin can start from are loaded on demand from Supabase Storage, not bundled with the app.

**Development previews** show a screen with sample data and no sign-in. They exist only in `npm run dev`:

| Preview | Address |
|---|---|
| 🗺️ Maps and the zone outline editor | `http://localhost:5173/?preview=map` |
| 🎁 Reward slip after approval | `http://localhost:5173/?preview=redeem` |
| 📚 Admin sidebar | `http://localhost:5173/?preview=sidebar` |

---

## 🔑 Configuration

Copy `.env.example` to `.env`. The file is gitignored; 🚫 never commit a real key.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key (never the secret key) |
| `VITE_SUPABASE_PICKUP_BUCKET` | Storage bucket for pickup photos |
| `VITE_API_BASE_URL` | Backend origin. Leave empty locally. |
| `VITE_BOUNDARY_DATA_URL` | Optional. Where the area outlines are served from. |

---

## 🧪 Tests

```bash
npm test
```

Vitest with Testing Library covers the sign-in guard, the API client, the resident pickups page, zone outline geometry, the admin dashboard and the reward slip. Two map helper suites run on Node's built-in test runner.

---

## 🚢 Deploying

The app is deployed on Vercel. `vercel.json` rewrites every route to `index.html` so that page refreshes work. Set `VITE_API_BASE_URL` to the deployed API.
