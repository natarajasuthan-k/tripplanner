// Safe browser-storage access (frontend-spec §5). Storage can be unavailable (private mode,
// blocked site data), so every access is wrapped and failures degrade to "no value".

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — storage is a convenience, never required
  }
}

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  displayName: 'tp.displayName',
  theme: 'tp.theme',
  myTrips: 'tp.myTrips',
  tipsSeen: 'tp.tipsSeen',
  draft: (dayId: string) => `tp.draft.${dayId}`,
} as const;
