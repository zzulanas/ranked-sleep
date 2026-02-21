# Ranked Sleep 🌙

[![GitHub repo](https://img.shields.io/badge/github-ranked--sleep-181717?logo=github)](https://github.com/zzulanas/ranked-sleep)

Compete in nightly 1v1 sleep battles with your friends. Sleep data is pulled directly from Apple Health or Google Health Connect, scored with a weighted algorithm, and used to determine match winners — with ELO ratings tracking your progress over time.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is fine)
- An Apple Developer account (free tier works for personal device testing)
- EAS CLI — `npm install -g eas-cli`

---

## 1. Supabase Setup

1. Create a new project at https://supabase.com
2. Go to **SQL Editor**, paste the entire contents of `supabase/schema.sql`, and run it
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (backend only — keep secret)

---

## 2. Health Data Setup

Sleep data is pulled directly from the device on app open — no third-party API account needed.

**iOS (Apple Health):**
- The app requests HealthKit permission on first launch. No setup required.
- Garmin users: Garmin Connect → More → Health & Wellness → enable **Apple Health** sync.
- Oura, Whoop, and most other trackers sync to Apple Health automatically.

**Android (Health Connect):**
- Health Connect is pre-installed on Android 14+. On older devices, install it from the Play Store.
- Garmin users: Garmin Connect → Settings → Health Snapshot → enable **Health Connect** sync.
- The app requests permission on first launch.

---

## 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env, then:
npm run dev
```

**Environment variables:**
```
PORT=3001
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
ADMIN_SECRET=...              # used to manually trigger match creation
MATCH_CRON_SCHEDULE=0 21 * * *  # 9pm ET — matches created automatically (default)
```

---

## 4. Mobile Setup

`react-native-health` is a native module — Expo Go is not supported.

```bash
cd mobile
npm install
cp .env.example .env
# Fill in .env

# One-time: generate ios/ and android/ native folders
npx expo prebuild --platform ios

# Build and run (requires Xcode for iOS, Android Studio for Android)
npx expo run:ios
```

**Or build in the cloud with EAS (no Xcode needed on your machine):**
```bash
eas login
eas build --platform ios --profile preview
# Follow prompts to connect your Apple account and register your device
```

**Environment variables:**
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=https://sleep-api.zzflix.com   # or your backend URL
```

---

## 5. How It Works

1. **9pm ET:** Backend automatically creates 1v1 matches, pairing all users randomly
2. **Users sleep** with their wearables
3. **Morning:** User opens the app → sleep data is pulled from HealthKit/Health Connect and posted to the backend
4. **Backend** scores the sleep (0–100) and checks if both players in a match have synced
5. **Match resolves:** winner is determined by score, ELO ratings update, push notifications go out
6. **By 2pm ET:** any matches where a player didn't sync are voided

The sync is idempotent — opening the app multiple times won't create duplicate records.

---

## 6. Daily Match Creation

Matches are created automatically at **9pm ET** via a built-in cron job. No manual steps needed.

To trigger manually (useful for testing):
```bash
curl -X POST https://your-backend/api/matches/create-daily \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d "{\"date\": \"$(date +%Y-%m-%d)\"}"
```

---

## Scoring Algorithm

Score is computed from up to 5 components. Missing fields are gracefully excluded and weights are renormalized:

| Component | Base Weight | Target |
|-----------|-------------|--------|
| Duration | 35% | 8 hours = 100pts |
| Efficiency | 25% | 90%+ sleep efficiency = 100pts |
| Deep Sleep % | 20% | ≥20% of total sleep = 100pts |
| REM Sleep % | 15% | ≥25% of total sleep = 100pts |
| HRV | 5% | 80ms = 100pts, 20ms = 0pts |

---

## ELO Tiers

| Rating | Tier |
|--------|------|
| < 900 | 🥉 Bronze |
| 900–1099 | 🥈 Silver |
| 1100–1299 | 🥇 Gold |
| 1300–1499 | 💎 Platinum |
| 1500+ | 🔷 Diamond |

All players start at 1000 ELO (Silver). K-factor is 20.

---

## Known Limitations / PoC Caveats

- **Timezone:** All dates are computed in `America/New_York`. Works best when all users are in roughly the same timezone.
- **Manual data sync:** Sleep data only syncs when the user opens the app. Encourage friends to open it each morning.
- **Single tracker per user:** Switching devices requires a new account or manual DB update.
- **No bye tracking:** If there's an odd number of players, one user gets no match that night.
- **Native build required:** `react-native-health` doesn't work with Expo Go — you need a dev build or EAS build.

---

## API Reference

### Users
- `POST /api/users/register` — `{ id, username }`
- `GET /api/users/:id` — profile + today's match status
- `PUT /api/users/:id/push-token` — `{ expo_push_token }`

### Sleep
- `POST /api/sleep/sync` — post last night's sleep data (JWT-authenticated)
- `GET /api/sleep/check/:date` — check if sleep data already exists for a date (JWT-authenticated)

### Matches
- `GET /api/matches/today/:userId` — today's match with opponent info
- `GET /api/matches/history/:userId` — last 30 matches
- `POST /api/matches/create-daily` — admin only, requires `x-admin-secret` header

### Leaderboard
- `GET /api/leaderboard` — all users ranked by ELO

### Health
- `GET /health` — liveness check
