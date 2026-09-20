# Kardzhali Ride

A localized ride-hailing MVP for Kardzhali, Bulgaria. Expo/React Native
(TypeScript) client on `@react-native-firebase` (Auth + Realtime Database),
with Cloud Functions for driver matching and fare finalization.

Built in phases; this repo currently has **Phase 1–4** (schema/rules, sync
hooks, Rider UI, Driver UI). Phase 5 (Cloud Functions) is next.

## Repo layout

```
firebase/
  database.rules.json      Realtime Database security rules
  firebase.json             Firebase CLI project config
  .firecaserc → .firebaserc  Project alias (replace with your project id)
  schema/sample-database.json  Reference snapshot of the DB shape, incl. seed data
  functions/                Cloud Functions source (Phase 5)
mobile/
  App.tsx                   Entry point
  src/firebase/firebase.ts  Typed @react-native-firebase auth/db instances
  src/types/models.ts       Shared TS types matching the DB schema
  src/store/                Zustand stores (auth, active ride/offer)
  src/hooks/                useAuth, useDriverLocation, useRideDispatch
  src/utils/fare.ts         Haversine distance + BGN fare estimate
  src/services/googleMaps.ts  Places Autocomplete, Directions, Distance Matrix REST calls
  src/navigation/            RootNavigator + Auth/Rider/Driver stacks
  src/screens/auth/          Welcome, phone login, OTP, profile+vehicle setup
  src/screens/rider/         Live map, destination picker, ride confirm, live trip
  src/screens/driver/        Dashboard (online toggle), turn-by-turn trip screen
  src/screens/shared/        Profile (sign out)
  src/components/            AnimatedDriverMarker, IncomingRequestOverlay (15s timer)
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
7. In Google Cloud Console (same or linked project), enable **Places API**, **Directions API**, and **Distance Matrix API**, then create a key. Put it in `mobile/.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (copy `mobile/.env.example`) for the autocomplete/route/ETA calls, **and** separately in `mobile/app.json` under `android.config.googleMaps.apiKey` for the native Android Maps SDK. Without a key, the app still runs — search/autocomplete returns nothing and routes fall back to a straight dashed line between pickup and dropoff instead of a real road route.

I haven't been able to run or test any of this against a live Firebase project, a real device/simulator, or an actual Google Maps key in this environment — there's no Firebase project, Maps key, or mobile runtime available here. Everything type-checks cleanly (`npx tsc --noEmit` passes with zero errors across all four phases), but treat the setup steps above and the actual on-device behavior as unverified until you run them yourself.

## Driver busy/online lifecycle (Phase 4 note)

Accepting an offer sets `/drivers/{uid}/status` to `busy` (so the driver stops receiving new offers), and the driver's own client flips it back to `online` once their ride reaches `completed` or `cancelled` — always as a self-write, since the security rules only let a driver write their own status node. A rider can never write another user's driver status.

## What's next

Type `NEXT` to continue with:
- **Phase 5** — Cloud Functions (nearest-driver matching within 5km, final fare calculation + history logging)
