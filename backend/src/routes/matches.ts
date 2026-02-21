import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../db/client';
import { createDailyMatches } from '../services/matching';
import { getTodayNY } from '../services/terra';

export const matchesRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/matches/today/:userId
// ---------------------------------------------------------------------------
matchesRouter.get('/today/:userId', async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const { userId } = req.params;
  const today = getTodayNY();

  const { data: match, error } = await db
    .from('matches')
    .select(`
      *,
      user_a:users!matches_user_a_id_fkey(id, username, elo_rating),
      user_b:users!matches_user_b_id_fkey(id, username, elo_rating),
      winner:users!matches_winner_id_fkey(id, username)
    `)
    .eq('date', today)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('[matches] Error fetching today match:', error.message);
    return res.status(500).json({ error: 'Failed to fetch match' });
  }

  if (!match) {
    return res.json({ match: null });
  }

  return res.json({ match });
});

// ---------------------------------------------------------------------------
// GET /api/matches/history/:userId
// ---------------------------------------------------------------------------
matchesRouter.get('/history/:userId', async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const { userId } = req.params;

  const { data: matches, error } = await db
    .from('matches')
    .select(`
      *,
      user_a:users!matches_user_a_id_fkey(id, username, elo_rating),
      user_b:users!matches_user_b_id_fkey(id, username, elo_rating),
      winner:users!matches_winner_id_fkey(id, username)
    `)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('date', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[matches] Error fetching history:', error.message);
    return res.status(500).json({ error: 'Failed to fetch match history' });
  }

  return res.json({ matches: matches ?? [] });
});

// ---------------------------------------------------------------------------
// POST /api/matches/create-daily  (admin only)
// ---------------------------------------------------------------------------
matchesRouter.post('/create-daily', async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'];

  if (!adminSecret || providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { date } = req.body as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Body must include date in YYYY-MM-DD format' });
  }

  try {
    await createDailyMatches(date);
    return res.json({ message: `Matches created for ${date}` });
  } catch (err) {
    console.error('[matches] Error creating daily matches:', err);
    return res.status(500).json({ error: 'Failed to create matches' });
  }
});
