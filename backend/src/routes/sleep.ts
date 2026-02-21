import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../db/client';
import { calculateSleepScore, SleepInput } from '../services/scoring';
import { checkAndResolveMatches } from '../services/matching';

export const sleepRouter = Router();

// ---------------------------------------------------------------------------
// Auth middleware — verify Supabase JWT from Authorization header
// ---------------------------------------------------------------------------
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const db = getSupabaseClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  (req as Request & { userId: string }).userId = user.id;
  next();
}

// ---------------------------------------------------------------------------
// POST /api/sleep/sync
// Mobile app posts sleep data pulled from HealthKit / Health Connect on morning open.
// ---------------------------------------------------------------------------
sleepRouter.post('/sync', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const {
    date,
    duration_seconds,
    efficiency,
    deep_sleep_seconds,
    rem_sleep_seconds,
    hrv_avg,
    bedtime,
    wake_time,
    provider,
  } = req.body as {
    date: string;
    duration_seconds: number | null;
    efficiency: number | null;
    deep_sleep_seconds: number | null;
    rem_sleep_seconds: number | null;
    hrv_avg: number | null;
    bedtime: string | null;
    wake_time: string | null;
    provider: string;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  }

  const scoreInput: SleepInput = {
    duration_seconds,
    efficiency,
    deep_sleep_seconds,
    rem_sleep_seconds,
    hrv_avg,
    total_sleep_seconds: duration_seconds,
  };

  const score = calculateSleepScore(scoreInput);

  const db = getSupabaseClient();

  const { error: upsertError } = await db
    .from('sleep_records')
    .upsert({
      user_id: userId,
      date,
      score,
      duration_seconds,
      efficiency,
      deep_sleep_seconds,
      rem_sleep_seconds,
      hrv_avg,
      bedtime,
      wake_time,
      provider,
    }, { onConflict: 'user_id,date' });

  if (upsertError) {
    console.error('[sleep] Failed to upsert sleep record:', upsertError.message);
    return res.status(500).json({ error: 'Failed to save sleep data' });
  }

  // Update the user's provider if not already set
  await db
    .from('users')
    .update({ provider })
    .eq('id', userId)
    .is('provider', null);

  console.log(`[sleep] Synced for user ${userId} on ${date}: score=${score}`);

  try {
    await checkAndResolveMatches(date);
  } catch (err) {
    console.error('[sleep] Error during match resolution check:', err);
  }

  return res.json({ success: true, score, date });
});

// ---------------------------------------------------------------------------
// GET /api/sleep/check/:date
// Returns whether the authed user already has a sleep record for that date.
// Used by mobile to avoid re-syncing on every app open.
// ---------------------------------------------------------------------------
sleepRouter.get('/check/:date', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const { date } = req.params;

  const db = getSupabaseClient();
  const { data } = await db
    .from('sleep_records')
    .select('id, score')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  return res.json({ exists: !!data, score: data?.score ?? null });
});
