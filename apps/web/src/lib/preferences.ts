// Display name (AC2.2) and first-visit tips (AC16.3–16.4), persisted per device.
import { DISPLAY_NAME_MAX } from '@tripplanner/shared';
import { useSyncExternalStore } from 'react';
import { readJson, readString, STORAGE_KEYS, writeJson, writeString } from './storage';

type Role = 'organiser' | 'editor' | 'viewer';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let displayName: string | null | undefined;
let tipsSeen: Role[] | undefined;

export function getDisplayName(): string | null {
  if (displayName === undefined) {
    const saved = readString(STORAGE_KEYS.displayName)?.trim();
    displayName = saved ? saved.slice(0, DISPLAY_NAME_MAX) : null;
  }
  return displayName;
}

export function setDisplayName(name: string) {
  displayName = name.trim();
  writeString(STORAGE_KEYS.displayName, displayName);
  notify();
}

export function useDisplayName(): string | null {
  return useSyncExternalStore(subscribe, getDisplayName, getDisplayName);
}

function getTipsSeen(): Role[] {
  tipsSeen ??= readJson<Role[]>(STORAGE_KEYS.tipsSeen, []);
  return tipsSeen;
}

export function markTipSeen(role: Role) {
  if (getTipsSeen().includes(role)) return;
  tipsSeen = [...getTipsSeen(), role];
  writeJson(STORAGE_KEYS.tipsSeen, tipsSeen);
  notify();
}

export function resetTips() {
  tipsSeen = [];
  writeJson(STORAGE_KEYS.tipsSeen, []);
  notify();
}

export function useTipSeen(role: Role): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getTipsSeen().includes(role),
    () => true,
  );
}

/** Test helper. */
export function resetPreferencesCache() {
  displayName = undefined;
  tipsSeen = undefined;
}
