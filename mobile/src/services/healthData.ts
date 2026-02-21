import { Platform } from 'react-native';

export interface NormalizedSleepData {
  date: string;                     // YYYY-MM-DD (the "night of")
  duration_seconds: number | null;
  efficiency: number | null;        // 0.0 – 1.0
  deep_sleep_seconds: number | null;
  rem_sleep_seconds: number | null;
  hrv_avg: number | null;           // milliseconds
  bedtime: string | null;           // ISO string
  wake_time: string | null;         // ISO string
  provider: 'APPLE_HEALTH' | 'HEALTH_CONNECT';
}

/**
 * Pull last night's sleep data from the appropriate platform source.
 * Returns null if no sleep data was found or permissions were denied.
 */
export async function getLastNightSleep(): Promise<NormalizedSleepData | null> {
  if (Platform.OS === 'ios') {
    return getAppleHealthSleep();
  } else {
    return getHealthConnectSleep();
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Determine the "night of" date string (YYYY-MM-DD) from a bedtime ISO string.
 * If bedtime is before noon, it's a post-midnight sleep — belongs to previous day.
 */
function nightOfDate(bedtimeIso: string): string {
  const dt = new Date(bedtimeIso);
  const local = new Date(dt);
  if (dt.getHours() < 12) {
    local.setDate(local.getDate() - 1);
  }
  return local.toISOString().split('T')[0];
}

/** Yesterday noon → today noon window covers any reasonable sleep session. */
function sleepWindow(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(12, 0, 0, 0);
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

// ─── Apple Health (iOS) ───────────────────────────────────────────────────────

async function getAppleHealthSleep(): Promise<NormalizedSleepData | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AppleHealthKit = require('react-native-health').default;

  const permissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
        AppleHealthKit.Constants.Permissions.HeartRateVariability,
      ],
      write: [],
    },
  };

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (err: string) => {
      if (err) reject(new Error(err));
      else resolve();
    });
  });

  const { startDate, endDate } = sleepWindow();
  const options = { startDate, endDate };

  const sleepSamples: Array<{ value: string; startDate: string; endDate: string }> =
    await new Promise((resolve, reject) => {
      AppleHealthKit.getSleepSamples(options, (err: string, results: typeof sleepSamples) => {
        if (err) reject(new Error(err));
        else resolve(results ?? []);
      });
    });

  if (!sleepSamples.length) return null;

  // Apple Health sample values:
  // "INBED" = time in bed (not actually asleep)
  // "ASLEEP" = generic asleep (older devices)
  // "ASLEEP_CORE" = light sleep
  // "ASLEEP_DEEP" = deep sleep
  // "ASLEEP_REM" = REM sleep
  const asleepValues = new Set(['ASLEEP', 'ASLEEP_CORE', 'ASLEEP_DEEP', 'ASLEEP_REM']);
  const asleepSamples = sleepSamples.filter(s => asleepValues.has(s.value));

  if (!asleepSamples.length) return null;

  const bedtime = sleepSamples.reduce((a, b) =>
    new Date(a.startDate) < new Date(b.startDate) ? a : b).startDate;

  const wakeTime = sleepSamples.reduce((a, b) =>
    new Date(a.endDate) > new Date(b.endDate) ? a : b).endDate;

  const durationMs = (s: { startDate: string; endDate: string }) =>
    new Date(s.endDate).getTime() - new Date(s.startDate).getTime();

  const totalAsleepMs = asleepSamples.reduce((sum, s) => sum + durationMs(s), 0);
  const totalInBedMs  = new Date(wakeTime).getTime() - new Date(bedtime).getTime();

  const deepMs = asleepSamples
    .filter(s => s.value === 'ASLEEP_DEEP')
    .reduce((sum, s) => sum + durationMs(s), 0);

  const remMs = asleepSamples
    .filter(s => s.value === 'ASLEEP_REM')
    .reduce((sum, s) => sum + durationMs(s), 0);

  // HRV — Apple Health returns SDNN in seconds, convert to ms
  let hrvAvg: number | null = null;
  try {
    const hrvSamples: Array<{ value: number }> = await new Promise((resolve) => {
      AppleHealthKit.getHeartRateVariabilitySamples(options, (_err: string, results: typeof hrvSamples) => {
        resolve(results ?? []);
      });
    });
    if (hrvSamples.length > 0) {
      const sum = hrvSamples.reduce((acc, s) => acc + s.value * 1000, 0);
      hrvAvg = Math.round((sum / hrvSamples.length) * 10) / 10;
    }
  } catch {
    // HRV unavailable — not all devices support it
  }

  return {
    date: nightOfDate(bedtime),
    duration_seconds: Math.round(totalAsleepMs / 1000),
    efficiency: totalInBedMs > 0 ? totalAsleepMs / totalInBedMs : null,
    deep_sleep_seconds: deepMs > 0 ? Math.round(deepMs / 1000) : null,
    rem_sleep_seconds: remMs > 0 ? Math.round(remMs / 1000) : null,
    hrv_avg: hrvAvg,
    bedtime,
    wake_time: wakeTime,
    provider: 'APPLE_HEALTH',
  };
}

