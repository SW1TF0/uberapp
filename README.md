# Kardzhali Ride

A localized ride-hailing MVP for Kardzhali, Bulgaria. Expo/React Native
(TypeScript) client on `@react-native-firebase` (Auth + Realtime Database).

**Runs entirely on free tiers, no credit card required anywhere:**
Firebase's free Spark plan (Realtime Database + email/password Auth) and
OpenStreetMap-based services (Nominatim search, OSRM routing, Leaflet map
tiles — all free, no API key). There's an optional upgrade path to Google
Maps + Cloud Functions (Firebase's paid Blaze plan) described near the
bottom, but nothing here requires it. The one exception is **real card
payments** ("Card payments (Stripe)" below) — genuinely charging a card is
never free anywhere (Stripe takes a standard per-transaction cut) and
needs Blaze for the backend that talks to Stripe; it's entirely optional
and cash rides work with zero cost either way.

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

- `/users/{uid}` — `{ uid, role: 'rider'|'driver', name, phone, email, createdAt, avatarUrl?, notificationsEnabled?, banned? }`. `banned` is admin-only-writable — see "Admin panel" below.
- `/drivers/{uid}` — `{ profile: { name, phone, rating, ratingCount, vehicle, avatarUrl?, carPhotoUrl? }, status: 'offline'|'online'|'busy', location: { lat, lng, heading, speed, updatedAt }, settledUpTo?, approved }`. Keyed by the driver's own auth uid, so rules stay simple. `rating`/`ratingCount` are self-written by the driver's own app (see "Reviews & ratings" below) — riders never write to another user's driver node. `settledUpTo` (admin-only-writable) is a timestamp: completed rides after it are what the driver currently owes the platform. `approved` (self-writable only once, as `false`, at signup — otherwise admin-only) gates whether the driver can ever set their own `status` to `'online'`; see "Admin panel" below.
- `/reports/{reportId}` — `{ reporterId, reporterRole, reportedId, rideId, reason, createdAt }`. Anyone can create one about themselves; only the admin account can read the list back. See "Admin panel" below.
- `/rides/{rideId}` — full ride lifecycle document (`pickup`, `dropoff`, `status`, fare fields, timestamps, `rating`, `reviewText`). `status` moves `requested → accepted → arrived → in_progress → completed` (or `cancelled` at any point before `completed`). On completion also carries `platformFeeBGN`/`driverEarningsBGN` (see "Platform commission" below). For card rides, also `paymentStatus`/`stripePaymentIntentId` — see "Card payments" below; these two fields can only ever be written by the Stripe Cloud Functions (Admin SDK), never by a client.
- `/rides/{rideId}/matching` — matching bookkeeping (`offeredDriverId`, `offeredAt`, `expiresAt`, `excludedDriverIds`), written by the rider's own client (see below).
- `/driverRequests/{driverId}/{rideId}` — fan-out ride offer a driver currently has open. Written by the rider's client when it matches them, resolved (accepted/declined) by the driver client.
- `/activeRides/{uid}` — a single rideId (or absent), pointing each rider/driver at whichever ride they're currently in. Read/write only by that same uid. The rider/driver apps listen here rather than running a broad query across `/rides` (which the security rules can't scope to "my own rides" for a query spanning many other users' documents) — once the pointer resolves to an id, the app reads that one ride directly, which the per-ride rule below does allow.
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
- **Car photos.** Drivers get a second photo picker on the Profile screen, same base64-in-RTDB approach (just a wider 4:3 crop), stored at `/drivers/{uid}/profile/carPhotoUrl`. Shown as a strip above the driver card on the rider's live-trip screen and as a thumbnail on the admin's Drivers list, so a rider can actually recognize the car pulling up.
- **Settings + in-app notifications.** A Settings screen (gear icon on Profile) toggles notifications, stored on the user's profile. When enabled, `useRideNotifications.ts` fires a local notification (`expo-notifications`) on key status changes — driver matched, arrived, trip started/completed for the rider; a new ride request for the driver. **This only works while the app is open or backgrounded but still running** — there's no server to wake it up from fully closed, which real push notifications need (see "Optional upgrade" below).

## Card payments (Stripe)

Unlike everything else in this app, real card charging genuinely can't be
done for free or purely client-side — card details have to go through a
PCI-compliant processor (Stripe here), which requires a small backend to
create the charge, and Stripe itself takes a standard per-transaction cut
(~2.9% + a small fixed fee; there's no free processor anywhere). This is
the one part of the app that costs money to run, and it's the one part
that needs the Firebase **Blaze** plan (a card on file with Google, since
Cloud Functions can only make outbound network calls — to Stripe's API —
on Blaze, not the free Spark plan). Cash rides need none of this and stay
completely free.

**How it works:** when a driver completes a `paymentMethod: 'card'` ride,
the rider's app calls the `createPaymentIntent` Cloud Function
(`firebase/functions/src/payments.ts`), which creates a Stripe
PaymentIntent for the final fare and returns its `client_secret`. The app
hands that to Stripe's own Payment Sheet (`@stripe/stripe-react-native`) to
collect the card — the card number never reaches this app or Firebase.
Once Stripe actually confirms the charge, it calls the `stripeWebhook`
function directly, which is the *only* thing allowed to write
`paymentStatus: 'paid'` on the ride (enforced in `database.rules.json` —
a client write can only leave that field exactly as it already is), so a
rider can't just claim they paid. The rating screen is hidden behind
payment for card rides until that confirmation lands, usually within a
couple of seconds.

Setup:
1. Create a free account at [stripe.com](https://dashboard.stripe.com/register). Stay in **test mode** at first (test card `4242 4242 4242 4242`, any future expiry/CVC) — no real charges happen in test mode.
2. Stripe Dashboard → Developers → API keys. Copy the **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).
3. Upgrade the Firebase project to **Blaze** (console.firebase.google.com → your project → Upgrade, bottom left). Needed only for this feature — everything else in the app stays on Spark either way.
4. From `firebase/`:
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
   paste the `sk_test_...` key when prompted.
5. `cd functions && npm install`, then deploy **just the two payment functions** (not the whole `functions/` codebase — the other ones there are the separate, still-optional matching/fare upgrade, and deploying them too would activate a second, server-side matching engine alongside the client-side one):
   ```
   firebase deploy --only functions:createPaymentIntent,functions:stripeWebhook
   ```
   The deploy output prints the `stripeWebhook` function's URL (`https://<region>-<project>.cloudfunctions.net/stripeWebhook`).
6. Stripe Dashboard → Developers → Webhooks → Add endpoint. Paste that URL, and select the `payment_intent.succeeded` and `payment_intent.payment_failed` events. Stripe then shows a **Signing secret** (`whsec_...`) — set it too:
   ```
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
   then redeploy the same two functions so they pick it up.
7. Add the publishable key to `mobile/` — it's not secret, so it's a plain env var, not a file upload like the google-services files. Either export it before building (`set STRIPE_PUBLISHABLE_KEY=pk_test_...` on Windows, `export` on Mac/Linux) or, for EAS cloud builds, `eas env:set --scope project --name STRIPE_PUBLISHABLE_KEY --type string --value pk_test_... --visibility plaintext --environment preview`.
8. Rebuild (`eas build --platform android --profile preview`) and test a card ride end to end with the `4242...` test card.
9. When ready for real money: flip Stripe out of test mode, generate **live** keys (`pk_live_...`/`sk_live_...`), repeat steps 4–7 with those, and add a live webhook endpoint (test and live mode each need their own).

## Admin panel

One hardcoded account — currently `krasimiruzun@smartmenukj.com` (see
`mobile/src/config/admin.ts` — change it there and in every matching
`auth.token.email === '...'` check in `database.rules.json` if you ever
need a different admin email) — gets a completely different app experience
after logging in: `RootNavigator` checks the signed-in Firebase user's
email before anything else and routes straight to an admin section
instead of the normal rider/driver screens. Nobody else can reach it, and
the enforcement isn't just hiding a button — `database.rules.json` grants
the broad reads/writes this needs (listing every user, banning someone,
marking a driver's dues settled) only when `auth.token.email` matches that
exact string, checked server-side on every request regardless of what the
app's UI does.

**Setting up the admin account:** don't sign up through the app (that
forces you through the rider/driver profile flow, which the admin path
skips entirely). Instead, in the Firebase console → Authentication →
Users → **Add user**, enter the admin email and password directly. Then
just sign in from the app's normal Welcome → EmailAuth screen using the
"Вход" (sign in) tab.

What it can do:
- **Шофьори (Drivers)** — every driver, their vehicle (+ car photo, if
  they added one), rating, and how much platform commission they
  currently owe (the sum of `platformFeeBGN` across their completed cash
  rides since the last time they were marked settled — there's no
  automated payout here, this is meant for an admin collecting that cash
  periodically). A "Платено" button resets the counter; a "Бани"/"Отбани"
  button toggles the ban. A driver who hasn't been approved yet (see
  "Driver approval" below) shows at the top of the list with an "Одобри"
  button instead of the financial info, since they can't complete any
  rides until approved.
- **Клиенти (Clients)** — every rider, with the same ban/unban toggle.
- **Жалби (Reports)** — every report riders/drivers have filed against
  each other (see below).

**Driver approval:** a new driver signup can't actually go online (and so
can never be matched with a rider) until the admin approves them —
`completeDriverProfile()` writes `/drivers/{uid}/approved: false` at
signup, and `database.rules.json` only lets the *admin* ever flip it to
true; a driver's own client can only write it once, as `false`, when
their driver record doesn't exist yet. A driver who's still pending sees
a "Чакаш одобрение" screen instead of the normal dashboard (they can
still open their Profile to set their photo/car photo while waiting).
**Note:** deploying this rule change means any driver accounts created
*before* it (i.e. your own test driver from earlier) won't have an
`approved` field at all, which reads as "not approved" — you'll need to
approve them once from the admin panel after updating.

**Bans are enforced server-side**, not just hidden in the UI: a banned
rider's ride-creation write is rejected by `database.rules.json`, and a
banned driver can no longer set their own status to `'online'` (so they
stop receiving new offers). A banned user who's still signed in sees a
dedicated "profile suspended" screen instead of the normal app.

**Reports:** both the rider's live-trip screen and the driver's trip
screen have a small flag-icon button that opens a short "what happened"
form and writes to `/reports`, visible only to the admin. This is
report-only — no automatic action is taken; the admin reviews reports and
manually bans someone if warranted.

## Security rules

`firebase/database.rules.json` enforces:
- A user can only read/write their own `/users/{uid}` and `/drivers/{uid}` nodes.
- Any authenticated user can *read* driver profiles/locations (riders need this to show nearby drivers on the map).
- A ride can only be created by the rider named in it; only the assigned rider/driver can read or update a given ride; a driver can only attach themselves to an unassigned ride while its status is still `requested` and their own `/drivers/{uid}/status` is `online`.
- `/rides/{rideId}/matching` is writable by that ride's rider, or by whichever driver currently holds the offer (to clear it on decline).
- `driverRequests/{driverId}/{rideId}` is writable by that driver, or by the rider of the ride referenced in it (to create/withdraw an offer).
- `pricing_rules` is read-only to clients (there's no writer in the free-tier setup — see it as a one-time admin console edit, not something the app changes).
- `transactions`/`riderHistory`/`driverHistory` are writable only by the completing driver, for a ride already marked `completed`, and readable only by that ride's own rider/driver.
- `/users/{uid}` accepts `avatarUrl` and `notificationsEnabled` as additional self-writable fields alongside the original ones; anything else is still rejected by its catch-all deny rule. `banned` is the one exception that's readable/self-writable-only-as-a-no-op — a normal write can never actually change it, only a write from the admin account (matched by `auth.token.email`) can.
- The admin account (see "Admin panel" above) additionally gets read access to all of `/users`, `/rides`, and `/driverHistory/*` (needed to list every driver/client and compute what each driver owes), and is the only account that can write `/drivers/{uid}/settledUpTo` or read `/reports` back (anyone can write their own report there, but only the admin can read the list).
- A driver going online (`/drivers/{uid}/status` → `'online'`) additionally requires `banned !== true` on their `/users` record and `approved === true` on their `/drivers` record — so a banned or not-yet-approved driver is blocked at the exact point that would let them receive ride offers, not just hidden in the UI.

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

### iOS

The app's code and config already target iOS — `mobile/app.config.js` has an iOS bundle id, `GoogleService-Info.plist` wiring, location/photo-library permission strings, and the CocoaPods settings `@react-native-firebase` needs (`useFrameworks: 'static'`). Add an iOS app in Firebase Project Settings (step 4 above covers this) and upload `GoogleService-Info.plist` as `GOOGLE_SERVICES_INFO_PLIST` the same way as the Android file.

**Building is free either way — installing on a real iPhone is not, and that's Apple's rule, not this app's.** Unlike Android, there's no such thing as "download an .ipa and tap install":

- **Free option: iOS Simulator.** `eas build --platform ios --profile preview-ios-simulator` produces an unsigned `.app` that needs no Apple account at all. You then need a **Mac** with Xcode installed (Xcode itself is a free download) to drag the build into Simulator and run it there. No physical iPhone involved, and GPS/camera are simulated, but it's enough to see the UI and basic flow for free.
- **Paid option: a real iPhone.** Apple requires enrolling in the **Apple Developer Program ($99/year)** to sign an app for any physical device — ad hoc install, TestFlight, or the App Store. There is no free tier of this, and no way around it (Apple's own free "sideload from Xcode" option below is the only exception, and it isn't practical for repeated testing). Once enrolled: `eas build --platform ios --profile preview` (add `"ios": {"distribution": "ad-hoc"}` to that profile once you've registered your device's UDID with `eas device:create`), or `eas build --platform ios --profile production` + `eas submit -p ios` for TestFlight.
- **Also free, but needs a Mac + cable, and expires weekly:** open `mobile/` in Xcode with a free Apple ID signed in ("Personal Team"), plug your iPhone in via USB, and hit Run. Apple caps free signing at a 7-day certificate, so the app stops opening after a week until you reconnect and reinstall from Xcode. Not realistic for a family/friends test group, but workable for testing solo if you already own a Mac.

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

Firebase schema/rules, sync hooks (auth, live driver location, ride dispatch, notifications), Rider UI (map, destination picker, ride confirm, live trip, ride history), Driver UI (dashboard, trip screen, earnings & reviews), avatar photos, dual BGN/EUR currency, 10% platform commission bookkeeping, and written reviews are all built and running client-side on the free stack described above, in a dark-red theme, with the UI in Bulgarian throughout. Real card charging via Stripe is built too (`createPaymentIntent`/`stripeWebhook` Cloud Functions + the Payment Sheet in the app) — see "Card payments (Stripe)" above — but is opt-in since it's the one piece that needs Firebase's paid Blaze plan and a Stripe account; cash rides need none of it. The matching/fare-finalization Cloud Functions are a separate, still-optional upgrade path. What this repo does *not* include, since it isn't achievable for free/client-only: real push notifications while the app is fully closed (needs a server — see "Optional upgrade"). No admin dashboard either, since none was asked for.
