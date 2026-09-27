# EcoCycle Mobile (simple)

Minimal Flutter resident app: Supabase login, list pickups, schedule a pickup, view reward balance.

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
