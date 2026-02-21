// Backend API client
import { getCurrentSession } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getCurrentSession();
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  username: string;
  elo_rating: number;
  wins: number;
  losses: number;
  provider: string | null;  // set after first sleep sync; null = health not yet connected
  health_connected: boolean;
  tier: string;
  created_at: string;
}

export interface TodayMatchStatus {
  id: string;
  status: 'pending' | 'resolved' | 'voided';
  user_a_id: string;
  user_b_id: string;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
}

export async function registerUser(id: string, username: string): Promise<UserProfile> {
  const data = await request<{ user: UserProfile }>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ id, username }),
  });
  return data.user;
}

export async function getUser(id: string): Promise<{ user: UserProfile; today_match: TodayMatchStatus | null }> {
  return request<{ user: UserProfile; today_match: TodayMatchStatus | null }>(`/api/users/${id}`);
}

export async function updatePushToken(userId: string, token: string): Promise<void> {
  await request(`/api/users/${userId}/push-token`, {
    method: 'PUT',
    body: JSON.stringify({ expo_push_token: token }),
  });
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export interface MatchPlayer {
  id: string;
  username: string;
  elo_rating: number;
}

export interface Match {
  id: string;
  date: string;
  status: 'pending' | 'resolved' | 'voided';
  user_a_id: string;
  user_b_id: string;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  elo_delta: number | null;
  resolved_at: string | null;
  created_at: string;
  user_a: MatchPlayer;
  user_b: MatchPlayer;
  winner: MatchPlayer | null;
}

export async function getTodayMatch(userId: string): Promise<Match | null> {
  const data = await request<{ match: Match | null }>(`/api/matches/today/${userId}`);
  return data.match;
}

export async function getMatchHistory(userId: string): Promise<Match[]> {
  const data = await request<{ matches: Match[] }>(`/api/matches/history/${userId}`);
  return data.matches;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  elo_rating: number;
  wins: number;
  losses: number;
  provider: string | null;
  tier: string;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await request<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard');
  return data.leaderboard;
}

// ---------------------------------------------------------------------------
// Sleep sync
// ---------------------------------------------------------------------------

import { NormalizedSleepData } from './healthData';

export async function syncSleep(data: NormalizedSleepData): Promise<{ score: number; date: string }> {
  return request<{ success: boolean; score: number; date: string }>('/api/sleep/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function checkSleepExists(date: string): Promise<boolean> {
  const data = await request<{ exists: boolean }>(`/api/sleep/check/${date}`);
  return data.exists;
}
