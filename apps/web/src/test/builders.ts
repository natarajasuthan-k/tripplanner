import {
  permissionsFor,
  type Day,
  type Role,
  type TripResponse,
  type TripView,
} from '@tripplanner/shared';

export const TOKENS = {
  organiser: 'O'.repeat(43),
  editor: 'E'.repeat(43),
  viewer: 'V'.repeat(43),
};

export function buildDay(position: number, overrides: Partial<Day> = {}): Day {
  return {
    id: `0192f0c4-0000-7000-8000-00000000000${position}`,
    position,
    date: `2026-12-0${4 + position}`,
    text: '',
    version: 1,
    updatedByName: null,
    updatedAt: null,
    editors: [],
    ...overrides,
  };
}

export function buildTripResponse(
  role: Exclude<Role, 'public'>,
  overrides: Partial<TripView> = {},
): TripResponse {
  const completed = overrides.status?.isCompleted ?? false;
  const trip: TripView = {
    name: 'Kyoto Winter',
    slug: 'kyoto-winter',
    destination: {
      id: '0192f0c4-7a1e-7c3a-9b2e-5d1f2a3b4c5d',
      name: 'Kyoto',
      region: 'Kyoto Prefecture',
      country: 'Japan',
      countryCode: 'JP',
      lat: 35,
      lon: 135,
    },
    fromDate: '2026-12-05',
    toDate: '2026-12-07',
    dayCount: 3,
    status: { isPublished: false, publishedAt: null, isCompleted: completed },
    version: 1,
    createdAt: '2026-10-17T09:00:00.000Z',
    updatedAt: '2026-10-17T09:00:00.000Z',
    days: [buildDay(1), buildDay(2), buildDay(3)],
    links:
      role === 'organiser'
        ? { organiserToken: TOKENS.organiser, editToken: TOKENS.editor, viewToken: TOKENS.viewer }
        : role === 'editor'
          ? { editToken: TOKENS.editor, viewToken: TOKENS.viewer }
          : null,
    hasRecoveryEmail: role === 'organiser' ? false : null,
    pendingDeleteRequests: role === 'organiser' ? [] : null,
    ...overrides,
  };
  return { trip, access: { role, permissions: permissionsFor(role, completed) } };
}
