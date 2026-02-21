import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { webhooksRouter } from './routes/webhooks';
import { matchesRouter } from './routes/matches';
import { leaderboardRouter } from './routes/leaderboard';
import { usersRouter } from './routes/users';
import { createDailyMatches } from './services/matching';
import { getTodayNY } from './services/terra';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ---------------------------------------------------------------------------
// Raw body capture for Terra webhook signature verification
// Must be registered BEFORE express.json() so we can capture the raw buffer
// ---------------------------------------------------------------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path === '/webhooks/terra') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      next();
    });
  } else {
    next();
  }
});

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
app.use('/webhooks', webhooksRouter);
app.use('/api/users', usersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/leaderboard', leaderboardRouter);

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
// node-cron runs in server time — the VM should be set to UTC, so 9pm ET = 1am UTC (EST) or 0am UTC (EDT).
// We let getTodayNY() determine the correct date regardless of server timezone.
//
// Cron expression: "0 21 * * *" = every day at 21:00 server local time.
// If your VM is UTC, change to "0 2 * * *" for 9pm ET (EST, UTC-5) or "0 1 * * *" (EDT, UTC-4).
// Easiest fix: set TZ=America/New_York in your .env and this expression works as-is.
const MATCH_CRON = process.env.MATCH_CRON_SCHEDULE ?? '0 21 * * *';

cron.schedule(MATCH_CRON, async () => {
  const date = getTodayNY();
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
  console.log(`[server] Terra API Key: ${process.env.TERRA_API_KEY ? 'configured' : 'MISSING'}`);
  console.log(`[server] Daily match cron: ${MATCH_CRON} (America/New_York)`);
});

export default app;
