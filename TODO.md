# Ranked Sleep — Setup TODO

Get through these in order and you'll have a working app.

---

## 1. Supabase

- [ ] Create a new project at https://supabase.com
- [ ] Go to **SQL Editor**, paste `supabase/schema.sql`, and run it
- [ ] Go to **Project Settings → API** and copy:
  - [ ] **Project URL** → `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] **service_role key** → `SUPABASE_SERVICE_KEY` *(backend only, keep secret)*

---

## 2. Health Data (no account needed)

**iOS:**
- [ ] Garmin users: Garmin Connect → More → Health & Wellness → enable **Apple Health** sync
- [ ] The app will request HealthKit permission on first launch — nothing else needed

**Android:**
- [ ] Install Health Connect if not already present (pre-installed on Android 14+)
- [ ] Garmin users: Garmin Connect → Settings → Health Snapshot → enable **Health Connect** sync
- [ ] The app will request Health Connect permission on first launch

---

## 3. Backend `.env`

```bash
cp backend/.env.example backend/.env
```

Fill in:

```
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ADMIN_SECRET=           # make something up — used for manual match creation
MATCH_CRON_SCHEDULE=0 21 * * *  # optional, 9pm ET is the default
```

---

## 4. Mobile `.env`

```bash
cp mobile/.env.example mobile/.env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000   # e.g. 192.168.1.x — not localhost
```

---

## 5. Install dependencies

```bash
cd backend && npm install
cd ../mobile && npm install
```

---

## 6. Prebuild the mobile app (one-time)

`react-native-health` is a native module — Expo Go won't work. Run:

```bash
cd mobile && npx expo prebuild
```

This generates `ios/` and `android/` folders. You only need to do this once (or after adding new native packages).

---

## 7. Run it

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — mobile (pick your platform)
cd mobile && npx expo run:ios
# or
cd mobile && npx expo run:android
```

**Prerequisites:** Xcode installed for iOS, Android Studio for Android.

---

## 8. How sleep data flows

No webhooks, no external services. Here's what happens:

1. User opens the app each morning
2. App calls HealthKit (iOS) or Health Connect (Android) to pull last night's sleep
3. App posts the data to `POST /api/sleep/sync` (JWT-authenticated)
4. Backend scores the sleep, upserts the record, checks if the match can resolve
5. If both players have synced, match resolves and push notifications go out

The sync is idempotent — opening the app multiple times won't create duplicate records.

---

## 9. Daily match creation

Runs automatically at **9pm ET every night** via a built-in cron job. Nothing to configure.

To trigger manually (e.g. for testing):

```bash
curl -X POST http://localhost:3000/api/matches/create-daily \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d "{\"date\": \"$(date +%Y-%m-%d)\"}"
```

---

## 10. Onboard friends

For each person:
1. They sign up with email + password
2. They tap **Connect Apple Health** (or Health Connect) — grants permission
3. Next morning when they open the app, sleep data syncs automatically
4. They're in the pool for nightly matches

---

## Nice-to-haves (post-PoC)

- [ ] Add Oura Ring support via their free REST API (user pastes Personal Access Token)
- [ ] EAS Build setup so you can distribute without Xcode/Android Studio
- [ ] Set up a persistent backend host (Railway, Fly.io, Render) instead of running locally
- [ ] Match history chart in Profile screen
- [ ] Deep link from push notification into match result
