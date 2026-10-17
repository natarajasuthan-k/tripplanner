// Response shapes — api-contract-spec §3. The API builds these; the web app consumes the types.
import { z } from 'zod';
import { ROLES } from './schemas';

export const destinationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  region: z.string().nullable(),
  country: z.string(),
  countryCode: z.string().length(2),
  lat: z.number(),
  lon: z.number(),
});
export type Destination = z.infer<typeof destinationSchema>;

export const editorSchema = z.object({
  displayName: z.string(),
  lastSeenAt: z.string(),
});
export type Editor = z.infer<typeof editorSchema>;

export const daySchema = z.object({
  id: z.uuid(),
  position: z.int(),
  date: z.string(),
  text: z.string(),
  version: z.int(),
  updatedByName: z.string().nullable(),
  updatedAt: z.string().nullable(),
  editors: z.array(editorSchema),
});
export type Day = z.infer<typeof daySchema>;

export const tripStatusSchema = z.object({
  isPublished: z.boolean(),
  publishedAt: z.string().nullable(),
  isCompleted: z.boolean(),
});
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const permissionsSchema = z.object({
  canEditDays: z.boolean(),
  canEditTrip: z.boolean(),
  canViewShareLinks: z.boolean(),
  canViewOrganiserLink: z.boolean(),
  canPublish: z.boolean(),
  canDelete: z.boolean(),
  canRequestDeletion: z.boolean(),
  canResolveDeleteRequests: z.boolean(),
  canCopyPlan: z.boolean(),
});

export const accessSchema = z.object({
  role: z.enum(ROLES),
  permissions: permissionsSchema,
});

export const tripLinksSchema = z.object({
  organiserToken: z.string().optional(),
  editToken: z.string(),
  viewToken: z.string(),
});
export type TripLinks = z.infer<typeof tripLinksSchema>;

export const deleteRequestViewSchema = z.object({
  id: z.uuid(),
  requestedByName: z.string(),
  createdAt: z.string(),
});
export type DeleteRequestView = z.infer<typeof deleteRequestViewSchema>;

export const tripViewSchema = z.object({
  name: z.string(),
  slug: z.string(),
  destination: destinationSchema,
  fromDate: z.string(),
  toDate: z.string(),
  dayCount: z.int(),
  status: tripStatusSchema,
  version: z.int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  days: z.array(daySchema),
  links: tripLinksSchema.nullable(),
  hasRecoveryEmail: z.boolean().nullable(),
  pendingDeleteRequests: z.array(deleteRequestViewSchema).nullable(),
});
export type TripView = z.infer<typeof tripViewSchema>;

export const tripResponseSchema = z.object({ trip: tripViewSchema, access: accessSchema });
export type TripResponse = z.infer<typeof tripResponseSchema>;

export const createTripResponseSchema = tripResponseSchema.extend({
  emailSent: z.boolean().nullable(),
});
export type CreateTripResponse = z.infer<typeof createTripResponseSchema>;

export const destinationSearchResponseSchema = z.object({ items: z.array(destinationSchema) });
export type DestinationSearchResponse = z.infer<typeof destinationSearchResponseSchema>;

export const saveDayResponseSchema = z.object({ day: daySchema });
export type SaveDayResponse = z.infer<typeof saveDayResponseSchema>;

export const deleteRequestResponseSchema = z.object({ deleteRequest: deleteRequestViewSchema });
export const dismissResponseSchema = z.object({ dismissedCount: z.int() });

export const tripStatusResponseSchema = z.object({ status: tripStatusSchema });

export const tripSummarySchema = z.object({
  name: z.string(),
  slug: z.string(),
  destination: destinationSchema,
  fromDate: z.string(),
  toDate: z.string(),
  dayCount: z.int(),
  isCompleted: z.boolean(),
  publishedAt: z.string().nullable(),
});
export type TripSummary = z.infer<typeof tripSummarySchema>;

export const tripSummaryPageSchema = z.object({
  items: z.array(tripSummarySchema),
  page: z.int(),
  limit: z.int(),
  total: z.int(),
  hasMore: z.boolean(),
});
export type TripSummaryPage = z.infer<typeof tripSummaryPageSchema>;

export const publicTripViewSchema = z.object({
  name: z.string(),
  slug: z.string(),
  canonicalSlug: z.string(),
  destination: destinationSchema,
  fromDate: z.string(),
  toDate: z.string(),
  dayCount: z.int(),
  status: tripStatusSchema,
  days: z.array(daySchema),
});
export type PublicTripView = z.infer<typeof publicTripViewSchema>;

export const publicTripResponseSchema = z.object({
  trip: publicTripViewSchema,
  access: accessSchema,
});
export type PublicTripResponse = z.infer<typeof publicTripResponseSchema>;

export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  categoryLabel: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  sourceUrl: z.string().nullable(),
  wikipediaUrl: z.string().nullable(),
});
export type Place = z.infer<typeof placeSchema>;

export const placesResponseSchema = z.object({
  items: z.array(placeSchema),
  stale: z.boolean(),
  fetchedAt: z.string(),
  attribution: z.string(),
});
export type PlacesResponse = z.infer<typeof placesResponseSchema>;

export const recoverResponseSchema = z.object({ message: z.string() });

export const RECOVER_MESSAGE = "If we have trips for this email, we've sent the links.";

/** `details` of 409 DAYS_WOULD_BE_REMOVED. */
export interface RemovedDay {
  position: number;
  date: string;
  textPreview: string;
}
export interface DaysWouldBeRemovedDetails {
  removedDays: RemovedDay[];
}

/** `details` of 409 DAY_VERSION_CONFLICT. */
export interface DayConflictDetails {
  current: Day;
}
