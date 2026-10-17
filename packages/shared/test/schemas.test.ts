import { describe, expect, it } from 'vitest';
import { addDays, todayAoE } from '../src/dates';
import {
  createTripRequestSchema,
  permissionsFor,
  saveDayRequestSchema,
  validateDateRange,
} from '../src/schemas';
import { slugify, sanitizeDayText, tripNameKey } from '../src/text';

const today = todayAoE();
const valid = {
  name: '  Kyoto   Winter 2026 ',
  destinationId: '0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d',
  fromDate: today,
  toDate: addDays(today, 5),
};

describe('createTripRequestSchema', () => {
  it('accepts a valid request and normalises the name', () => {
    const result = createTripRequestSchema.parse(valid);
    expect(result.name).toBe('Kyoto Winter 2026');
  });

  it('allows a one-day trip (AC1.3)', () => {
    expect(createTripRequestSchema.safeParse({ ...valid, toDate: today }).success).toBe(true);
  });

  it('rejects a past from date (AC1.2)', () => {
    const r = createTripRequestSchema.safeParse({ ...valid, fromDate: addDays(today, -2) });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === 'fromDate')).toBe(true);
  });

  it('rejects to date before from date (AC1.3)', () => {
    const r = createTripRequestSchema.safeParse({ ...valid, toDate: addDays(today, -1) });
    expect(r.error?.issues.some((i) => i.path[0] === 'toDate')).toBe(true);
  });

  it('allows exactly 60 days and rejects 61 (AC1.4)', () => {
    expect(validateDateRange({ fromDate: today, toDate: addDays(today, 59) })).toEqual([]);
    expect(validateDateRange({ fromDate: today, toDate: addDays(today, 60) })[0]?.field).toBe(
      'toDate',
    );
  });

  it('rejects names that are too short after trimming', () => {
    expect(createTripRequestSchema.safeParse({ ...valid, name: '  ab  ' }).success).toBe(false);
  });

  it('validates the optional organiser email (AC12.1–12.2)', () => {
    expect(createTripRequestSchema.safeParse({ ...valid, organiserEmail: null }).success).toBe(
      true,
    );
    expect(createTripRequestSchema.safeParse({ ...valid, organiserEmail: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('saveDayRequestSchema', () => {
  it('strips control characters and enforces the length limit', () => {
    const r = saveDayRequestSchema.parse({ text: 'a\u0007b\r\nc', version: 1, editorName: 'Asha' });
    expect(r.text).toBe('ab\nc');
    expect(
      saveDayRequestSchema.safeParse({ text: 'x'.repeat(5001), version: 1, editorName: 'A' })
        .success,
    ).toBe(false);
  });
});

describe('text helpers', () => {
  it('builds case-insensitive name keys', () => {
    expect(tripNameKey(' Kyoto  WINTER ')).toBe('kyoto winter');
  });
  it('slugifies names', () => {
    expect(slugify('Kyoto & Nara — Winter 2026!')).toBe('kyoto-and-nara-winter-2026');
    expect(slugify('Café Crème')).toBe('cafe-creme');
    expect(slugify('東京')).toBe('trip');
  });
  it('keeps tabs and newlines in day text', () => {
    expect(sanitizeDayText('a\tb\nc')).toBe('a\tb\nc');
  });
});

describe('permissionsFor', () => {
  it('locks content edits for everyone once completed (BR8)', () => {
    expect(permissionsFor('organiser', true).canEditDays).toBe(false);
    expect(permissionsFor('organiser', true).canPublish).toBe(true);
    expect(permissionsFor('editor', true).canRequestDeletion).toBe(true);
  });
  it('hides the organiser link from editors', () => {
    expect(permissionsFor('editor', false)).toMatchObject({
      canEditDays: true,
      canViewShareLinks: true,
      canViewOrganiserLink: false,
    });
  });
  it('gives viewers read-only access', () => {
    expect(Object.values(permissionsFor('viewer', false)).every((v) => v === false)).toBe(true);
  });
});
