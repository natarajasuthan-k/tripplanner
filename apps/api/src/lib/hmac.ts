import { normalizeEmail } from '@tripplanner/shared';

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256(secret, normalised email) as hex — the only form in which emails are stored (BR11). */
export function emailHash(secret: string, email: string): Promise<string> {
  return hmacHex(secret, normalizeEmail(email));
}

/**
 * Anonymous contributor id for the pilot metric (BR18, goal Q25). Keyed per trip, so the same
 * display name on two trips can't be linked, and the name itself is never stored.
 */
export function contributorHash(
  secret: string,
  tripId: string,
  displayName: string,
): Promise<string> {
  return hmacHex(secret, `contributor:${tripId}:${displayName.trim().toLowerCase()}`);
}
