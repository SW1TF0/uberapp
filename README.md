# Kardzhali Ride

A localized ride-hailing MVP for Kardzhali, Bulgaria. Expo/React Native
(TypeScript) client on `@react-native-firebase` (Auth + Realtime Database),
with Cloud Functions for driver matching and fare finalization.

Built in phases; this repo currently has **Phase 1** and **Phase 2**.

## Repo layout

```
firebase/
  database.rules.json      Realtime Database security rules
  firebase.json             Firebase CLI project config
  .firecaserc → .firebaserc  Project alias (replace with your project id)
  schema/sample-database.json  Reference snapshot of the DB shape, incl. seed data
  functions/                Cloud Functions source (Phase 5)
mobile/
  src/firebase/firebase.ts  Typed @react-native-firebase auth/db instances
  src/types/models.ts       Shared TS types matching the DB schema
  src/store/                Zustand stores (auth, active ride/offer)
  src/hooks/                useAuth, useDriverLocation, useRideDispatch
  src/utils/fare.ts         Haversine distance + BGN fare estimate
```

## Data model (Realtime Database)

- `/users/{uid}` — `{ uid, role: 'rider'|'driver', name, phone, createdAt }`
- `/drivers/{uid}` — `{ profile: { name, phone, rating, vehicle }, status: 'offline'|'online'|'busy', location: { lat, lng, heading, speed, updatedAt } }`
  Keyed by the driver's own auth uid, so rules stay simple (a driver can only write their own node).
- `/rides/{rideId}` — full ride lifecycle document (`pickup`, `dropoff`, `status`, fare fields, timestamps). `status` moves `requested → accepted → arrived → in_progress → completed` (or `cancelled` at any point before `completed`).
- `/driverRequests/{driverId}/{rideId}` — fan-out ride offer a driver currently has open; written by the Phase 5 matching Cloud Function, resolved (accepted/declined) by the driver client.
- `/pricing_rules` — single BGN pricing config: base fare, per-km/per-min rates, minimum fare, Kardzhali city-limits geofence (center + radius), outer-zone surcharge multiplier, per-vehicle-type multipliers. Read-only to clients; see `firebase/schema/sample-database.json` for real Kardzhali-centered values.

See `firebase/schema/sample-database.json` for a full example snapshot you can import via the Firebase console during local development.

## Security rules

`firebase/database.rules.json` enforces:
- A user can only read/write their own `/users/{uid}` and `/drivers/{uid}` nodes.
- Any authenticated user can *read* driver profiles/locations (riders need this to show nearby drivers on the map).
- A ride can only be created by the rider named in it; only the assigned rider/driver can read or update a given ride; a driver can only attach themselves to an unassigned ride if their own `/drivers/{uid}/status` is `online`.
- `driverRequests/{driverId}` is private to that driver.
- `pricing_rules` is server-managed (Cloud Functions use the Admin SDK, which bypasses rules) — clients get read-only access.

Deploy with the Firebase CLI from `firebase/`:
```
firebase deploy --only database
```

## Setup required before this runs

1. Create a Firebase project, enable **Phone** sign-in under Authentication and create a **Realtime Database** instance.
2. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) and place them in `mobile/` (paths already wired up in `mobile/app.json`; these files are gitignored — generate your own).
3. Update `firebase/.firebaserc` with your real project id.
4. `cd mobile && npm install`.
5. **Important:** this app uses `@react-native-firebase` (native SDKs, required for phone auth), so it needs a custom dev client — it will **not** run in Expo Go. Build one with `npx expo prebuild` + `npx expo run:android` / `run:ios`, or `eas build --profile development`.
6. Import `firebase/schema/sample-database.json` (or at least a `/pricing_rules` node) into your Realtime Database so fare estimates work.

I haven't been able to run or test any of this against a live Firebase project or a real device/simulator in this environment — there's no Firebase project, Google Maps API key, or mobile runtime available here. The code is written to compile and to match the Firebase JS/Admin SDK APIs correctly, but treat the setup steps above as unverified until you run them yourself.

## What's next

Type `NEXT` to continue with:
- **Phase 3** — Rider UI (live map, destination picker + route polyline, ride request modal, live trip screen)
- **Phase 4** — Driver UI (online toggle, incoming-request overlay with 15s timer, turn-by-turn trip screen)
- **Phase 5** — Cloud Functions (nearest-driver matching within 5km, final fare calculation + history logging)
