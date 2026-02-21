import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../db/client';
// Get today's date in America/New_York timezone
function getTodayNY(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
import { eloTier } from '../services/elo';

export const usersRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/users/register
// ---------------------------------------------------------------------------
usersRouter.post('/register', async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const { id, username } = req.body as { id?: string; username?: string };

  if (!id || !username) {
    return res.status(400).json({ error: 'id and username are required' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters or underscores' });
  }

  const { data, error } = await db
    .from('users')
    .insert({ id, username })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('[users] Register error:', error.message);
    return res.status(500).json({ error: 'Failed to create user' });
  }

  return res.status(201).json({ user: data });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------
usersRouter.get('/:id', async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const { id } = req.params;
  const today = getTodayNY();

  const { data: user, error } = await db
    .from('users')
    .select('id, username, elo_rating, wins, losses, provider, created_at')
    .eq('id', id)
    .single();

  if (error || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Fetch today's match status
  const { data: match } = await db
    .from('matches')
    .select('id, status, user_a_id, user_b_id, score_a, score_b, winner_id')
    .eq('date', today)
    .or(`user_a_id.eq.${id},user_b_id.eq.${id}`)
    .single();

  return res.json({
    user: {
      ...user,
      tier: eloTier(user.elo_rating),
      health_connected: !!user.provider,
    },
    today_match: match ?? null,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:id/push-token
// ---------------------------------------------------------------------------
usersRouter.put('/:id/push-token', async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const { id } = req.params;
  const { expo_push_token } = req.body as { expo_push_token?: string };

  if (!expo_push_token) {
    return res.status(400).json({ error: 'expo_push_token is required' });
  }

  const { error } = await db
    .from('users')
    .update({ expo_push_token })
    .eq('id', id);

  if (error) {
    console.error('[users] Failed to update push token:', error.message);
    return res.status(500).json({ error: 'Failed to update push token' });
  }

  return res.json({ message: 'Push token updated' });
});
