import { calculateSleepScore, extractSleepFields } from '../services/scoring';
import { ExtractedSleepFields, TerraSleepData } from '../types/terra';

const fullFields: ExtractedSleepFields = {
  durationSeconds: 8 * 3600,        // 8 hours
  efficiency: 0.90,                  // 90%
  deepSleepSeconds: 1.6 * 3600,     // 20% of 8h
  remSleepSeconds: 2 * 3600,        // 25% of 8h
  totalSleepSeconds: 8 * 3600,
  hrvAvg: 50,                        // 50ms — middle of 20-80 range
  bedtime: '2024-01-15T23:00:00Z',
  wakeTime: '2024-01-16T07:00:00Z',
};

describe('calculateSleepScore', () => {
  it('returns a high score for optimal sleep', () => {
    const score = calculateSleepScore(fullFields);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns a score between 0 and 100', () => {
    const badFields: ExtractedSleepFields = {
      ...fullFields,
      durationSeconds: 4 * 3600, // 4 hours — very bad
      efficiency: 0.50,
      deepSleepSeconds: 0,
      remSleepSeconds: 0,
      hrvAvg: 15,
    };
    const score = calculateSleepScore(badFields);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles missing fields gracefully by renormalizing weights', () => {
    const partialFields: ExtractedSleepFields = {
      durationSeconds: 8 * 3600,
      efficiency: null,
      deepSleepSeconds: null,
      remSleepSeconds: null,
      totalSleepSeconds: null,
      hrvAvg: null,
      bedtime: null,
      wakeTime: null,
    };
    const score = calculateSleepScore(partialFields);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 when no fields are available', () => {
    const emptyFields: ExtractedSleepFields = {
      durationSeconds: null,
      efficiency: null,
      deepSleepSeconds: null,
      remSleepSeconds: null,
      totalSleepSeconds: null,
      hrvAvg: null,
      bedtime: null,
      wakeTime: null,
    };
    const score = calculateSleepScore(emptyFields);
    expect(score).toBe(0);
  });

  it('scores 8h duration near 100', () => {
    const score = calculateSleepScore({ ...fullFields, durationSeconds: 8 * 3600 });
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('scores 6h duration lower than 8h', () => {
    const score6h = calculateSleepScore({ ...fullFields, durationSeconds: 6 * 3600 });
    const score8h = calculateSleepScore({ ...fullFields, durationSeconds: 8 * 3600 });
    expect(score6h).toBeLessThan(score8h);
  });

  it('penalizes very low HRV', () => {
    const highHRV = calculateSleepScore({ ...fullFields, hrvAvg: 80 });
    const lowHRV = calculateSleepScore({ ...fullFields, hrvAvg: 20 });
    expect(highHRV).toBeGreaterThan(lowHRV);
  });
});

describe('extractSleepFields', () => {
  it('extracts all fields from a complete Terra payload', () => {
    const payload: TerraSleepData = {
      metadata: {
        start_time: '2024-01-15T23:00:00Z',
        end_time: '2024-01-16T07:00:00Z',
      },
      sleep_durations_data: {
        sleep_efficiency: 0.88,
        asleep: {
          duration_asleep_state_seconds: 7 * 3600,
          duration_deep_sleep_state_seconds: 1.4 * 3600,
          duration_REM_sleep_state_seconds: 1.75 * 3600,
        },
      },
      heart_rate_data: {
        hrv: {
          summary: {
            avg_rmssd: 45,
          },
        },
      },
    };

    const fields = extractSleepFields(payload);
    expect(fields.efficiency).toBeCloseTo(0.88);
    expect(fields.deepSleepSeconds).toBe(1.4 * 3600);
    expect(fields.remSleepSeconds).toBe(1.75 * 3600);
    expect(fields.totalSleepSeconds).toBe(7 * 3600);
    expect(fields.hrvAvg).toBe(45);
    expect(fields.bedtime).toBe('2024-01-15T23:00:00Z');
    expect(fields.wakeTime).toBe('2024-01-16T07:00:00Z');
  });

  it('computes duration from metadata times when asleep duration is missing', () => {
    const payload: TerraSleepData = {
      metadata: {
        start_time: '2024-01-15T22:00:00Z',
        end_time: '2024-01-16T06:00:00Z',
      },
    };

    const fields = extractSleepFields(payload);
    expect(fields.durationSeconds).toBe(8 * 3600);
  });

  it('returns nulls for missing fields', () => {
    const payload: TerraSleepData = {
      metadata: {
        start_time: '2024-01-15T23:00:00Z',
        end_time: '2024-01-16T07:00:00Z',
      },
    };

    const fields = extractSleepFields(payload);
    expect(fields.efficiency).toBeNull();
    expect(fields.deepSleepSeconds).toBeNull();
    expect(fields.remSleepSeconds).toBeNull();
    expect(fields.hrvAvg).toBeNull();
  });
});
