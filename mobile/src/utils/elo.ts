export function eloTierFromRating(rating: number): string {
  if (rating < 900) return 'Bronze';
  if (rating < 1100) return 'Silver';
  if (rating < 1300) return 'Gold';
  if (rating < 1500) return 'Platinum';
  return 'Diamond';
}
