import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { matchesRouter } from './routes/matches';
import { leaderboardRouter } from './routes/leaderboard';
import { usersRouter } from './routes/users';
import { sleepRouter } from './routes/sleep';
import { createDailyMatches } from './services/matching';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/users', usersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/sleep', sleepRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------

// Create daily matches at 9pm America/New_York every night.
// Skip in test environment to avoid dangling timers.
const MATCH_CRON = process.env.MATCH_CRON_SCHEDULE ?? '0 21 * * *';

if (process.env.NODE_ENV !== 'test') cron.schedule(MATCH_CRON, async () => {
  // Get today's date in ET
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  console.log(`[cron] Triggering daily match creation for ${date}`);
  try {
    await createDailyMatches(date);
    console.log(`[cron] Daily match creation complete for ${date}`);
  } catch (err) {
    console.error(`[cron] Daily match creation failed for ${date}:`, err);
  }
}, {
  timezone: 'America/New_York',
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[server] Ranked Sleep backend running on port ${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`[server] Supabase URL: ${process.env.SUPABASE_URL ? 'configured' : 'MISSING'}`);
  console.log(`[server] Daily match cron: ${MATCH_CRON} (America/New_York)`);
});

export default app;
