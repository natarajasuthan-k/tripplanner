// Destination search box — ARIA combobox pattern (frontend-spec §4, §8). Typed text alone is
// never a valid value: a suggestion must be chosen (frontend-spec §7, backend BR17).
import { SEARCH_QUERY_MIN, type Destination } from '@tripplanner/shared';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';
import { isApiError } from '../../lib/api';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { searchDestinations } from '../trip/api';
import { formatDestination } from './formatDestination';

interface Props {
  id: string;
  value: Destination | null;
  onChange: (value: Destination | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}

export const DestinationAutocomplete = forwardRef<HTMLInputElement, Props>(
  function DestinationAutocomplete({ id, value, onChange, onBlur, invalid, describedBy }, ref) {
    const listId = useId();
    const [text, setText] = useState(value ? formatDestination(value) : '');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const q = useDebouncedValue(text.trim(), 300);
    const searching = open && !value && q.length >= SEARCH_QUERY_MIN;

    const results = useQuery({
      queryKey: ['destinations', q.toLowerCase()],
      queryFn: ({ signal }) => searchDestinations(q, signal),
      enabled: searching,
      staleTime: 10 * 60_000,
      retry: false,
    });
    const items = searching ? (results.data?.items ?? []) : [];
    const expanded = searching && (items.length > 0 || results.isFetched || results.isError);

    function select(d: Destination) {
      onChange(d);
      setText(formatDestination(d));
      setOpen(false);
    }

    return (
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          ref={ref}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && items[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder="Search for a city…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
            onBlur?.();
          }}
          onKeyDown={(e) => {
            if (!expanded) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && items[active]) {
              e.preventDefault();
              select(items[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className={`w-full rounded-lg border bg-white py-2 pr-9 pl-9 dark:bg-slate-950 ${
            invalid ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
          }`}
        />
        {results.isFetching && searching && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400"
            aria-hidden
          />
        )}
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {results.isError ? (
              <li className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {isApiError(results.error, 'PROVIDER_UNAVAILABLE')
                  ? 'Destination search is unavailable right now. Please try again.'
                  : 'Couldn’t search destinations. Please try again.'}
              </li>
            ) : items.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No matching cities</li>
            ) : (
              items.map((d, i) => (
                <li
                  key={d.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(d);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    i === active ? 'bg-teal-50 dark:bg-teal-400/10' : ''
                  }`}
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {', '}
                    {[d.region !== d.name ? d.region : null, d.country].filter(Boolean).join(', ')}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  },
);
