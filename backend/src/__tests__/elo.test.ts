import { calculateElo, expectedScore, eloTier } from '../services/elo';

describe('calculateElo', () => {
  it('gives more points to upsets (lower-rated player wins)', () => {
    const { delta: normalDelta } = calculateElo(1200, 1000, 'a'); // favorite wins
    const { delta: upsetDelta } = calculateElo(1000, 1200, 'a'); // underdog wins
    expect(upsetDelta).toBeGreaterThan(normalDelta);
  });

  it('maintains symmetry (total rating is conserved)', () => {
    const ratingA = 1100;
    const ratingB = 900;

    const { newRatingA, newRatingB } = calculateElo(ratingA, ratingB, 'a');
    expect(newRatingA + newRatingB).toBe(ratingA + ratingB);
  });

  it('winner gains, loser loses', () => {
    const { newRatingA, newRatingB } = calculateElo(1000, 1000, 'a');
    expect(newRatingA).toBeGreaterThan(1000);
    expect(newRatingB).toBeLessThan(1000);
  });

  it('delta is always positive', () => {
    const result1 = calculateElo(1000, 1000, 'a');
    const result2 = calculateElo(1500, 800, 'b');
    expect(result1.delta).toBeGreaterThan(0);
    expect(result2.delta).toBeGreaterThan(0);
  });

  it('respects custom k-factor', () => {
    const { delta: delta20 } = calculateElo(1000, 1000, 'a', 20);
    const { delta: delta32 } = calculateElo(1000, 1000, 'a', 32);
    expect(delta32).toBeGreaterThan(delta20);
  });

  it('does not drop ratings below 0', () => {
    const { newRatingA, newRatingB } = calculateElo(10, 2000, 'b');
    expect(newRatingA).toBeGreaterThanOrEqual(0);
    expect(newRatingB).toBeGreaterThanOrEqual(0);
  });
});

describe('expectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it('returns > 0.5 for higher-rated player', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
  });

  it('is symmetric', () => {
    const eA = expectedScore(1200, 1000);
    const eB = expectedScore(1000, 1200);
    expect(eA + eB).toBeCloseTo(1.0);
  });
});

describe('eloTier', () => {
  it('assigns correct tiers', () => {
    expect(eloTier(800)).toBe('Bronze');
    expect(eloTier(1000)).toBe('Silver');
    expect(eloTier(1100)).toBe('Gold');
    expect(eloTier(1300)).toBe('Platinum');
    expect(eloTier(1500)).toBe('Diamond');
  });

  it('handles boundary values correctly', () => {
    expect(eloTier(899)).toBe('Bronze');
    expect(eloTier(900)).toBe('Silver');
    expect(eloTier(1099)).toBe('Silver');
    expect(eloTier(1100)).toBe('Gold');
  });
});
