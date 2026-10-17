// "Add to plan" (AC3.2) → the target DayCard appends the line through its own autosave, so the
// change goes through the same version check as typing.
type Listener = (line: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function onAppendToDay(dayId: string, listener: Listener): () => void {
  let set = listeners.get(dayId);
  if (!set) listeners.set(dayId, (set = new Set()));
  set.add(listener);
  return () => set.delete(listener);
}

export function appendToDay(dayId: string, line: string): boolean {
  const set = listeners.get(dayId);
  if (!set || set.size === 0) return false;
  set.forEach((l) => l(line));
  return true;
}

/** Text added for a place — frontend-spec §7 "Add to plan". */
export const placeLine = (name: string, categoryLabel: string) => `• ${name} (${categoryLabel})`;

/** Append `line` on a new line, unless the text is empty. */
export const withLine = (text: string, line: string) =>
  text.trim() === '' ? line : `${text.replace(/\s+$/, '')}\n${line}`;
