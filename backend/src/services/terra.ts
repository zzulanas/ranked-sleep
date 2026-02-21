import crypto from 'crypto';

/**
 * Verify a Terra webhook HMAC-SHA256 signature.
 * Terra docs: https://docs.tryterra.co/reference/using-the-terra-api#verifying-webhooks
 *
 * Terra sends the signature in the `terra-signature` header as a hex-encoded
 * HMAC-SHA256 of the raw request body, keyed with your webhook secret.
 */
export function verifyTerraSignature(
  rawBody: Buffer,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Terra may send multiple signatures separated by commas (versioned format)
    // Just check if any of them match
    const signatures = signatureHeader.split(',').map(s => s.trim());
    return signatures.some(sig => {
      // Strip optional "sha256=" prefix if present
      const clean = sig.startsWith('sha256=') ? sig.slice(7) : sig;
      try {
        return crypto.timingSafeEqual(Buffer.from(clean, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    });
  } catch (err) {
    console.error('[terra] Signature verification error:', err);
    return false;
  }
}

/**
 * Determine the "night of" date from a bedtime timestamp.
 * If bedtime is before noon, assume it's a previous-night sleep and use yesterday's date.
 * Dates are always in America/New_York timezone for the PoC.
 *
 * E.g. "2024-01-15T02:30:00Z" → "2024-01-14" (they went to bed after midnight, it's last night's sleep)
 * E.g. "2024-01-14T23:00:00Z" → "2024-01-14" (they went to bed before midnight)
 */
export function getNightOfDate(bedtimeIso: string): string {
  const dt = new Date(bedtimeIso);
  const nyTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(dt);

  const parts = Object.fromEntries(nyTime.map(p => [p.type, p.value]));
  const hour = parseInt(parts.hour, 10);
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;

  // If bedtime is before noon (0–11), this sleep belongs to the previous calendar night
  if (hour < 12) {
    const prevDay = new Date(dt);
    prevDay.setDate(prevDay.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(prevDay);
  }

  return dateStr;
}

/**
 * Get today's date string in America/New_York timezone.
 */
export function getTodayNY(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Get current hour (0–23) in America/New_York timezone.
 */
export function getCurrentHourNY(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find(p => p.type === 'hour');
  return parseInt(hourPart?.value ?? '0', 10);
}
