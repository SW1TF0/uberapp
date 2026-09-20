# Kardzhali Ride

A localized ride-hailing MVP for Kardzhali, Bulgaria. Expo/React Native
(TypeScript) client on `@react-native-firebase` (Auth + Realtime Database),
with Cloud Functions for driver matching and fare finalization.

Built in 5 phases, all of which are now in this repo: schema/rules, sync
hooks, Rider UI, Driver UI, and Cloud Functions.

## Repo layout

```
firebase/
  database.rules.json      Realtime Database security rules
  firebase.json             Firebase CLI project config
  .firecaserc → .firebaserc  Project alias (replace with your project id)
  schema/sample-database.json  Reference snapshot of the DB shape, incl. seed data
  functions/
    package.json / tsconfig.json
    src/index.ts             Exports every Cloud Function, initializes admin SDK
    src/matchDriver.ts        matchRideRequest, retryUnmatchedRides, onOfferRemoved
    src/rideLifecycle.ts      finalizeRideFare, onRideCancelled
    src/lib/                  geo.ts, fare.ts, directions.ts (shared pure logic)
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
- `/driverRequests/{driverId}/{rideId}` — fan-out ride offer a driver currently has open; written by the `matchRideRequest`/`retryUnmatchedRides`/`onOfferRemoved` Cloud Functions, resolved (accepted/declined) by the driver client.
- `/rides/{rideId}/matching` — internal bookkeeping the matching Cloud Functions attach to a ride while it's `requested`: `{ offeredDriverId, offeredAt, expiresAt, excludedDriverIds }`. Only ever written by Admin SDK; the rider can read it (it's just extra fields on a ride their client already ignores) but never writes it.
- `/pricing_rules` — single BGN pricing config: base fare, per-km/per-min rates, minimum fare, Kardzhali city-limits geofence (center + radius), outer-zone surcharge multiplier, per-vehicle-type multipliers. Read-only to clients; see `firebase/schema/sample-database.json` for real Kardzhali-centered values.
- `/transactions/{rideId}` — the logged, final record of a completed ride (`riderId`, `driverId`, `distanceKm`, `durationMin`, `fareBGN`, `paymentMethod`, `completedAt`), written by `finalizeRideFare`. Read-only; only the ride's own rider/driver can read it.
- `/riderHistory/{riderId}/{rideId}` and `/driverHistory/{driverId}/{rideId}` — `true`-valued fan-out indexes so a user's completed-ride history can be listed without scanning all of `/rides`. Read-only; each user can only read their own.

See `firebase/schema/sample-database.json` for a full example snapshot (including a completed ride's `/transactions` + history entries) you can import via the Firebase console during local development.

## Security rules

`firebase/database.rules.json` enforces:
- A user can only read/write their own `/users/{uid}` and `/drivers/{uid}` nodes.
- Any authenticated user can *read* driver profiles/locations (riders need this to show nearby drivers on the map).
- A ride can only be created by the rider named in it; only the assigned rider/driver can read or update a given ride; a driver can only attach themselves to an unassigned ride if their own `/drivers/{uid}/status` is `online`.
- `driverRequests/{driverId}` is private to that driver.
- `pricing_rules`, `transactions`, `riderHistory`, and `driverHistory` are server-managed (Cloud Functions use the Admin SDK, which bypasses rules entirely) — clients get read-only access, scoped to their own data for the latter three.

Deploy with the Firebase CLI from `firebase/`:
```
firebase deploy --only database
```

## Cloud Functions (Phase 5)

All in `firebase/functions/`, written in TypeScript, Firebase Functions v2 (Realtime Database + Scheduler triggers):

- **`matchRideRequest`** (`onValueCreated` on `/rides/{rideId}`) — on every new ride request, finds the nearest **online** driver within a **5km** radius of the pickup point (haversine distance against every driver's live `/drivers/{id}/location`) and writes a fan-out offer to `/driverRequests/{driverId}/{rideId}` with a 15-second expiry (matching the client's `IncomingRequestOverlay` countdown).
- **`onOfferRemoved`** (`onValueDeleted` on `/driverRequests/{driverId}/{rideId}`) — fires the instant a driver declines (or accepts — it tells the two apart by checking whether the ride already has a `driverId`), immediately re-offering to the next-nearest eligible driver rather than waiting on a timer.
- **`retryUnmatchedRides`** (`onSchedule`, every 1 minute) — a safety-net sweep over all `requested` rides, in case an offer expires without the driver's app calling accept/decline at all (e.g. it lost connectivity).
- **`finalizeRideFare`** (`onValueUpdated` on `/rides/{rideId}`, fires when `status` becomes `completed`) — calls the Google **Directions API** server-side to get the *actual* driven route's distance/duration (not the client's straight-line estimate), recomputes the fare with the same BGN formula used everywhere else, writes it back to the ride, and logs the finished trip to `/transactions/{rideId}` plus `/riderHistory` and `/driverHistory` fan-out indexes. Falls back to the client's original estimate if the Directions call fails or no server key is configured, so a trip is never left without a final fare.
- **`onRideCancelled`** (`onValueUpdated` on `/rides/{rideId}`, fires when `status` becomes `cancelled`) — a rider's client can only write their own ride's status, not another user's `/driverRequests` or `/drivers` node, so this does that cleanup server-side: withdraws any outstanding offer and frees the assigned driver back to `online`.

Every candidate a ride has already been offered to (accepted, declined, or timed out) is tracked in `ride.matching.excludedDriverIds` so the same driver is never re-offered the same ride twice.

Deploy:
```
cd firebase/functions
npm install
firebase functions:secrets:set GOOGLE_MAPS_SERVER_KEY   # separate, server-side Directions key — see below
firebase deploy --only functions
```

The **`GOOGLE_MAPS_SERVER_KEY`** secret is intentionally separate from the client's `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: it's used server-side only (never shipped in the app bundle), needs the **Directions API** enabled, and can be locked down by IP/server restrictions in Google Cloud Console instead of by Android package name / iOS bundle ID.

