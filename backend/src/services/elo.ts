/**
 * Standard ELO rating calculation.
 * K-factor of 20 is appropriate for a small league (10-20 players).
 */

export interface EloResult {
  newRatingA: number;
  newRatingB: number;
  delta: number; // points transferred (always positive; winner gains, loser loses)
}

/**
 * Calculate expected win probability for player A against player B.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ELO ratings after a match.
 *
 * @param ratingA  Current ELO of player A
 * @param ratingB  Current ELO of player B
 * @param winnerId 'a' if player A won, 'b' if player B won
 * @param kFactor  K-factor (default 20)
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  winnerId: 'a' | 'b',
  kFactor = 20
): EloResult {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  const actualA = winnerId === 'a' ? 1 : 0;
  const actualB = winnerId === 'b' ? 1 : 0;

  const changeA = kFactor * (actualA - expectedA);
  const changeB = kFactor * (actualB - expectedB);

  const newRatingA = Math.max(0, Math.round(ratingA + changeA));
  const newRatingB = Math.max(0, Math.round(ratingB + changeB));

  // delta is always positive: how many points the winner gained
  const delta = Math.abs(Math.round(changeA));

  return { newRatingA, newRatingB, delta };
}

/**
 * Map an ELO rating to a tier name.
 */
export function eloTier(rating: number): string {
  if (rating < 900) return 'Bronze';
  if (rating < 1100) return 'Silver';
  if (rating < 1300) return 'Gold';
  if (rating < 1500) return 'Platinum';
  return 'Diamond';
}
