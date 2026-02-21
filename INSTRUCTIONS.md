# Ranked Sleep — Claude Code Build Instructions

## Overview

Build a mobile app called **Ranked Sleep** where users compete in nightly 1v1 sleep battles. Sleep data is pulled via the Terra API (which normalizes data from Garmin, Apple Health, Oura, Fitbit, etc.), scored with a weighted algorithm, and used to determine match winners. Users have an ELO rating that updates after each match.

This is a PoC for ~10-20 friends. Prioritize working over polished. Don't over-engineer.

-----

## Monorepo Structure

```
ranked-sleep/
├── INSTRUCTIONS.md
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── webhooks.ts       # Terra webhook receiver
│   │   │   ├── matches.ts        # Match data endpoints
│   │   │   ├── leaderboard.ts    # Leaderboard endpoint
│   │   │   └── users.ts          # User registration/profile
│   │   ├── services/
│   │   │   ├── scoring.ts        # Sleep score calculation
│   │   │   ├── matching.ts       # Match creation + resolution
│   │   │   ├── elo.ts            # ELO rating logic
│   │   │   └── terra.ts          # Terra API helpers
│   │   ├── db/
│   │   │   └── client.ts         # Supabase client singleton
│   │   └── types/
│   │       └── terra.ts          # Terra webhook payload types
├── mobile/
│   ├── package.json
│   ├── app.json
│   ├── .env.example
│   ├── App.tsx
│   └── src/
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── HomeScreen.tsx        # Today's match + score
│       │   ├── LeaderboardScreen.tsx
│       │   ├── ProfileScreen.tsx
│       │   └── ConnectTrackerScreen.tsx
│       ├── components/
│       │   ├── MatchCard.tsx         # Shows 1v1 result
│       │   ├── ScoreGauge.tsx        # Visual sleep score
│       │   └── RankBadge.tsx         # ELO tier badge
│       ├── navigation/
│       │   └── AppNavigator.tsx
│       ├── services/
│       │   ├── api.ts                # Backend API client
│       │   └── auth.ts               # Supabase auth helpers
│       ├── utils/
│       │   └── elo.ts                # Tier helper (shared with backend logic)
│       └── hooks/
│           └── useMatch.ts
└── supabase/
    └── schema.sql
```

-----

## Tech Stack

- **Mobile:** React Native via Expo (SDK 51+), TypeScript
- **Backend:** Node.js + Express + TypeScript, running on port 3000
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **Sleep Data:** Terra API (https://tryterra.co) — unified API for Garmin, Apple Health, Oura, Fitbit
- **Push Notifications:** Expo Notifications

-----

## What's Done

All files have been scaffolded. The following still needs your attention:

### Before the app can run:
1. **Supabase project** — create one at supabase.com, paste `supabase/schema.sql` into SQL Editor
2. **Terra account** — create at tryterra.co, get API key + Dev ID + webhook secret
3. **backend/.env** — copy from `.env.example` and fill in all values
4. **mobile/.env** — copy from `.env.example` and fill in Supabase + API URL
5. **Terra webhook URL** — set in Terra dashboard to `https://your-backend/webhooks/terra`
6. **`EXPO_PUBLIC_TERRA_DEV_ID`** — add to `mobile/.env` (not in .env.example, add manually)

### To install dependencies:
```bash
cd backend && npm install
cd mobile && npm install
```

### To run:
```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — mobile
cd mobile && npx expo start
```
