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

## 2. Terra

- [ ] Create a developer account at https://tryterra.co
- [ ] Create an application in the Terra dashboard
- [ ] Copy **Dev ID** → `TERRA_DEV_ID` / `EXPO_PUBLIC_TERRA_DEV_ID`
- [ ] Copy **API Key** → `TERRA_API_KEY`
- [ ] Set webhook URL to `https://your-backend/webhooks/terra`
- [ ] Copy **Webhook Secret** → `TERRA_WEBHOOK_SECRET`
- [ ] Subscribe to events: **SLEEP** and **USER_AUTH**

---

## 3. Backend `.env`

```bash
cp backend/.env.example backend/.env
```

Fill in every value:

```
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
TERRA_API_KEY=
TERRA_DEV_ID=
TERRA_WEBHOOK_SECRET=
MATCH_RESOLUTION_CUTOFF_HOUR=14
ADMIN_SECRET=           # make something up, you'll use this to create daily matches
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
EXPO_PUBLIC_TERRA_DEV_ID=                     # same Dev ID from step 2
```

> **Note:** `EXPO_PUBLIC_TERRA_DEV_ID` isn't in `.env.example` — add it manually.

---

## 5. Install dependencies

```bash
cd backend && npm install
cd ../mobile && npm install
```

---

## 6. Expose the backend publicly (for Terra webhooks)

Terra needs to reach your backend to deliver sleep data. For local dev, use ngrok:

```bash
# Install ngrok if needed: https://ngrok.com
ngrok http 3000
# Copy the https URL (e.g. https://abc123.ngrok.io)
# Set this as your Terra webhook URL: https://abc123.ngrok.io/webhooks/terra
```

---

## 7. Run it

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd mobile && npx expo start
# Scan QR with Expo Go on your phone
```

---

## 8. Create daily matches (every evening)

Run this once per night before people go to sleep:

```bash
curl -X POST http://localhost:3000/api/matches/create-daily \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d "{\"date\": \"$(date +%Y-%m-%d)\"}"
```

Save that as a shell alias or stick it in a cron job at ~9pm when you're ready.

---

## 9. Onboard friends

For each person:
1. They sign up in the app with email + password
2. They tap **Connect Sleep Tracker** and link their device via the Terra widget
3. Backend receives the `USER_AUTH` webhook and stores their `terra_user_id`
4. They're in the pool for nightly matches

---

## Nice-to-haves (post-PoC)

- [ ] Automate daily match creation with a cron job
- [ ] Set up a persistent backend host (Railway, Fly.io, Render) so you don't need ngrok
- [ ] Add match history chart to Profile screen
- [ ] Handle Terra test webhooks to validate scoring without real sleep data
- [ ] Push notification deep link into the match result on tap
