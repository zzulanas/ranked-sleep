import { calculateSleepScore, SleepInput } from '../services/scoring';

const fullInput: SleepInput = {
  duration_seconds: 8 * 3600,        // 8 hours
  efficiency: 0.90,                   // 90% (0.0–1.0 scale)
  deep_sleep_seconds: 1.6 * 3600,    // 20% of 8h
  rem_sleep_seconds: 2 * 3600,       // 25% of 8h
  total_sleep_seconds: 8 * 3600,
  hrv_avg: 50,                        // 50ms — middle of 20–80 range
};

describe('calculateSleepScore', () => {
  it('returns a high score for optimal sleep', () => {
    const score = calculateSleepScore(fullInput);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns a score between 0 and 100 for terrible sleep', () => {
    const badInput: SleepInput = {
      ...fullInput,
      duration_seconds: 4 * 3600,
      efficiency: 0.50,
      deep_sleep_seconds: 0,
      rem_sleep_seconds: 0,
      hrv_avg: 15,
    };
    const score = calculateSleepScore(badInput);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles missing fields gracefully by renormalizing weights', () => {
    const partialInput: SleepInput = {
      duration_seconds: 8 * 3600,
      efficiency: null,
      deep_sleep_seconds: null,
      rem_sleep_seconds: null,
      total_sleep_seconds: null,
      hrv_avg: null,
    };
    const score = calculateSleepScore(partialInput);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 when no fields are available', () => {
    const emptyInput: SleepInput = {
      duration_seconds: null,
      efficiency: null,
      deep_sleep_seconds: null,
      rem_sleep_seconds: null,
      total_sleep_seconds: null,
      hrv_avg: null,
    };
    expect(calculateSleepScore(emptyInput)).toBe(0);
  });

  it('scores 8h duration near 100', () => {
    const score = calculateSleepScore({ ...fullInput, duration_seconds: 8 * 3600 });
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('scores 6h duration lower than 8h', () => {
    const score6h = calculateSleepScore({ ...fullInput, duration_seconds: 6 * 3600 });
    const score8h = calculateSleepScore({ ...fullInput, duration_seconds: 8 * 3600 });
    expect(score6h).toBeLessThan(score8h);
  });

  it('scores high efficiency higher than low efficiency', () => {
    const high = calculateSleepScore({ ...fullInput, efficiency: 0.95 });
    const low  = calculateSleepScore({ ...fullInput, efficiency: 0.60 });
    expect(high).toBeGreaterThan(low);
  });

  it('penalizes very low HRV', () => {
    const highHRV = calculateSleepScore({ ...fullInput, hrv_avg: 80 });
    const lowHRV  = calculateSleepScore({ ...fullInput, hrv_avg: 20 });
    expect(highHRV).toBeGreaterThan(lowHRV);
  });

  it('uses total_sleep_seconds for deep/REM stage percentages', () => {
    // 8h total, 20% deep = 100 deep pts
    const score = calculateSleepScore({
      duration_seconds: 8 * 3600,
      efficiency: null,
      deep_sleep_seconds: 1.6 * 3600,
      rem_sleep_seconds: null,
      total_sleep_seconds: 8 * 3600,
      hrv_avg: null,
    });
    expect(score).toBeGreaterThan(0);
  });
});
