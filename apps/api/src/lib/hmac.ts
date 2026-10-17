import { normalizeEmail } from '@tripplanner/shared';

/** HMAC-SHA256(secret, normalised email) as hex — the only form in which emails are stored (BR11). */
export async function emailHash(secret: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(normalizeEmail(email)),
  );
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
