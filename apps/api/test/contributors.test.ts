import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, makeApp, setupDb } from './helpers/app';
import { createTestTrip } from './helpers/fixtures';

setupDb();
const { request } = makeApp();

const save = (token: string, dayId: string, text: string, version: number, editorName: string) =>
  request(`/trips/${token}/days/${dayId}`, {
    method: 'PUT',
    body: { text, version, editorName },
  });

async function contributorRows() {
  return (await db.execute(
    sql`select trip_id, contributor_hash from trip_contributors`,
  )) as unknown as { trip_id: string; contributor_hash: string }[];
}

describe('anonymous contributor count (BR18, goal Q25)', () => {
  it('counts distinct display names per trip, case-insensitively, without storing names', async () => {
    const t = await createTestTrip(request);
    const [d1, d2] = t.days;
    await save(t.editor, d1!.id, 'a', 1, 'Asha');
    await save(t.organiser, d1!.id, 'b', 2, ' asha ');
    await save(t.editor, d2!.id, 'c', 1, 'Ravi');

    const rows = await contributorRows();
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.contributor_hash).toMatch(/^[0-9a-f]{64}$/);
    const dump = JSON.stringify(await db.execute(sql`select * from trip_contributors`));
    expect(dump.toLowerCase()).not.toContain('asha');
    expect(dump.toLowerCase()).not.toContain('ravi');
  });

  it('keys the hash per trip so names cannot be linked across trips', async () => {
    const a = await createTestTrip(request, { name: 'Trip A' });
    const b = await createTestTrip(request, { name: 'Trip B' });
    await save(a.editor, a.days[0]!.id, 'x', 1, 'Asha');
    await save(b.editor, b.days[0]!.id, 'y', 1, 'Asha');
    const hashes = (await contributorRows()).map((r) => r.contributor_hash);
    expect(new Set(hashes).size).toBe(2);
  });

  it('does not record failed saves and is removed with the trip', async () => {
    const t = await createTestTrip(request);
    await save(t.viewer, t.days[0]!.id, 'x', 1, 'Viewer'); // 403
    await save(t.editor, t.days[0]!.id, 'x', 99, 'Stale'); // 409
    expect(await contributorRows()).toHaveLength(0);

    await save(t.editor, t.days[0]!.id, 'x', 1, 'Asha');
    await request(`/trips/${t.organiser}`, { method: 'DELETE' });
    expect(await contributorRows()).toHaveLength(0);
  });
});
