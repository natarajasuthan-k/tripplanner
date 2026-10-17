import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { forgetTrip, sortForDisplay, useMyTrips, type MyTripRole } from '../../lib/myTrips';

const PREFIX: Record<MyTripRole, string> = { organiser: 'o', editor: 'e', viewer: 'v' };

/** "Your trips on this device" — F11, AC13.1–13.3. Hidden when empty. */
export function MyTripsList() {
  const trips = sortForDisplay(useMyTrips());
  if (trips.length === 0) return null;

  return (
    <section aria-labelledby="my-trips-heading" className="space-y-3">
      <h2 id="my-trips-heading" className="text-lg font-semibold">
        Your trips on this device
      </h2>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {trips.map((t) => (
          <li key={t.token} className="flex items-center gap-3 p-3">
            <Link
              to={`/${PREFIX[t.role]}/${t.token}`}
              className="min-w-0 flex-1 rounded-md hover:underline"
            >
              <span className="block truncate font-medium">{t.name}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Last opened {format(parseISO(t.lastOpenedAt), 'd MMM yyyy')}
              </span>
            </Link>
            <StatusBadge kind={t.role} />
            <button
              type="button"
              onClick={() => forgetTrip(t.token)}
              aria-label={`Remove ${t.name} from this device`}
              title="Remove from this device"
              className="rounded-md p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Removing a trip here only forgets it on this device — it doesn’t delete the trip.
      </p>
    </section>
  );
}
