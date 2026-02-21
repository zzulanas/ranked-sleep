import { getSupabaseClient } from '../db/client';
import { calculateSleepScore, extractSleepFields } from './scoring';
import { calculateElo } from './elo';
import { getCurrentHourNY } from './terra';
import { TerraSleepData } from '../types/terra';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TIMEZONE = 'America/New_York';

// ---------------------------------------------------------------------------
// Match creation
// ---------------------------------------------------------------------------

/**
 * Create daily 1v1 matches for all users who don't have a match on `date`.
 * Users are shuffled and paired sequentially. Odd user out gets a bye.
 */
export async function createDailyMatches(date: string): Promise<void> {
  const db = getSupabaseClient();
  console.log(`[matching] Creating daily matches for ${date}`);

  // Get all user IDs
  const { data: users, error: usersError } = await db
    .from('users')
    .select('id');

  if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);
  if (!users || users.length < 2) {
    console.log('[matching] Fewer than 2 users — no matches to create');
    return;
  }

  // Get users who already have a match today
  const { data: existingMatches, error: matchError } = await db
    .from('matches')
    .select('user_a_id, user_b_id')
    .eq('date', date);

  if (matchError) throw new Error(`Failed to fetch existing matches: ${matchError.message}`);

  const matchedUserIds = new Set<string>();
  for (const m of existingMatches ?? []) {
    matchedUserIds.add(m.user_a_id);
    matchedUserIds.add(m.user_b_id);
  }

  const eligibleUsers = users.filter(u => !matchedUserIds.has(u.id));
  console.log(`[matching] ${eligibleUsers.length} eligible users for matching`);

  if (eligibleUsers.length < 2) {
    console.log('[matching] Not enough eligible users to create matches');
    return;
  }

  // Shuffle
  const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);

  // Pair up
  const matchRows = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    matchRows.push({
      date,
      user_a_id: shuffled[i].id,
      user_b_id: shuffled[i + 1].id,
      status: 'pending',
    });
  }

  if (shuffled.length % 2 !== 0) {
    console.log(`[matching] User ${shuffled[shuffled.length - 1].id} gets a bye tonight`);
  }

  const { error: insertError } = await db.from('matches').insert(matchRows);
  if (insertError) throw new Error(`Failed to insert matches: ${insertError.message}`);

  console.log(`[matching] Created ${matchRows.length} matches for ${date}`);
}

// ---------------------------------------------------------------------------
// Match resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single pending match: score both sides, update ELO, send push notifs.
 */
