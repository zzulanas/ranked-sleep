-- =============================================================================
-- Ranked Sleep — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run it.
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- Users table (extends Supabase auth.users)
-- =============================================================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  terra_user_id text unique,
  provider text,                        -- 'GARMIN', 'APPLE', 'OURA', 'FITBIT', etc.
  elo_rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  expo_push_token text,
  created_at timestamptz default now()
);

-- =============================================================================
-- Sleep records — one per user per night
-- =============================================================================
create table public.sleep_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  date date not null,                   -- the calendar date of the "night of" (e.g. Monday night → "2024-01-15")
  score numeric(5,2),                   -- 0-100 computed score
  duration_seconds integer,
  efficiency numeric(4,3),              -- 0.0 - 1.0
  deep_sleep_seconds integer,
  rem_sleep_seconds integer,
  hrv_avg numeric(6,2),                 -- in milliseconds
  bedtime timestamptz,
  wake_time timestamptz,
  provider text,
  raw_payload jsonb,                    -- full Terra sleep payload, for debugging
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- =============================================================================
-- Matches — one per pair per night
-- =============================================================================
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  user_a_id uuid references public.users(id) not null,
  user_b_id uuid references public.users(id) not null,
  score_a numeric(5,2),
  score_b numeric(5,2),
  winner_id uuid references public.users(id),
  elo_delta integer,                    -- points transferred from loser to winner
  status text not null default 'pending', -- 'pending' | 'resolved' | 'voided'
  resolved_at timestamptz,
  created_at timestamptz default now(),
  unique(date, user_a_id, user_b_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index on public.sleep_records(user_id, date);
create index on public.sleep_records(date);
create index on public.matches(date);
create index on public.matches(user_a_id);
create index on public.matches(user_b_id);
create index on public.users(terra_user_id);
create index on public.matches(status);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users enable row level security;
alter table public.sleep_records enable row level security;
alter table public.matches enable row level security;

-- All authenticated users can view all profiles (it's a leaderboard app)
create policy "Users can view all profiles"
  on public.users for select
  using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- New users can insert their own profile (during registration)
create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- All authenticated users can view all sleep records (for match display)
create policy "Users can view all sleep records"
  on public.sleep_records for select
  using (true);

-- All authenticated users can view all matches
create policy "Users can view all matches"
  on public.matches for select
  using (true);

-- Service role bypasses RLS — the backend uses service role key, so no additional
-- policies needed for backend writes. These policies cover the mobile client.

-- =============================================================================
-- Helpful view: leaderboard
-- =============================================================================
create or replace view public.leaderboard as
  select
    row_number() over (order by elo_rating desc) as rank,
    id,
    username,
    elo_rating,
    wins,
    losses,
    provider,
    case
      when elo_rating < 900 then 'Bronze'
      when elo_rating < 1100 then 'Silver'
      when elo_rating < 1300 then 'Gold'
      when elo_rating < 1500 then 'Platinum'
      else 'Diamond'
    end as tier
  from public.users
  order by elo_rating desc;
