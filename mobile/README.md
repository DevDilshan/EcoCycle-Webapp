# EcoCycle Mobile (simple)

Minimal Flutter resident app: Supabase login, list pickups, schedule a pickup, view reward balance.

## Pickup and collector maps

Residents can confirm an optional pickup pin when booking or editing a pending
request. Collectors see numbered pins for their assigned stops, select a stop,
open its details, or launch driving directions in Google Maps. Older requests
use their full address for directions until a pin is added. Zone centers only
set the booking map's initial view.

Run the updated backend and apply `AddPickupCoordinates` with
`dotnet ef database update` from `backend/`. Both web and Flutter clients use the
same saved coordinates. Recurring bookings retain the address and pin; changing
an address clears the old pin so it can be confirmed again.

The map uses OpenStreetMap tiles with attribution and Flutter Map's built-in
caching. Location permission is requested only when **Use my location** or
**My location** is pressed. Denial still allows manual pin selection. A custom
tile URL can be supplied using `--dart-define=MAP_TILE_URL=...`; the website
uses `VITE_MAP_TILE_URL`.

For a physical phone, set `API_BASE_URL` to a backend address the phone can
reach. A phone's `localhost` refers to the phone itself. For an Android
emulator talking to the development machine use `http://10.0.2.2:5051/api`.

Read-only development previews:

- Flutter: `http://127.0.0.1:5186/?preview=collector` (open the Map tab).
- Website: `http://127.0.0.1:5173/?preview=map`.

Both previews use sample stops and cannot update real collections. Flutter
previews require a debug build; website previews are removed from production.

## Setup

1. Install [Flutter](https://docs.flutter.dev/get-started/install).
2. Copy env and fill in keys (same Supabase project as the web app):

   ```bash
   cp .env.example .env
   ```

3. **API URL** — defaults to `https://ecocycle-webapp.onrender.com/api`. Override `API_BASE_URL` in `.env` for a local backend.

4. Install deps and run:

   ```bash
   flutter pub get
   flutter run
   ```

## Structure

```
lib/
  main.dart           # App + auth gate
  config/app_config.dart
  services/api.dart   # JWT calls to .NET API
  screens/            # login + home
```
