import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** "You're offline" strip (frontend-spec §9). Autosave keeps drafts and retries meanwhile. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <WifiOff className="size-4" aria-hidden />
      You’re offline — changes are kept on this device and will save when you reconnect.
    </div>
  );
}