// ─── Google Health Connect (Android / Garmin) ─────────────────────────────────

async function getHealthConnectSleep(): Promise<NormalizedSleepData | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initialize, requestPermission, readRecords } = require('expo-health-connect');

  const initialized = await initialize();
  if (!initialized) return null;

  await requestPermission([
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'HeartRateVariabilitySdnn' },
  ]);

  const { startDate, endDate } = sleepWindow();
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startDate,
    endTime: endDate,
  };

  const sleepResult = await readRecords('SleepSession', { timeRangeFilter });
  const sessions: Array<{
    startTime: string;
    endTime: string;
    stages?: Array<{ stage: number; startTime: string; endTime: string }>;
  }> = sleepResult?.records ?? [];

  if (!sessions.length) return null;

  // Use the longest session if multiple exist
  const session = sessions.reduce((longest, s) => {
    const dur  = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    const lDur = new Date(longest.endTime).getTime() - new Date(longest.startTime).getTime();
    return dur > lDur ? s : longest;
  });

  const bedtime  = session.startTime;
  const wakeTime = session.endTime;
  const totalInBedMs = new Date(wakeTime).getTime() - new Date(bedtime).getTime();

  // Health Connect sleep stage types:
  // 1=AWAKE, 2=SLEEPING (generic), 3=OUT_OF_BED, 4=LIGHT, 5=DEEP, 6=REM
  const stageDurationMs = (type: number) =>
    (session.stages ?? [])
      .filter(s => s.stage === type)
      .reduce((sum, s) =>
        sum + new Date(s.endTime).getTime() - new Date(s.startTime).getTime(), 0);

  const deepMs    = stageDurationMs(5);
  const remMs     = stageDurationMs(6);
  const lightMs   = stageDurationMs(4);
  const genericMs = stageDurationMs(2);

  // Total asleep = sum of all sleep stages; fall back to 90% of in-bed if no stage data
  const totalAsleepMs = deepMs + remMs + lightMs + genericMs || totalInBedMs * 0.9;

  // HRV
  let hrvAvg: number | null = null;
  try {
    const hrvResult = await readRecords('HeartRateVariabilitySdnn', { timeRangeFilter });
    const hrvRecords: Array<{ heartRateVariabilityMillis: number }> = hrvResult?.records ?? [];
    if (hrvRecords.length > 0) {
      const sum = hrvRecords.reduce((acc, r) => acc + r.heartRateVariabilityMillis, 0);
      hrvAvg = Math.round((sum / hrvRecords.length) * 10) / 10;
    }
  } catch {
    // HRV optional
  }

  return {
    date: nightOfDate(bedtime),
    duration_seconds: Math.round(totalAsleepMs / 1000),
    efficiency: totalInBedMs > 0 ? totalAsleepMs / totalInBedMs : null,
    deep_sleep_seconds: deepMs > 0 ? Math.round(deepMs / 1000) : null,
    rem_sleep_seconds: remMs > 0 ? Math.round(remMs / 1000) : null,
    hrv_avg: hrvAvg,
    bedtime,
    wake_time: wakeTime,
    provider: 'HEALTH_CONNECT',
  };
}
