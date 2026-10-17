// "Your trips on this device" (F11, frontend-spec §5) — stored only in this browser.
import { useSyncExternalStore } from 'react';
import { readJson, STORAGE_KEYS, writeJson } from './storage';

export type MyTripRole = 'organiser' | 'editor' | 'viewer';

export interface MyTrip {
  name: string;
  role: MyTripRole;
  token: string;
  lastOpenedAt: string;
}

const MAX_TRIPS = 50;
const ROLE_RANK: Record<MyTripRole, number> = { viewer: 0, editor: 1, organiser: 2 };
const listeners = new Set<() => void>();
let cache: MyTrip[] | null = null;

function read(): MyTrip[] {
  cache ??= readJson<MyTrip[]>(STORAGE_KEYS.myTrips, []).filter(
    (t) => t && typeof t.token === 'string' && typeof t.name === 'string',
  );
  return cache;
}

function write(trips: MyTrip[]) {
  cache = trips;
  writeJson(STORAGE_KEYS.myTrips, trips);
  listeners.forEach((l) => l());
}

export function getMyTrips(): MyTrip[] {
  return read();
}

/** Add or refresh a trip, most recent first, capped at 50 (AC13.1). */
export function rememberTrip(trip: Omit<MyTrip, 'lastOpenedAt'>, now = new Date()) {
  const rest = read().filter((t) => t.token !== trip.token);
  write([{ ...trip, lastOpenedAt: now.toISOString() }, ...rest].slice(0, MAX_TRIPS));
}

export function forgetTrip(token: string) {
  write(read().filter((t) => t.token !== token));
}

export function isRemembered(token: string): boolean {
  return read().some((t) => t.token === token);
}

/** Collapse multiple codes for the same trip name to the most powerful role for display. */
export function sortForDisplay(trips: MyTrip[]): MyTrip[] {
  return [...trips].sort(
    (a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt) || ROLE_RANK[b.role] - ROLE_RANK[a.role],
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMyTrips(): MyTrip[] {
  return useSyncExternalStore(subscribe, read, read);
}

/** Test helper: drop the in-memory cache so the next read hits storage. */
export function resetMyTripsCache() {
  cache = null;
}
