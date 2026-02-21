import { TerraSleepData, ExtractedSleepFields } from '../types/terra';

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

/**
 * Pull all relevant scoring fields out of a Terra sleep payload into a flat object.
 * Terra docs: https://docs.tryterra.co/reference/data-models
 */
export function extractSleepFields(data: TerraSleepData): ExtractedSleepFields {
  const dur = data.sleep_durations_data;
  const hr = data.heart_rate_data;
  const meta = data.metadata;

  const totalSleepSeconds = dur?.asleep?.duration_asleep_state_seconds ?? null;
  const deepSleepSeconds = dur?.asleep?.duration_deep_sleep_state_seconds ?? null;
  const remSleepSeconds = dur?.asleep?.duration_REM_sleep_state_seconds ?? null;
  const efficiency = dur?.sleep_efficiency ?? null;

  // HRV: prefer RMSSD average, fall back to SDNN, then heart_rate_data summary hrv
  const hrvAvg =
    hr?.hrv?.summary?.avg_rmssd ??
    hr?.hrv?.summary?.avg_sdnn ??
    hr?.summary?.avg_hrv_rmssd ??
    hr?.summary?.avg_hrv_sdnn ??
    null;

  // Duration: time between bedtime and wake
  let durationSeconds: number | null = null;
  if (meta.start_time && meta.end_time) {
    const start = new Date(meta.start_time).getTime();
    const end = new Date(meta.end_time).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      durationSeconds = Math.round((end - start) / 1000);
    }
  }

  // Prefer explicit asleep duration if available (more accurate than total time in bed)
  const finalDuration = totalSleepSeconds ?? durationSeconds;

  return {
    durationSeconds: finalDuration,
    efficiency,
    deepSleepSeconds,
    remSleepSeconds,
    totalSleepSeconds,
    hrvAvg,
    bedtime: meta.start_time ?? null,
    wakeTime: meta.end_time ?? null,
  };
}

// ---------------------------------------------------------------------------
// Individual component scorers (all return 0–100)
// ---------------------------------------------------------------------------

function scoreDuration(seconds: number): number {
  const hours = seconds / 3600;

  if (hours >= 8 && hours <= 8.5) return 100;
  if (hours >= 7 && hours < 8) {
    // Linear from 70 at 7h to 100 at 8h
    return 70 + (hours - 7) * 30;
  }
  if (hours > 8.5 && hours <= 9) {
    // Linear from 100 at 8.5h down to 90 at 9h
    return 100 - (hours - 8.5) * 20;
  }
  if (hours > 9) {
    // Diminishing returns beyond 9h; drop to 60 at 11h
    return Math.max(60, 90 - (hours - 9) * 15);
  }
  if (hours >= 6 && hours < 7) {
    // Linear from 20 at 6h to 70 at 7h
    return 20 + (hours - 6) * 50;
  }
  // < 6 hours
  return Math.max(0, hours * (20 / 6));
}

function scoreEfficiency(efficiency: number): number {
  // efficiency is 0.0–1.0; convert to 0–100 and cap
  return Math.min(100, Math.max(0, efficiency * 100));
}

function scoreDeepSleep(deepSeconds: number, totalSleepSeconds: number): number {
  if (totalSleepSeconds <= 0) return 0;
  const pct = deepSeconds / totalSleepSeconds;
  // Target: 20% deep sleep = 100pts; scale proportionally
  const score = (pct / 0.20) * 100;
  return Math.min(100, Math.max(0, score));
}

function scoreREM(remSeconds: number, totalSleepSeconds: number): number {
  if (totalSleepSeconds <= 0) return 0;
  const pct = remSeconds / totalSleepSeconds;
  // Target: 25% REM = 100pts; scale proportionally
  const score = (pct / 0.25) * 100;
  return Math.min(100, Math.max(0, score));
}

function scoreHRV(hrv: number): number {
  // Range: 20ms = 0pts, 80ms = 100pts; clamp outside bounds
  const score = ((hrv - 20) / (80 - 20)) * 100;
  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

interface ScoringComponent {
  name: string;
  score: number;
  weight: number;
}

/**
 * Calculate a 0–100 sleep score from extracted fields.
 * Gracefully degrades: missing fields are excluded and weights are renormalized.
 */
export function calculateSleepScore(fields: ExtractedSleepFields): number {
  const baseWeights = {
    duration: 0.35,
    efficiency: 0.25,
    deep: 0.20,
    rem: 0.15,
    hrv: 0.05,
  };

  const components: ScoringComponent[] = [];

  // Duration
  if (fields.durationSeconds !== null) {
    components.push({
      name: 'duration',
      score: scoreDuration(fields.durationSeconds),
      weight: baseWeights.duration,
    });
  }

  // Efficiency
  if (fields.efficiency !== null) {
    components.push({
      name: 'efficiency',
      score: scoreEfficiency(fields.efficiency),
      weight: baseWeights.efficiency,
    });
  }

  // Deep sleep (requires total sleep for percentage)
  const totalForDeep = fields.totalSleepSeconds ?? fields.durationSeconds;
  if (fields.deepSleepSeconds !== null && totalForDeep !== null && totalForDeep > 0) {
    components.push({
      name: 'deep_sleep',
      score: scoreDeepSleep(fields.deepSleepSeconds, totalForDeep),
      weight: baseWeights.deep,
    });
  }

  // REM sleep
  const totalForREM = fields.totalSleepSeconds ?? fields.durationSeconds;
  if (fields.remSleepSeconds !== null && totalForREM !== null && totalForREM > 0) {
    components.push({
      name: 'rem_sleep',
      score: scoreREM(fields.remSleepSeconds, totalForREM),
      weight: baseWeights.rem,
    });
  }

  // HRV
  if (fields.hrvAvg !== null) {
    components.push({
      name: 'hrv',
      score: scoreHRV(fields.hrvAvg),
      weight: baseWeights.hrv,
    });
  }

  if (components.length === 0) {
    console.warn('[scoring] No scoreable fields found in sleep data');
    return 0;
  }

  // Renormalize weights to sum to 1.0
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const finalScore = components.reduce((sum, c) => {
    const normalizedWeight = c.weight / totalWeight;
    return sum + c.score * normalizedWeight;
  }, 0);

  console.log('[scoring] Components:', components.map(c => `${c.name}=${c.score.toFixed(1)}`).join(', '));
  console.log(`[scoring] Final score: ${finalScore.toFixed(2)} (${components.length} components, total weight ${totalWeight.toFixed(2)})`);

  return parseFloat(finalScore.toFixed(2));
}
