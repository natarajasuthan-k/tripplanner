import type { Day, Place } from '@tripplanner/shared';
import { format, parseISO } from 'date-fns';
import { ExternalLink, Plus } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { isApiError } from '../../lib/api';
import { usePlaces } from '../published/api';

interface PlaceListProps {
  destinationId: string;
  /** Days that can receive a place; omit for read-only views. */
  days?: Day[];
  onAdd?: (day: Day, place: Place) => void;
}

/** Places of interest for the destination (F5, AC3.1–3.3). Never blocks the page. */
export function PlaceList({ destinationId, days, onAdd }: PlaceListProps) {
  const query = usePlaces(destinationId);

  if (query.isPending) {
    return (
      <ul aria-busy="true" className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
        <p>
          {isApiError(query.error, 'PROVIDER_UNAVAILABLE')
            ? 'Suggestions unavailable right now.'
            : 'Couldn’t load suggestions.'}
        </p>
        <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const { items, attribution } = query.data;
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No suggestions for this place yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((place) => (
            <li
              key={place.id}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{place.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {place.categoryLabel}
                  </p>
                  {place.description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {place.description}
                    </p>
                  )}
                  {(place.wikipediaUrl ?? place.sourceUrl) && (
                    <a
                      href={(place.wikipediaUrl ?? place.sourceUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-teal-700 hover:underline dark:text-teal-300"
                    >
                      {place.wikipediaUrl ? 'Wikipedia' : 'Source'}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
                {days && onAdd && days.length > 0 && (
                  <AddToDayPopover place={place} days={days} onPick={(day) => onAdd(day, place)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {query.data.stale ? 'Showing saved suggestions. ' : ''}
        {attribution}
      </p>
    </div>
  );
}

function AddToDayPopover({
  place,
  days,
  onPick,
}: {
  place: Place;
  days: Day[];
  onPick: (day: Day) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="secondary" aria-label={`Add ${place.name} to plan`}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden xl:inline">Add</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-50 max-h-72 w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Add to which day?
          </p>
          <ul>
            {days.map((day) => (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(day);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-teal-50 dark:hover:bg-teal-400/10"
                >
                  Day {day.position}
                  <span className="ml-1 text-slate-600 dark:text-slate-400">
                    · {format(parseISO(day.date), 'EEE d MMM')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
