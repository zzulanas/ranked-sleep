// Sleep scoring service
// Input comes from the mobile app (pulled from HealthKit / Health Connect)

export interface SleepInput {
  duration_seconds: number | null;
  efficiency: number | null;         // 0.0 - 1.0 (asleep / in-bed)
  deep_sleep_seconds: number | null;
  rem_sleep_seconds: number | null;
  hrv_avg: number | null;            // milliseconds
  total_sleep_seconds: number | null; // same as duration_seconds; used for stage % calcs
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
    // Diminishing returns beyond 9h; floor at 60 around 11h
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
  return Math.min(100, Math.max(0, (pct / 0.20) * 100));
}

function scoreREM(remSeconds: number, totalSleepSeconds: number): number {
  if (totalSleepSeconds <= 0) return 0;
  const pct = remSeconds / totalSleepSeconds;
  // Target: 25% REM = 100pts; scale proportionally
  return Math.min(100, Math.max(0, (pct / 0.25) * 100));
}

function scoreHRV(hrv: number): number {
  // Range: 20ms = 0pts, 80ms = 100pts; clamp outside bounds
  return Math.min(100, Math.max(0, ((hrv - 20) / (80 - 20)) * 100));
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
 * Calculate a 0–100 sleep score from a flat SleepInput.
 * Gracefully degrades: missing fields are excluded and weights are renormalized.
 */
export function calculateSleepScore(data: SleepInput): number {
  const baseWeights = {
    duration:   0.35,
    efficiency: 0.25,
    deep:       0.20,
    rem:        0.15,
    hrv:        0.05,
  };

  const components: ScoringComponent[] = [];

  if (data.duration_seconds !== null) {
    components.push({
      name: 'duration',
      score: scoreDuration(data.duration_seconds),
      weight: baseWeights.duration,
    });
  }

  if (data.efficiency !== null) {
    components.push({
      name: 'efficiency',
      score: scoreEfficiency(data.efficiency),
      weight: baseWeights.efficiency,
    });
  }

  const totalForStages = data.total_sleep_seconds ?? data.duration_seconds;

  if (data.deep_sleep_seconds !== null && totalForStages !== null && totalForStages > 0) {
    components.push({
      name: 'deep_sleep',
      score: scoreDeepSleep(data.deep_sleep_seconds, totalForStages),
      weight: baseWeights.deep,
    });
  }

  if (data.rem_sleep_seconds !== null && totalForStages !== null && totalForStages > 0) {
    components.push({
      name: 'rem_sleep',
      score: scoreREM(data.rem_sleep_seconds, totalForStages),
      weight: baseWeights.rem,
    });
  }

  if (data.hrv_avg !== null) {
    components.push({
      name: 'hrv',
      score: scoreHRV(data.hrv_avg),
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
    return sum + c.score * (c.weight / totalWeight);
  }, 0);

  console.log('[scoring] Components:', components.map(c => `${c.name}=${c.score.toFixed(1)}`).join(', '));
  console.log(`[scoring] Final score: ${finalScore.toFixed(2)} (${components.length} components)`);

  return parseFloat(finalScore.toFixed(2));
}
