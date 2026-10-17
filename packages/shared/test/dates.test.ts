import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateForPosition,
  dayCountInclusive,
  isCompleted,
  isIsoDate,
  todayAoE,
} from '../src/dates';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-12-05')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });
  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-2-5')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('not-a-date')).toBe(false);
  });
});

describe('todayAoE', () => {
  it('is the UTC date 12 hours earlier', () => {
    expect(todayAoE(new Date('2026-10-17T11:59:59Z'))).toBe('2026-10-16');
    expect(todayAoE(new Date('2026-10-17T12:00:00Z'))).toBe('2026-10-17');
  });
});

describe('day arithmetic', () => {
  it('counts both ends', () => {
    expect(dayCountInclusive('2026-12-05', '2026-12-05')).toBe(1);
    expect(dayCountInclusive('2026-12-05', '2026-12-10')).toBe(6);
  });
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dateForPosition('2026-12-30', 3)).toBe('2027-01-01');
  });
});

describe('isCompleted', () => {
  const now = new Date('2026-10-17T13:00:00Z'); // AoE today = 2026-10-17
  it('is false on the last day itself', () => {
    expect(isCompleted('2026-10-17', now)).toBe(false);
  });
  it('is true once the last day has passed in AoE', () => {
    expect(isCompleted('2026-10-16', now)).toBe(true);
  });
});
