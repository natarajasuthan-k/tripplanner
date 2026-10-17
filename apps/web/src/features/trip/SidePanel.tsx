import type { Day, Place } from '@tripplanner/shared';
import { Tabs } from 'radix-ui';
import { EarlierTripsList } from '../published/EarlierTripsList';
import { PlaceList } from './PlaceList';

const tabClass =
  'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white';

/** Places (F5) and Earlier trips (F6) — frontend-spec §3.3 side panel. */
export function SidePanel({
  destinationId,
  excludeSlug,
  days,
  onAddPlace,
}: {
  destinationId: string;
  excludeSlug?: string;
  days?: Day[];
  onAddPlace?: (day: Day, place: Place) => void;
}) {
  return (
    <Tabs.Root defaultValue="places" className="space-y-3">
      <Tabs.List
        aria-label="Ideas"
        className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900"
      >
        <Tabs.Trigger value="places" className={tabClass}>
          Places
        </Tabs.Trigger>
        <Tabs.Trigger value="earlier" className={tabClass}>
          Earlier trips
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="places">
        <PlaceList destinationId={destinationId} days={days} onAdd={onAddPlace} />
      </Tabs.Content>
      <Tabs.Content value="earlier">
        <EarlierTripsList destinationId={destinationId} excludeSlug={excludeSlug} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
