import { TOKEN_PATTERN } from '@tripplanner/shared';
import { describe, expect, it } from 'vitest';
import { randomToken, uuidv7 } from '../src/lib/ids';

describe('ids (BR1)', () => {
  it('generates 43-char base64url tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, randomToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(TOKEN_PATTERN);
  });

  it('generates time-ordered UUID v7', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
