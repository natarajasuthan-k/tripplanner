// Tracks days with unsaved/in-flight/failed edits so the page can warn before leaving
// (frontend-spec §8 "Leaving with unsaved text").
import { useSyncExternalStore } from 'react';

const unsaved = new Set<string>();
const listeners = new Set<() => void>();
let snapshot = 0;

function notify() {
  snapshot++;
  listeners.forEach((l) => l());
}

export function setUnsaved(dayId: string, value: boolean) {
  const had = unsaved.has(dayId);
  if (value && !had) unsaved.add(dayId);
  else if (!value && had) unsaved.delete(dayId);
  else return;
  notify();
}

export function hasUnsaved(): boolean {
  return unsaved.size > 0;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useHasUnsaved(): boolean {
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  return unsaved.size > 0;
}
