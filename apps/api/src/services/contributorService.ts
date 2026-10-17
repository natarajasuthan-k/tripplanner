// Anonymous contributor count for the pilot metric — backend-spec BR18, goal Q25.
import type { Db } from '../db/client';
import { tripContributors } from '../db/schema';
import { contributorHash } from '../lib/hmac';

/** Records that `displayName` edited the trip. Never throws: the save has already succeeded. */
export async function recordContribution(
  db: Db,
  secret: string,
  tripId: string,
  displayName: string,
): Promise<void> {
  try {
    await db
      .insert(tripContributors)
      .values({ tripId, contributorHash: await contributorHash(secret, tripId, displayName) })
      .onConflictDoNothing();
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'contributor record failed',
        error: err instanceof Error ? err.name : 'unknown',
      }),
    );
  }
}
