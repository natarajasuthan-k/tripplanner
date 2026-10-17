import type { TripSummary } from '@tripplanner/shared';
import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatShortRange } from '../../lib/formatDates';

/** Card for a published trip (frontend-spec §4). */
export function TripCard({ trip, compact = false }: { trip: TripSummary; compact?: boolean }) {
  return (
    <Link
      to={`/explore/${trip.slug}`}
      className={`block rounded-2xl border border-slate-200 bg-white transition hover:border-teal-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className={`font-semibold break-words ${compact ? 'text-sm' : ''}`}>{trip.name}</h3>
        {trip.isCompleted && <StatusBadge kind="completed" />}
      </div>
      <p className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {trip.destination.name}, {trip.destination.country}
      </p>
      <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
        {formatShortRange(trip.fromDate, trip.toDate)} · {trip.dayCount} day
        {trip.dayCount === 1 ? '' : 's'}
      </p>
    </Link>
  );
}
