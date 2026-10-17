// Organiser-link emails (F10) via Resend — backend-spec §6, BR11–BR12.
// The address is used only to send; it is never stored or logged.
import type { Env } from '../env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendEmail = (env: Env, message: EmailMessage) => Promise<void>;

export class EmailError extends Error {
  override name = 'EmailError';
}

const RESEND_URL = 'https://api.resend.com/emails';

/** EMAIL_MODE=live → Resend; anything else → log a redacted line (local dev). */
export const defaultSendEmail: SendEmail = async (env, message) => {
  if (env.EMAIL_MODE !== 'live') {
    console.log(
      JSON.stringify({ level: 'info', msg: 'email suppressed', subject: message.subject }),
    );
    return;
  }
  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new EmailError(`Email request failed: ${(err as Error).name}`);
  }
  if (!res.ok) throw new EmailError(`Email provider responded ${res.status}`);
};

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export interface LinkEntry {
  name: string;
  fromDate: string;
  toDate: string;
  url: string;
}

function render(intro: string, entries: LinkEntry[]): { text: string; html: string } {
  const warning = 'Keep these links private — anyone with an organiser link controls the trip.';
  const text = [
    intro,
    '',
    ...entries.map((e) => `• ${e.name} (${e.fromDate} – ${e.toDate})\n  ${e.url}`),
    '',
    warning,
    '',
    '— Trip Planner',
  ].join('\n');
  const html = `<p>${escapeHtml(intro)}</p><ul>${entries
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.name)}</strong> (${e.fromDate} – ${e.toDate})<br><a href="${escapeHtml(e.url)}">${escapeHtml(e.url)}</a></li>`,
    )
    .join('')}</ul><p>${escapeHtml(warning)}</p><p>— Trip Planner</p>`;
  return { text, html };
}

export function organiserLinkEmail(to: string, entry: LinkEntry): EmailMessage {
  return {
    to,
    subject: `Your organiser link for “${entry.name}”`,
    ...render('Here is the organiser link for your trip. Bookmark it or keep this email.', [entry]),
  };
}

export function recoveryEmail(to: string, entries: LinkEntry[]): EmailMessage {
  return {
    to,
    subject: 'Your Trip Planner organiser links',
    ...render(
      entries.length === 1
        ? 'You asked for your organiser link. Here it is:'
        : `You asked for your organiser links. Here are all ${entries.length}:`,
      entries,
    ),
  };
}
