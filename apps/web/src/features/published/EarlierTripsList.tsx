import { usePublishedTrips } from './api';
import { TripCard } from './TripCard';

/** Published trips to the same destination, newest first (F6, AC4.1–4.2). */
export function EarlierTripsList({
  destinationId,
  excludeSlug,
}: {
  destinationId: string;
  excludeSlug?: string;
}) {
  const query = usePublishedTrips({ destinationId, excludeSlug, limit: 10 });

  if (query.isPending) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Loading earlier trips…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Couldn’t load earlier trips.</p>
    );
  }
  if (query.data.items.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">No earlier trips yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {query.data.items.map((trip) => (
        <li key={trip.slug}>
          <TripCard trip={trip} compact />
        </li>
      ))}
    </ul>
  );
}
