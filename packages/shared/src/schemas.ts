// Zod schemas shared by frontend forms and backend request validation — api-contract-spec §3, §5.
import { z } from 'zod';
import {
  DAY_TEXT_MAX,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  EMAIL_MAX,
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
  SESSION_ID_MAX,
  SESSION_ID_MIN,
  TOKEN_PATTERN,
  TRIP_MAX_DAYS,
  TRIP_NAME_MAX,
  TRIP_NAME_MIN,
} from './constants';
import { dayCountInclusive, isIsoDate, todayAoE } from './dates';
import { normalizeTripName, sanitizeDayText } from './text';

// ---- Primitives -------------------------------------------------------------

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'Must be a valid date (YYYY-MM-DD)' });

export const tripNameSchema = z
  .string()
  .transform(normalizeTripName)
  .pipe(
    z
      .string()
      .min(TRIP_NAME_MIN, `Trip name must be at least ${TRIP_NAME_MIN} characters`)
      .max(TRIP_NAME_MAX, `Trip name must be at most ${TRIP_NAME_MAX} characters`),
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN, 'Please enter your name')
  .max(DISPLAY_NAME_MAX, `Name must be at most ${DISPLAY_NAME_MAX} characters`);

export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)
  .pipe(z.email('Please enter a valid email address'));

export const dayTextSchema = z
  .string()
  .transform(sanitizeDayText)
  .pipe(z.string().max(DAY_TEXT_MAX, `Day details must be at most ${DAY_TEXT_MAX} characters`));

export const tokenSchema = z.string().regex(TOKEN_PATTERN);
export const sessionIdSchema = z.string().min(SESSION_ID_MIN).max(SESSION_ID_MAX);
export const searchQuerySchema = z.string().trim().min(SEARCH_QUERY_MIN).max(SEARCH_QUERY_MAX);

// ---- Date-range rule (AC1.2–1.4) -------------------------------------------

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export type DateRangeIssue = { field: 'fromDate' | 'toDate'; message: string };

/**
 * Returns rule violations for a trip date range; empty array means valid.
 * `allowPastFrom`: when editing a trip whose From date is unchanged, a trip already under way may
 * keep its past From date (goal Q24).
 */
export function validateDateRange(
  { fromDate, toDate }: DateRange,
  now: Date = new Date(),
  opts: { allowPastFrom?: boolean } = {},
): DateRangeIssue[] {
  const issues: DateRangeIssue[] = [];
  if (!opts.allowPastFrom && fromDate < todayAoE(now)) {
    issues.push({ field: 'fromDate', message: 'From date must be today or later' });
  }
  if (toDate < fromDate) {
    issues.push({ field: 'toDate', message: 'To date must be on or after the from date' });
  } else if (dayCountInclusive(fromDate, toDate) > TRIP_MAX_DAYS) {
    issues.push({ field: 'toDate', message: `A trip can be at most ${TRIP_MAX_DAYS} days` });
  }
  return issues;
}

// ---- Requests ---------------------------------------------------------------

/** E4 POST /trips */
export const createTripRequestSchema = z
  .object({
    name: tripNameSchema,
    destinationId: z.uuid(),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    organiserEmail: emailSchema.nullish(),
    copyFromSlug: z.string().min(1).max(120).nullish(),
  })
  .superRefine((value, ctx) => {
    for (const issue of validateDateRange(value)) {
      ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
    }
  });
export type CreateTripRequest = z.input<typeof createTripRequestSchema>;

/** E6 PATCH /trips/{token} — date rules are checked by the server against the resulting range. */
export const updateTripRequestSchema = z
  .object({
    version: z.int().positive(),
    name: tripNameSchema.optional(),
    destinationId: z.uuid().optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
    confirmRemoveDays: z.boolean().optional().default(false),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.destinationId !== undefined ||
      v.fromDate !== undefined ||
      v.toDate !== undefined,
    { message: 'Nothing to change', path: ['_'] },
  );
export type UpdateTripRequest = z.input<typeof updateTripRequestSchema>;

/** E15 GET /trips/published */
export const publishedTripsQuerySchema = z.object({
  q: searchQuerySchema.optional(),
  destinationId: z.uuid().optional(),
  excludeSlug: z.string().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});

/** E10 PUT /trips/{token}/days/{dayId} */
export const saveDayRequestSchema = z.object({
  text: dayTextSchema,
  version: z.int().positive(),
  editorName: displayNameSchema,
});
export type SaveDayRequest = z.input<typeof saveDayRequestSchema>;

/** E11 PUT /trips/{token}/days/{dayId}/presence */
export const presenceRequestSchema = z.object({
  sessionId: sessionIdSchema,
  editorName: displayNameSchema,
});

/** E13 POST /trips/{token}/delete-requests */
export const deleteRequestSchema = z.object({ requestedByName: displayNameSchema });

/** E17 POST /recover */
export const recoverRequestSchema = z.object({ email: emailSchema });

// ---- Access (api-contract §3 "Access") -----------------------------------------

export const ROLES = ['organiser', 'editor', 'viewer', 'public'] as const;
export type Role = (typeof ROLES)[number];

export interface Permissions {
  canEditDays: boolean;
  canEditTrip: boolean;
  canViewShareLinks: boolean;
  canViewOrganiserLink: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canRequestDeletion: boolean;
  canResolveDeleteRequests: boolean;
  canCopyPlan: boolean;
}

export interface Access {
  role: Role;
  permissions: Permissions;
}

/** Permission matrix — frontend-spec §6 / api-contract §4.1. Single source for both sides. */
export function permissionsFor(role: Role, completed: boolean): Permissions {
  const organiser = role === 'organiser';
  const editor = role === 'editor';
  return {
    canEditDays: (organiser || editor) && !completed,
    canEditTrip: organiser && !completed,
    canViewShareLinks: organiser || editor,
    canViewOrganiserLink: organiser,
    canPublish: organiser,
    canDelete: organiser,
    canRequestDeletion: editor,
    canResolveDeleteRequests: organiser,
    canCopyPlan: role === 'public',
  };
}
