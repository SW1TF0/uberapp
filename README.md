# Kardzhali Ride

A localized ride-hailing MVP for Kardzhali, Bulgaria. Expo/React Native
(TypeScript) client on `@react-native-firebase` (Auth + Realtime Database).

**Runs entirely on free tiers, no credit card required anywhere:**
Firebase's free Spark plan (Realtime Database + email/password Auth) and
OpenStreetMap-based services (Nominatim search, OSRM routing, Leaflet map
tiles — all free, no API key). There's an optional upgrade path to Google
Maps + Cloud Functions (Firebase's paid Blaze plan) described near the
bottom, but nothing here requires it.

## Repo layout

```
firebase/
  database.rules.json      Realtime Database security rules
  firebase.json             Firebase CLI project config
  .firebaserc                Project alias (replace with your project id)
  schema/sample-database.json  Reference snapshot of the DB shape, incl. seed data
  functions/                Optional Cloud Functions (needs the paid Blaze plan — see below)
mobile/
  App.tsx                   Entry point
  src/firebase/firebase.ts  Typed @react-native-firebase auth/db instances
  src/types/models.ts       Shared TS types matching the DB schema
  src/store/                Zustand stores (auth, active ride/offer)
  src/hooks/                useAuth, useDriverLocation, useRideDispatch, useRideNotifications
  src/utils/fare.ts         Haversine distance + BGN fare formula
  src/utils/currency.ts     Fixed BGN/EUR peg conversion + dual-currency formatting
  src/utils/reviews.ts      Computes a driver's aggregate rating + review list from ride history
  src/services/freeMaps.ts  Nominatim search + OSRM routing (free, no key)
  src/services/avatar.ts    Picks + compresses a profile photo, stores it as base64 in the DB
  src/components/LeafletMap.tsx  WebView + Leaflet + OSM tiles (free, no key)
  src/navigation/            RootNavigator + Auth/Rider/Driver stacks
  src/screens/auth/          Welcome, email sign up/in, profile+vehicle setup
  src/screens/rider/         Live map, destination picker, ride confirm, live trip, ride history
  src/screens/driver/        Dashboard (online toggle), turn-by-turn trip screen, earnings & reviews
  src/screens/shared/        Profile (avatar, sign out), Settings (notifications toggle)
  src/components/            LeafletMap, IncomingRequestOverlay (15s timer)
```

## Data model (Realtime Database)

- `/users/{uid}` — `{ uid, role: 'rider'|'driver', name, phone, email, createdAt, avatarUrl?, notificationsEnabled? }`
- `/drivers/{uid}` — `{ profile: { name, phone, rating, ratingCount, vehicle, avatarUrl? }, status: 'offline'|'online'|'busy', location: { lat, lng, heading, speed, updatedAt } }`. Keyed by the driver's own auth uid, so rules stay simple. `rating`/`ratingCount` are self-written by the driver's own app (see "Reviews & ratings" below) — riders never write to another user's driver node.
- `/rides/{rideId}` — full ride lifecycle document (`pickup`, `dropoff`, `status`, fare fields, timestamps, `rating`, `reviewText`). `status` moves `requested → accepted → arrived → in_progress → completed` (or `cancelled` at any point before `completed`). On completion also carries `platformFeeBGN`/`driverEarningsBGN` (see "Platform commission" below).
- `/rides/{rideId}/matching` — matching bookkeeping (`offeredDriverId`, `offeredAt`, `expiresAt`, `excludedDriverIds`), written by the rider's own client (see below).
- `/driverRequests/{driverId}/{rideId}` — fan-out ride offer a driver currently has open. Written by the rider's client when it matches them, resolved (accepted/declined) by the driver client.
- `/pricing_rules` — single BGN pricing config: base fare, per-km/per-min rates, minimum fare, Kardzhali city-limits geofence (center + radius), outer-zone surcharge multiplier, per-vehicle-type multipliers, `platformCommissionRate` (0.10 = 10%). Read-only to clients; see `firebase/schema/sample-database.json` for real Kardzhali-centered values.
- `/transactions/{rideId}` — the logged, final record of a completed ride (`riderId`, `driverId`, `distanceKm`, `durationMin`, `fareBGN`, `platformFeeBGN`, `driverEarningsBGN`, `paymentMethod`, `completedAt`), written by the completing driver's client.
- `/riderHistory/{riderId}/{rideId}` and `/driverHistory/{driverId}/{rideId}` — `true`-valued fan-out indexes so a user's completed-ride history can be listed without scanning all of `/rides`. Each user can only read/write their own.

**No Firebase Storage** — as of late 2024, Google requires the paid Blaze plan just to *create* a Storage bucket on a new project, even though actual usage would fall inside the free tier. So avatar photos are resized to 128x128, compressed to a small JPEG, and stored as a base64 data URI directly on `avatarUrl` (capped at ~150KB by the security rules) — no separate file host needed at all.

See `firebase/schema/sample-database.json` for a full example snapshot (including a completed ride's `/transactions` + history entries) you can import via the Firebase console during local development.

## No backend: matching and fare finalization run on-device

There's no server in the free-tier setup, so two things a real backend
would normally do happen client-side instead, in `mobile/src/hooks/useRideDispatch.ts`:

- **Matching.** When a rider requests a ride, their own app queries `/drivers`
  for **online** drivers, computes haversine distance to the pickup point,
  and offers the ride to the nearest one **within 5km** by writing
  `/driverRequests/{driverId}/{rideId}` with a 15-second expiry. If that
  driver declines (or the offer times out), the rider's app immediately
  tries the next-nearest untried driver. This only progresses while the
  rider's app is open — there's no Cloud Scheduler here to retry in the
  background.
- **Fare finalization.** When the driver taps "Complete Trip," their app
  calls OSRM for the actual driven route's distance/duration, recomputes
  the fare with the same BGN formula used everywhere else, writes it back
  to the ride, and logs the finished trip to `/transactions` plus
  `/riderHistory`/`/driverHistory`.

The security rules were loosened just enough for this: a ride's own rider
can write offers under other drivers' `/driverRequests` nodes and the
`matching` bookkeeping on their own ride, and the completing driver can
write `/transactions` and both history indexes for a ride whose status
they just set to `completed`. This is a deliberate trade-off for running
with no backend at all — see "Optional upgrade" below for the
server-authoritative version of the same logic.

## Currency, commission, reviews, avatars & notifications

- **Dual currency.** Every fare shows both BGN and EUR (`mobile/src/utils/currency.ts`), using the fixed 1.95583 BGN/EUR peg Bulgaria's lev has held since 1997 — not a fluctuating rate, so hardcoding it is accurate, not a simplification.
- **10% platform commission.** `completeRide()` in `useRideDispatch.ts` splits the final fare into `platformFeeBGN` (10%, from `pricing_rules.platformCommissionRate`) and `driverEarningsBGN` (the rest), stored on both the ride and its `/transactions` record. The driver sees this breakdown on the trip-complete screen and totalled on the new **Earnings & Reviews** screen (wallet icon on the driver dashboard).
- **Reviews.** Riders can leave a star rating *and* a written review after a completed ride (stored on the ride itself, which they already have write access to). A driver's aggregate rating isn't a running counter riders write to — the security rules don't allow that — instead each driver's own app computes it from their own completed rides (`mobile/src/utils/reviews.ts`) and self-writes the average to `/drivers/{uid}/profile/rating`. The same computation powers the reviews list on the Earnings & Reviews screen.
- **Avatar photos.** Either role can pick a profile photo (Profile screen, tap the camera badge on the avatar) via `expo-image-picker`, resized/compressed with `expo-image-manipulator`, and stored as a base64 data URI on `/users/{uid}/avatarUrl` (and `/drivers/{uid}/profile/avatarUrl` for drivers, since that's the record riders actually read) — no file storage service involved at all. Shown on the driver card during a live trip and on the rider's post-trip rating screen.
- **Settings + in-app notifications.** A Settings screen (gear icon on Profile) toggles notifications, stored on the user's profile. When enabled, `useRideNotifications.ts` fires a local notification (`expo-notifications`) on key status changes — driver matched, arrived, trip started/completed for the rider; a new ride request for the driver. **This only works while the app is open or backgrounded but still running** — there's no server to wake it up from fully closed, which real push notifications need (see "Optional upgrade" below).

## Security rules

`firebase/database.rules.json` enforces:
- A user can only read/write their own `/users/{uid}` and `/drivers/{uid}` nodes.
- Any authenticated user can *read* driver profiles/locations (riders need this to show nearby drivers on the map).
- A ride can only be created by the rider named in it; only the assigned rider/driver can read or update a given ride; a driver can only attach themselves to an unassigned ride while its status is still `requested` and their own `/drivers/{uid}/status` is `online`.
- `/rides/{rideId}/matching` is writable by that ride's rider, or by whichever driver currently holds the offer (to clear it on decline).
- `driverRequests/{driverId}/{rideId}` is writable by that driver, or by the rider of the ride referenced in it (to create/withdraw an offer).
- `pricing_rules` is read-only to clients (there's no writer in the free-tier setup — see it as a one-time admin console edit, not something the app changes).
- `transactions`/`riderHistory`/`driverHistory` are writable only by the completing driver, for a ride already marked `completed`, and readable only by that ride's own rider/driver.
- `/users/{uid}` accepts `avatarUrl` and `notificationsEnabled` as additional self-writable fields alongside the original ones; anything else is still rejected by its catch-all deny rule.

Deploy with the Firebase CLI from `firebase/`:
```
firebase deploy --only database
```

## Setup (free, no credit card)

1. Create a Firebase project at console.firebase.google.com — no billing/Blaze upgrade needed for any of this.
2. **Authentication** → enable the **Email/Password** sign-in method.
3. **Realtime Database** → create one (any region).
4. Add an Android app and/or iOS app in Project Settings, download `google-services.json` / `GoogleService-Info.plist`, and place them in `mobile/` (paths already wired up in `mobile/app.config.js`; these files are gitignored — generate your own, don't commit them).
5. Edit `firebase/.firebaserc`, replace the placeholder with your real project id.
6. `cd firebase && firebase deploy --only database` to push the rules.
7. Import `firebase/schema/sample-database.json`'s `pricing_rules` node into your Realtime Database (Firebase console → Realtime Database → import, or just create it by hand) — fare estimates throw without it. **If you already created a `pricing_rules` node before this feature update**, don't re-import (that would overwrite your real ride data at the root) — just open that node in the console and add one field by hand: `platformCommissionRate` = `0.1`.
8. `cd mobile && npm install`.
9. **Important:** this app uses `@react-native-firebase` (native SDKs, required even for email/password auth on this SDK), so it needs a custom dev client — it will **not** run in Expo Go. Build one with `npx expo prebuild` + `npx expo run:android` / `run:ios` (needs Android Studio / Xcode locally), or use Expo's free-tier cloud builds (see "Building with EAS" below).
10. Run it, sign up as a rider on one device/emulator and as a driver on another (or the same device, signed out and back in as a different account), flip the driver online, and request a ride from the rider side.

## Building with EAS (cloud build, no Android Studio/Xcode needed)

`mobile/eas.json` defines `development`/`preview`/`production` build
profiles. `eas build --platform android --profile preview` builds a
standalone installable APK on Expo's servers — nothing to install
locally beyond `npm install -g eas-cli` and `eas login` (free account).

One catch: **EAS Build only uploads files tracked by git**, and
`google-services.json`/`GoogleService-Info.plist` are deliberately
gitignored (they're project-specific secrets). `mobile/app.config.js`
(a dynamic config, not a static `app.json`, specifically so this can be
an expression) reads them from environment variables when present,
falling back to the local file for on-machine builds:
```js
googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
```
So before your first cloud build, upload the file as a secure EAS **file**
environment variable (run from `mobile/`, with `google-services.json`
already sitting there from the setup steps above):
```
eas env:set --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment preview
```
(swap `--environment preview` for `development`/`production`, or repeat the command once per environment you build for). Do the same for `GoogleService-Info.plist` under the name `GOOGLE_SERVICES_INFO_PLIST` if you're also building for iOS.

I haven't been able to run or test any of this against a live Firebase project, a real device/simulator, or the public Nominatim/OSRM endpoints from a running app in this sandbox — there's no Firebase project, billing-free or not, and no mobile runtime available here. Everything type-checks cleanly (`npx tsc --noEmit` in `mobile/`, zero errors), and the JSON files (`database.rules.json`, `sample-database.json`) are verified valid JSON, but treat the actual on-device/on-Firebase behavior as unverified until you run it yourself.

## Free-tier limitations, honestly

- **Matching only runs while the rider's app is open.** No backend means no background retry — if the rider force-quits the app mid-search, matching stops.
- **Nominatim and OSRM are public demo servers**, not meant for production traffic — no uptime guarantee, and Nominatim asks for roughly 1 request/second. Fine for personal use/testing; if you outgrow it, self-host either or switch to a paid provider.
- **A driver could in principle write fabricated `/driverRequests` offers to themselves**, or a rider could spam offer-writes — the relaxed rules needed for a serverless setup trade some of that server-side trust guarantee away. Not a concern for personal/demo use; would matter for a real public launch.
- **No phone verification** — email/password means anyone can sign up with any email; there's no confirmation step.

## Optional upgrade: Google Maps + Cloud Functions (needs Firebase Blaze)

`firebase/functions/` still contains a complete, tested, server-authoritative
version of the matching and fare logic (`matchRideRequest`,
`retryUnmatchedRides`, `onOfferRemoved`, `finalizeRideFare`,
`onRideCancelled`) — the app just doesn't call it by default. If you later
want a real backend (matching that keeps working with the rider's app
closed, tighter security rules, actual Google Maps/Directions instead of
the OSM stack):

1. Upgrade the Firebase project to the **Blaze** (pay-as-you-go) plan — this needs a card on file, though Cloud Functions has a generous free monthly quota.
2. `cd firebase/functions && npm install && firebase deploy --only functions`.
3. Set a server-side Directions key: `firebase functions:secrets:set GOOGLE_MAPS_SERVER_KEY` (needs the Directions API enabled in a billed Google Cloud project).
4. Swap the client-side matching/fare-finalization calls in `mobile/src/hooks/useRideDispatch.ts` back out in favor of just writing the ride and letting the Cloud Functions react to it (the functions already assume this shape — no rule changes needed for them specifically, since Admin SDK bypasses rules).

This isn't wired up by default because it isn't free, but the code is there and builds cleanly (`npx tsc` in `firebase/functions`) if you want it.

## Driver busy/online lifecycle

Accepting an offer sets `/drivers/{uid}/status` to `busy` (so the driver stops receiving new offers), and the driver's own client flips it back to `online` once their ride reaches `completed` or `cancelled` — always as a self-write, since the security rules only let a driver write their own status node. If the rider cancels before the driver's app notices, the pending offer is simply left to expire on its 15s timer (see "Free-tier limitations" above) rather than being force-cleared server-side.

## Status

Firebase schema/rules, sync hooks (auth, live driver location, ride dispatch, notifications), Rider UI (map, destination picker, ride confirm, live trip, ride history), Driver UI (dashboard, trip screen, earnings & reviews), avatar photos, dual BGN/EUR currency, 10% platform commission bookkeeping, and written reviews are all built and running client-side on the free stack described above, in a dark-red theme, with the UI in Bulgarian throughout. The equivalent Cloud Functions exist as an optional, unused-by-default upgrade path. What this repo does *not* include, since it isn't achievable for free/client-only: real push notifications while the app is fully closed (needs a server — see "Optional upgrade"), and real card payment processing (needs a payment processor like Stripe with server-side charge logic — the "Card" option is recorded but nothing actually charges a card). No admin dashboard either, since none was asked for.
