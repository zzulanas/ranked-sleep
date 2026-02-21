# Ranked Sleep 🌙

Compete in nightly 1v1 sleep battles with your friends. Sleep data is pulled from your wearable via the Terra API, scored with a weighted algorithm, and used to determine match winners — with ELO ratings tracking your progress over time.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo`)
- A [Supabase](https://supabase.com) account (free tier is fine)
- A [Terra](https://tryterra.co) account (developer account)

---

## 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql`, then run it
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (keep this secret — backend only)

---

## 2. Terra Setup

1. Create an account at https://tryterra.co
2. Go to your dashboard and create an application
3. Copy your **Dev ID** and **API Key**
4. Set your webhook URL to: `https://your-backend-domain/webhooks/terra`
5. Copy your **Webhook Secret** from the webhook settings page
6. Subscribe to: `SLEEP`, `USER_AUTH` webhook events

---

## 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in all values in .env
npm run dev
```

The backend runs on port 3000 by default.

**Required environment variables:**
```
PORT=3000
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
TERRA_API_KEY=...
TERRA_DEV_ID=...
TERRA_WEBHOOK_SECRET=...
MATCH_RESOLUTION_CUTOFF_HOUR=14    # 2pm ET — matches not resolved by this hour are voided
ADMIN_SECRET=pick-something-random  # used for the /api/matches/create-daily endpoint
```

---

## 4. Mobile Setup

```bash
cd mobile
npm install
cp .env.example .env
# Fill in Supabase URL + anon key, and your backend URL
npx expo start
```

Scan the QR code with Expo Go on your phone.

**Required environment variables:**
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://your-local-ip:3000   # use your machine's LAN IP, not localhost
EXPO_PUBLIC_TERRA_DEV_ID=...
```

> **Note:** When running on a physical device, `localhost` won't work. Use your machine's LAN IP (e.g. `192.168.1.x`).

---

## 5. Daily Match Creation

Matches are created manually once per evening (before people go to sleep). Run this curl command each night:

```bash
curl -X POST http://localhost:3000/api/matches/create-daily \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"date": "2024-01-15"}'
```

Or set up a cron job:
```bash
# Run at 9pm ET every day
0 21 * * * curl -X POST http://localhost:3000/api/matches/create-daily \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d "{\"date\": \"$(date +%Y-%m-%d)\"}"
```

Match resolution happens automatically when both players sync their sleep data. Any matches still pending after 2pm the following day are voided.

---

## 6. How It Works

1. **Evening:** Admin calls `/api/matches/create-daily` → users are randomly paired into 1v1 matches
2. **Users sleep** with their trackers
3. **Morning:** Terra sends a `SLEEP` webhook to the backend for each user
4. **Backend** scores the sleep (0–100) and checks if both players in a match have synced
5. **Match resolves:** winner is determined by score, ELO updates, push notifications sent
6. **By 2pm:** any unresolved matches are voided

---

## Scoring Algorithm

Sleep score is computed from up to 5 components. Missing fields are gracefully excluded and weights are renormalized:

| Component | Base Weight | Target |
|-----------|-------------|--------|
| Duration | 35% | 8 hours = 100pts |
| Efficiency | 25% | 90%+ = 100pts |
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

- **Timezone:** All dates are computed in `America/New_York`. All users must be in roughly the same timezone for scores to compare fairly.
- **No CI/CD:** Run locally. For the PoC you'll need the backend accessible from the internet (ngrok works great) so Terra can deliver webhooks.
- **Single provider per user:** A user connects one sleep tracker. Switching devices requires manually updating the `terra_user_id` in the database.
- **No bye tracking:** Users with no partner (odd number of players) simply get no match that night.
- **Manual match creation:** Someone has to run the curl command each evening. Automate with cron when ready.
- **Terra test data:** Terra provides a test endpoint to simulate webhook deliveries. Use it during development before you have real sleep data.

---

## API Reference

### Users
- `POST /api/users/register` — `{ id, username }`
- `GET /api/users/:id` — profile + today's match status
- `PUT /api/users/:id/push-token` — `{ expo_push_token }`

### Matches
- `GET /api/matches/today/:userId` — today's match with opponent info
- `GET /api/matches/history/:userId` — last 30 matches
- `POST /api/matches/create-daily` — admin only, `x-admin-secret` header required

### Leaderboard
- `GET /api/leaderboard` — all users ranked by ELO

### Webhooks
- `POST /webhooks/terra` — Terra webhook receiver (SLEEP, USER_AUTH events)

### Health
- `GET /health` — liveness check
