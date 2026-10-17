import { SEARCH_QUERY_MIN } from '@tripplanner/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { buttonClass } from '../components/ui/buttonClass';
import { usePublishedInfinite } from '../features/published/api';
import { TripCard } from '../features/published/TripCard';
import { useDebouncedValue } from '../lib/useDebouncedValue';

/** frontend-spec §3.5 — published trips directory (F4, AC6.1). */
export default function ExplorePage() {
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text.trim(), 300);
  const q = debounced.length >= SEARCH_QUERY_MIN ? debounced : undefined;
  const query = usePublishedInfinite({ q });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Published trips</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Plans shared by other travellers — open one for ideas or copy it as a starting point.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <label htmlFor="explore-search" className="sr-only">
          Search by destination or trip name
        </label>
        <input
          id="explore-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by destination or trip name"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      {query.isPending ? (
        <ul aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </ul>
      ) : query.isError ? (
        <div className="space-y-2">
          <p className="text-slate-600 dark:text-slate-300">Couldn’t load published trips.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        q ? (
          <p className="text-slate-600 dark:text-slate-300">No trips match “{q}”.</p>
        ) : (
          <div className="space-y-3 py-6 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              No published trips yet — be the first!
            </p>
            <Link to="/new" className={buttonClass('primary')}>
              Plan a trip
            </Link>
          </div>
        )
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((trip) => (
              <li key={trip.slug}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