export async function resolveMatch(matchId: string): Promise<void> {
  const db = getSupabaseClient();
  console.log(`[matching] Resolving match ${matchId}`);

  const { data: match, error: matchError } = await db
    .from('matches')
    .select('*, user_a:users!matches_user_a_id_fkey(*), user_b:users!matches_user_b_id_fkey(*)')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    throw new Error(`Match ${matchId} not found: ${matchError?.message}`);
  }

  if (match.status !== 'pending') {
    console.log(`[matching] Match ${matchId} is already ${match.status}, skipping`);
    return;
  }

  // Fetch sleep records
  const { data: records, error: recordError } = await db
    .from('sleep_records')
    .select('*')
    .in('user_id', [match.user_a_id, match.user_b_id])
    .eq('date', match.date);

  if (recordError) throw new Error(`Failed to fetch sleep records: ${recordError.message}`);

  const recordA = records?.find(r => r.user_id === match.user_a_id);
  const recordB = records?.find(r => r.user_id === match.user_b_id);

  if (!recordA || !recordB) {
    console.log(`[matching] Match ${matchId} waiting on sleep records (A:${!!recordA}, B:${!!recordB})`);
    return;
  }

  // Use stored scores if available, otherwise calculate from raw payload
  let scoreA: number = recordA.score;
  let scoreB: number = recordB.score;

  if (scoreA == null && recordA.raw_payload) {
    scoreA = calculateSleepScore(extractSleepFields(recordA.raw_payload as TerraSleepData));
    await db.from('sleep_records').update({ score: scoreA }).eq('id', recordA.id);
  }
  if (scoreB == null && recordB.raw_payload) {
    scoreB = calculateSleepScore(extractSleepFields(recordB.raw_payload as TerraSleepData));
    await db.from('sleep_records').update({ score: scoreB }).eq('id', recordB.id);
  }

  const winnerId = scoreA >= scoreB ? match.user_a_id : match.user_b_id;
  const winner: 'a' | 'b' = scoreA >= scoreB ? 'a' : 'b';

  const userA = match.user_a;
  const userB = match.user_b;

  const { newRatingA, newRatingB, delta } = calculateElo(
    userA.elo_rating,
    userB.elo_rating,
    winner
  );

  console.log(`[matching] Match ${matchId}: A=${scoreA} vs B=${scoreB}, winner=${winner}, delta=${delta}`);

  // Update match
  const { error: updateMatchError } = await db
    .from('matches')
    .update({
      score_a: scoreA,
      score_b: scoreB,
      winner_id: winnerId,
      elo_delta: delta,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', matchId);

  if (updateMatchError) throw new Error(`Failed to update match: ${updateMatchError.message}`);

  // Update ELO ratings and win/loss counts
  await Promise.all([
    db.from('users').update({
      elo_rating: newRatingA,
      wins: winner === 'a' ? userA.wins + 1 : userA.wins,
      losses: winner === 'b' ? userA.losses + 1 : userA.losses,
    }).eq('id', match.user_a_id),

    db.from('users').update({
      elo_rating: newRatingB,
      wins: winner === 'b' ? userB.wins + 1 : userB.wins,
      losses: winner === 'a' ? userB.losses + 1 : userB.losses,
    }).eq('id', match.user_b_id),
  ]);

  console.log(`[matching] ELO updated: ${userA.username} ${userA.elo_rating}→${newRatingA}, ${userB.username} ${userB.elo_rating}→${newRatingB}`);

  // Send push notifications
  await sendMatchResultNotifications({
    userA: { ...userA, newRating: newRatingA },
    userB: { ...userB, newRating: newRatingB },
    scoreA,
    scoreB,
    winner,
    delta,
  });
}

// ---------------------------------------------------------------------------
// Batch resolution / cutoff check
// ---------------------------------------------------------------------------

/**
 * Check all pending matches for `date` and resolve any where both users have sleep records.
 * If it's past MATCH_RESOLUTION_CUTOFF_HOUR, void any still-pending matches.
 */
export async function checkAndResolveMatches(date: string): Promise<void> {
  const db = getSupabaseClient();
  const cutoffHour = parseInt(process.env.MATCH_RESOLUTION_CUTOFF_HOUR ?? '14', 10);
  const currentHour = getCurrentHourNY();

  console.log(`[matching] Checking matches for ${date} (currentHour=${currentHour}, cutoff=${cutoffHour})`);

  const { data: pendingMatches, error } = await db
    .from('matches')
    .select('id, user_a_id, user_b_id')
    .eq('date', date)
    .eq('status', 'pending');

  if (error) {
    console.error('[matching] Failed to fetch pending matches:', error.message);
    return;
  }

  if (!pendingMatches || pendingMatches.length === 0) {
    console.log('[matching] No pending matches to check');
    return;
  }

  // Get all sleep records for this date
  const userIds = [...new Set(pendingMatches.flatMap(m => [m.user_a_id, m.user_b_id]))];
  const { data: records } = await db
    .from('sleep_records')
    .select('user_id')
    .eq('date', date)
    .in('user_id', userIds);

  const usersWithRecords = new Set((records ?? []).map(r => r.user_id));

  for (const match of pendingMatches) {
    const hasA = usersWithRecords.has(match.user_a_id);
    const hasB = usersWithRecords.has(match.user_b_id);

    if (hasA && hasB) {
      try {
        await resolveMatch(match.id);
      } catch (err) {
        console.error(`[matching] Failed to resolve match ${match.id}:`, err);
      }
    } else if (currentHour >= cutoffHour) {
      // Past cutoff — void the match
      console.log(`[matching] Voiding match ${match.id} (past cutoff, missing records: A=${!hasA}, B=${!hasB})`);
      await db
        .from('matches')
        .update({ status: 'voided', resolved_at: new Date().toISOString() })
        .eq('id', match.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

interface NotifArgs {
  userA: { expo_push_token?: string; username: string; newRating: number };
  userB: { expo_push_token?: string; username: string; newRating: number };
  scoreA: number;
  scoreB: number;
  winner: 'a' | 'b';
  delta: number;
}

async function sendMatchResultNotifications(args: NotifArgs): Promise<void> {
  const { userA, userB, scoreA, scoreB, winner, delta } = args;
  const messages = [];

  if (userA.expo_push_token) {
    const won = winner === 'a';
    messages.push({
      to: userA.expo_push_token,
      title: won ? '🏆 You won last night!' : '😴 You lost last night.',
      body: won
        ? `Your score: ${scoreA} vs ${scoreB}. +${delta} ELO (now ${userA.newRating})`
        : `Your score: ${scoreA} vs ${scoreB}. -${delta} ELO (now ${userA.newRating}). Get em tonight.`,
      data: { type: 'match_result' },
    });
  }

  if (userB.expo_push_token) {
    const won = winner === 'b';
    messages.push({
      to: userB.expo_push_token,
      title: won ? '🏆 You won last night!' : '😴 You lost last night.',
      body: won
        ? `Your score: ${scoreB} vs ${scoreA}. +${delta} ELO (now ${userB.newRating})`
        : `Your score: ${scoreB} vs ${scoreA}. -${delta} ELO (now ${userB.newRating}). Get em tonight.`,
      data: { type: 'match_result' },
    });
  }

  if (messages.length === 0) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json();
    console.log('[matching] Push notification response:', JSON.stringify(json));
  } catch (err) {
    console.error('[matching] Failed to send push notifications:', err);
  }
}
