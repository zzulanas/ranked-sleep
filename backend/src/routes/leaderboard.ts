import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../db/client';
import { eloTier } from '../services/elo';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', async (_req: Request, res: Response) => {
  const db = getSupabaseClient();

  const { data: users, error } = await db
    .from('users')
    .select('id, username, elo_rating, wins, losses, provider')
    .order('elo_rating', { ascending: false });

  if (error) {
    console.error('[leaderboard] Failed to fetch users:', error.message);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }

  const leaderboard = (users ?? []).map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    elo_rating: user.elo_rating,
    wins: user.wins,
    losses: user.losses,
    provider: user.provider,
    tier: eloTier(user.elo_rating),
  }));

  return res.json({ leaderboard });
});
