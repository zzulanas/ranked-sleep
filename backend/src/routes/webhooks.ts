import { Router, Request, Response } from 'express';
import { verifyTerraSignature, getNightOfDate } from '../services/terra';
import { extractSleepFields, calculateSleepScore } from '../services/scoring';
import { checkAndResolveMatches } from '../services/matching';
import { getSupabaseClient } from '../db/client';
import { TerraWebhookPayload } from '../types/terra';

export const webhooksRouter = Router();

// Raw body is attached by the raw body middleware in index.ts
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

webhooksRouter.post('/terra', async (req: RequestWithRawBody, res: Response) => {
  // Always return 200 to Terra — log and move on for unexpected shapes
  const respond = (status: number, message: string) => {
    console.log(`[webhook/terra] Responding ${status}: ${message}`);
    res.status(status).json({ message });
  };

  // Signature verification
  const webhookSecret = process.env.TERRA_WEBHOOK_SECRET;
  const signatureHeader = req.headers['terra-signature'] as string | undefined;

  if (webhookSecret && signatureHeader) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      console.warn('[webhook/terra] No raw body available for signature verification');
    } else if (!verifyTerraSignature(rawBody, signatureHeader, webhookSecret)) {
      console.warn('[webhook/terra] Invalid signature — rejecting request');
      return respond(401, 'Invalid signature');
    }
  } else if (webhookSecret && !signatureHeader) {
    console.warn('[webhook/terra] Webhook secret configured but no terra-signature header — possible replay attack');
    // Still process in dev; tighten in prod
  }

  const payload = req.body as TerraWebhookPayload;
  console.log(`[webhook/terra] Received type=${payload?.type} user=${payload?.user?.user_id}`);

  if (!payload || !payload.type) {
    return respond(200, 'Ignored — no payload type');
  }

  const db = getSupabaseClient();

  try {
    // ------------------------------------------------------------------
    // USER_AUTH: Terra user connected a device — store their terra_user_id
    // ------------------------------------------------------------------
    if (payload.type === 'USER_AUTH' || payload.type === 'AUTH') {
      const terraUserId = payload.user?.user_id;
      const referenceId = payload.reference_id; // This is the ID we pass when initiating auth

      console.log(`[webhook/terra] USER_AUTH: terra_user_id=${terraUserId}, reference_id=${referenceId}`);

      if (!terraUserId || !referenceId) {
        console.warn('[webhook/terra] USER_AUTH missing terra_user_id or reference_id');
        return respond(200, 'USER_AUTH missing fields');
      }

      // reference_id should be our internal user ID
      const { error } = await db
        .from('users')
        .update({
          terra_user_id: terraUserId,
          provider: payload.user.provider,
        })
        .eq('id', referenceId);

      if (error) {
        console.error('[webhook/terra] Failed to update terra_user_id:', error.message);
      } else {
        console.log(`[webhook/terra] Updated user ${referenceId} with terra_user_id=${terraUserId}`);
      }

      return respond(200, 'USER_AUTH processed');
    }

    // ------------------------------------------------------------------
    // SLEEP: New sleep data arrived
    // ------------------------------------------------------------------
    if (payload.type === 'SLEEP') {
      const sleepDataArray = payload.data;
      if (!sleepDataArray || sleepDataArray.length === 0) {
        console.warn('[webhook/terra] SLEEP payload has no data array');
        return respond(200, 'No sleep data');
      }

      const terraUserId = payload.user?.user_id;
      if (!terraUserId) {
        console.warn('[webhook/terra] SLEEP payload missing user.user_id');
        return respond(200, 'Missing user_id');
      }

      // Look up user by terra_user_id
      const { data: user, error: userError } = await db
        .from('users')
        .select('id, username')
        .eq('terra_user_id', terraUserId)
        .single();

      if (userError || !user) {
        console.warn(`[webhook/terra] No user found for terra_user_id=${terraUserId}`);
        return respond(200, 'User not found');
      }

      // Process each sleep record (usually just one, but handle multiple)
      for (const sleepData of sleepDataArray) {
        const bedtime = sleepData.metadata?.start_time;
        if (!bedtime) {
          console.warn('[webhook/terra] Sleep record missing metadata.start_time, skipping');
          continue;
        }

        const nightOfDate = getNightOfDate(bedtime);
        console.log(`[webhook/terra] Processing sleep for user=${user.username} date=${nightOfDate} bedtime=${bedtime}`);

        const fields = extractSleepFields(sleepData);
        const score = calculateSleepScore(fields);

        const upsertData = {
          user_id: user.id,
          date: nightOfDate,
          score,
          duration_seconds: fields.durationSeconds,
          efficiency: fields.efficiency,
          deep_sleep_seconds: fields.deepSleepSeconds,
          rem_sleep_seconds: fields.remSleepSeconds,
          hrv_avg: fields.hrvAvg,
          bedtime: fields.bedtime,
          wake_time: fields.wakeTime,
          provider: payload.user.provider,
          raw_payload: sleepData,
        };

        const { error: upsertError } = await db
          .from('sleep_records')
          .upsert(upsertData, { onConflict: 'user_id,date' });

        if (upsertError) {
          console.error(`[webhook/terra] Failed to upsert sleep record for ${user.username}:`, upsertError.message);
          continue;
        }

        console.log(`[webhook/terra] Upserted sleep record for ${user.username} on ${nightOfDate}: score=${score}`);

        // Trigger match resolution check
        try {
          await checkAndResolveMatches(nightOfDate);
        } catch (err) {
          console.error('[webhook/terra] Error during match resolution check:', err);
        }
      }

      return respond(200, 'SLEEP processed');
    }

    // All other event types: log and return 200
    console.log(`[webhook/terra] Unhandled event type: ${payload.type}`);
    return respond(200, `Unhandled type: ${payload.type}`);

  } catch (err) {
    console.error('[webhook/terra] Unexpected error:', err);
    // Always return 200 to Terra so it doesn't retry
    return respond(200, 'Internal error (logged)');
  }
});
