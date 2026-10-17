// Per-tab session id sent as X-Session-Id (api-contract §1). Kept in memory only, so each tab
// gets its own id and presence never counts the current tab as "someone else editing".

let sessionId: string | null = null;

export function getSessionId(): string {
  sessionId ??= crypto.randomUUID().replace(/-/g, '');
  return sessionId;
}
