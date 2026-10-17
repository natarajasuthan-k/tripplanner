// frontend-spec §3.3 for /explore/:slug — read-only published plan (F4, AC6.2) with
// "Copy this plan" (F12) and old-slug redirect (AC5.3).
import type { Day } from '@tripplanner/shared';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Copy, MapPin } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { NotFoundView } from '../components/NotFoundView';
import { buttonClass } from '../components/ui/buttonClass';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePublishedTrip } from '../features/published/api';
import { formatShortRange } from '../lib/formatDates';
import { SidePanel } from '../features/trip/SidePanel';
import { ApiError } from '../lib/api';

export default function PublishedTripPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const query = usePublishedTrip(slug);
  const canonical = query.data?.trip.canonicalSlug;

  useEffect(() => {
    if (canonical && canonical !== slug) navigate(`/explore/${canonical}`, { replace: true });
  }, [canonical, slug, navigate]);

  if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundView />;
  if (query.isError) {
    return (
      <p className="py-12 text-center text-slate-600 dark:text-slate-400">
        Couldn’t load this trip.
      </p>
    );
  }
  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
      />
    );
  }

  const { trip, access } = query.data;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {trip.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden />
              {trip.destination.name}, {trip.destination.country}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              {formatShortRange(trip.fromDate, trip.toDate)} · {trip.dayCount} day
              {trip.dayCount === 1 ? '' : 's'}
            </span>
          </p>
          <div className="flex gap-2 pt-1">
            <StatusBadge kind="published" />
            {trip.status.isCompleted && <StatusBadge kind="completed" />}
          </div>
        </div>
        {access.permissions.canCopyPlan && (
          <Link
            to={`/new?from=${encodeURIComponent(trip.canonicalSlug)}`}
            className={buttonClass('primary', 'sm')}
          >
            <Copy className="size-4" aria-hidden />
            Copy this plan
          </Link>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Day plans" className="space-y-4">
          {trip.days.map((day) => (
            <ReadOnlyDay key={day.id} day={day} />
          ))}
        </section>
        <aside aria-label="Ideas" className="lg:sticky lg:top-20 lg:self-start">
          <SidePanel destinationId={trip.destination.id} excludeSlug={trip.canonicalSlug} />
        </aside>
      </div>
    </div>
  );
}

function ReadOnlyDay({ day }: { day: Day }) {
  return (
    <article
      aria-labelledby={`pday-${day.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 id={`pday-${day.id}`} className="mb-2 font-semibold">
        Day {day.position}
        <span className="ml-2 font-normal text-slate-600 dark:text-slate-400">
          {format(parseISO(day.date), 'EEE d MMM')}
        </span>
      </h3>
      {day.text ? (
        <p className="leading-relaxed whitespace-pre-wrap">{day.text}</p>
      ) : (
        <p className="text-slate-600 italic dark:text-slate-400">Nothing planned for this day.</p>
      )}
    </article>
  );
}
