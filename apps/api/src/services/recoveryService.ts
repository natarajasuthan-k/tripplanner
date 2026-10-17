// Organiser-link emails — backend-spec BR11, BR12; api-contract E4 (emailSent), E17.
import type { Db } from '../db/client';
import type { Env } from '../env';
import {
  organiserLinkEmail,
  recoveryEmail,
  type LinkEntry,
  type SendEmail,
} from '../integrations/email';
import { rateLimited } from '../middleware/rateLimit';
import { hitCounter } from '../repositories/cacheRepo';
import { findTripsByEmailHash, type TripRow } from '../repositories/tripRepo';

const RECOVER_PER_EMAIL_PER_HOUR = 3;
const RECOVER_PER_IP_PER_HOUR = 10;

const linkEntry = (env: Env, trip: TripRow): LinkEntry => ({
  name: trip.name,
  fromDate: trip.fromDate,
  toDate: trip.toDate,
  url: `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/o/${trip.organiserToken}`,
});

/** Sends the organiser link right after creation. Returns false if sending failed (AC12.3). */
export async function sendOrganiserLink(
  env: Env,
  sendEmail: SendEmail,
  to: string,
  trip: TripRow,
): Promise<boolean> {
  try {
    await sendEmail(env, organiserLinkEmail(to, linkEntry(env, trip)));
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'organiser email failed',
        error: err instanceof Error ? err.name : 'unknown',
      }),
    );
    return false;
  }
}

/** Rate limits first (429 is the only distinguishable outcome, AC12.5). */
export async function checkRecoveryLimits(db: Db, emailHash: string, clientIp: string) {
  const [byEmail, byIp] = await Promise.all([
    hitCounter(db, `recover:email:${emailHash}`, 3600),
    hitCounter(db, `recover:ip:${clientIp}`, 3600),
  ]);
  if (byEmail.count > RECOVER_PER_EMAIL_PER_HOUR) throw rateLimited(byEmail.resetInSeconds);
  if (byIp.count > RECOVER_PER_IP_PER_HOUR) throw rateLimited(byIp.resetInSeconds);
}

/**
 * Looks up the trips for an email hash. Runs inline (same cost whether or not anything matches);
 * only the email send is deferred, after the DB connection may already be closed.
 */
export function tripsForEmail(db: Db, emailHash: string): Promise<TripRow[]> {
  return findTripsByEmailHash(db, emailHash);
}

/** Emails every organiser link for the address; no-op when none match (AC12.4). */
export async function sendRecoveryEmail(
  env: Env,
  sendEmail: SendEmail,
  to: string,
  trips: TripRow[],
): Promise<void> {
  if (trips.length === 0) return;
  await sendEmail(
    env,
    recoveryEmail(
      to,
      trips.map((t) => linkEntry(env, t)),
    ),
  );
}
