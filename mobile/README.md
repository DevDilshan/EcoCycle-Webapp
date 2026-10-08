<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../frontend/public/brand/ecocycle-logo-light.svg">
  <img src="../frontend/public/brand/ecocycle-logo.svg" alt="EcoCycle" width="340">
</picture>

# EcoCycle Mobile

**The Flutter app for residents and collectors.**

![Flutter](https://img.shields.io/badge/Flutter-3-02569B?logo=flutter&logoColor=white) ![Dart](https://img.shields.io/badge/Dart-3.8-0175C2?logo=dart&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)

[🚀 Run it](#-run-it) · [📱 What's inside](#-whats-inside) · [📍 Maps](#-maps) · [🧪 Tests](#-tests) · [⬅️ Back to the project](../README.md)

</div>

## ♻️ About

The mobile app uses the same API and the same Supabase sign-in as the web app, with email or Google. Admin work stays on the web.

| Role | What they do |
|---|---|
| 🏠 **Resident** | Book a pickup with the camera and a map pin, follow its status, browse the reward catalogue, redeem points and see the collection code, raise complaints |
| 🚛 **Collector** | See today's route, open a stop, get directions, mark it collected or not collected with a reason |

A first-time user sees a short onboarding once per device.

---

## 🚀 Run it

```bash
cp .env.example .env        # first time only, then fill in the Supabase values
flutter pub get
flutter run
```

Set `API_BASE_URL` in `.env` to an address the device can reach. A phone's `localhost` is the phone itself.

| Device | `API_BASE_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:5051/api` |
| iOS simulator / Flutter web | `http://localhost:5051/api` |
| Physical phone | your computer's network address, or the deployed API |
| Release build | your deployed API URL + `/api` |

A build can also take the address on the command line, which overrides `.env`:

```bash
flutter build apk --dart-define=API_BASE_URL=https://your-api.example.com/api
```

---

## 📱 What's inside

```
lib/
  main.dart       🚪 App entry and theme
  app/            🧭 Sign-in gate, resident and collector shells, shared app scope
  screens/        📄 Sign-in, pickups, pickup location, rewards, complaints, collector route
  widgets/        🧩 Shared components, the map, reward cards and artwork
  services/       🔌 API client, zone outline geometry, photo upload, onboarding flag
  theme/          🎨 Colours and typography
  debug/          🔍 Development-only previews
assets/images/    🖼️ Brand, onboarding and reward artwork
```

**Development previews** show a screen with sample data and no sign-in. They work only in a debug build on Flutter web:

| Preview | Add to the address |
|---|---|
| 🏠 Resident screens | `?preview=resident` |
| 🚛 Collector screens | `?preview=collector` |
| 🔐 Sign-in screens | `?preview=login`, `?preview=register`, `?preview=forgot-password` |
| 📐 Layout audit | `?preview=ui-audit` |

---

## 📍 Maps

Residents can confirm a pickup pin when booking or editing a pending request. When the chosen zone has an outline, it is drawn on the map and a pin outside it cannot be confirmed. A pin that falls inside exactly one outline selects that zone.

Collectors see numbered pins for their stops over the zone outlines, can open a stop, and can launch driving directions. Older requests without a pin use their address for directions.

The map uses OpenStreetMap tiles with attribution and Flutter Map's built-in caching. Location permission is asked for only when **Use my location** or **My location** is pressed, and refusing it still allows a manual pin. A custom tile address can be supplied with `--dart-define=MAP_TILE_URL=...`.

---

## 🧪 Tests

```bash
flutter analyze
flutter test
```

The tests cover form validation, the sign-in screens, onboarding, the profile screen, map and zone outline logic, the reward catalogue and redeem flow, and layouts at small phone sizes with enlarged text.