I have **not** been able to deploy or run these functions against a live Firebase project in this environment — there's no project, billing account (Cloud Functions require the Blaze plan), or Directions key available here. The code compiles cleanly (`npx tsc` in `firebase/functions`, zero errors, verified build output), and the logic has been reasoned through carefully (see the comments on the security-rules timing issue in `matchDriver.ts`'s neighbor `useRideDispatch.ts`), but treat the actual Cloud Scheduler/RTDB trigger behavior as unverified until you deploy it.

## Setup required before this runs

1. Create a Firebase project, enable **Phone** sign-in under Authentication and create a **Realtime Database** instance.
2. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) and place them in `mobile/` (paths already wired up in `mobile/app.json`; these files are gitignored — generate your own).
3. Update `firebase/.firebaserc` with your real project id.
4. `cd mobile && npm install`.
5. **Important:** this app uses `@react-native-firebase` (native SDKs, required for phone auth), so it needs a custom dev client — it will **not** run in Expo Go. Build one with `npx expo prebuild` + `npx expo run:android` / `run:ios`, or `eas build --profile development`.
6. Import `firebase/schema/sample-database.json` (or at least a `/pricing_rules` node) into your Realtime Database so fare estimates work.
7. In Google Cloud Console (same or linked project), enable **Places API**, **Directions API**, and **Distance Matrix API**, then create a key. Put it in `mobile/.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (copy `mobile/.env.example`) for the autocomplete/route/ETA calls, **and** separately in `mobile/app.json` under `android.config.googleMaps.apiKey` for the native Android Maps SDK. Without a key, the app still runs — search/autocomplete returns nothing and routes fall back to a straight dashed line between pickup and dropoff instead of a real road route.

8. Deploy the Realtime Database rules and Cloud Functions (see the Cloud Functions section below) — `matchRideRequest` is what actually assigns a driver to a ride request, so without it a ride will sit in `requested` forever.

I haven't been able to run or test any of this against a live Firebase project, a real device/simulator, or an actual Google Maps key in this environment — there's no Firebase project, Maps key, billing account, or mobile runtime available here. Everything type-checks cleanly (`npx tsc --noEmit` in both `mobile/` and `firebase/functions/`, zero errors; `firebase/functions` also builds successfully with `npx tsc`), but treat the setup steps above and the actual on-device/on-Firebase behavior as unverified until you run them yourself.

## Driver busy/online lifecycle

Accepting an offer sets `/drivers/{uid}/status` to `busy` (so the driver stops receiving new offers), and the driver's own client flips it back to `online` once their ride reaches `completed` or `cancelled` — always as a self-write, since the security rules only let a driver write their own status node. If the rider cancels instead, the driver's client may not even be in the foreground to do that — so `onRideCancelled` (Phase 5) does it server-side as a backstop.

## Status

All 5 planned phases are built: Firebase schema/rules, sync hooks (auth, live driver location, ride dispatch), Rider UI, Driver UI, and Cloud Functions (matching + fare finalization). What this repo does *not* include, since it wasn't asked for: push notifications, in-app card payment processing (the "Card" option is recorded but nothing actually charges a card), an admin dashboard, or a rider-facing ride-history screen (the data for one — `/riderHistory` — already exists server-side).
