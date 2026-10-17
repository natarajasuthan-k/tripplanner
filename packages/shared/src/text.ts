// Text normalisation — backend BR2 (name), BR3 (slug), BR16 (day text).

/** Trim and collapse internal whitespace. */
export function normalizeTripName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive uniqueness key for trip names. */
export function tripNameKey(name: string): string {
  return normalizeTripName(name).toLowerCase();
}

/** URL-safe slug: lowercase ASCII letters, digits and single dashes. */
export function slugify(name: string): string {
  const slug = normalizeTripName(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'trip';
}

// Control characters except \t (\u0009) and \n (\u000A).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/** NFC-normalise, convert CRLF to LF and strip control characters other than \n and \t. */
export function sanitizeDayText(text: string): string {
  return text.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
