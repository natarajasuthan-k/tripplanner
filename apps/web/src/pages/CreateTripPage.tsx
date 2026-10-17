// frontend-spec §3.2 — create a trip (F1), optionally with a recovery email (F10), from scratch
// or by copying a published plan (F12), with earlier trips to the destination alongside (F6).
import { addDays, type Destination } from '@tripplanner/shared';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { TripForm, type ServerFieldErrors, type TripFormValues } from '../features/create/TripForm';
import { usePublishedTrip } from '../features/published/api';
import { EarlierTripsList } from '../features/published/EarlierTripsList';
import { createTrip, tripKey } from '../features/trip/api';
import { isApiError } from '../lib/api';
import { rememberTrip } from '../lib/myTrips';

export interface CreatedState {
  emailedTo: string | null;
  emailFailed: boolean;
}

const FIELDS = new Set(['name', 'destination', 'fromDate', 'toDate', 'organiserEmail']);

export default function CreateTripPage() {
  const [params] = useSearchParams();
  const copyFrom = params.get('from');
  return copyFrom ? <CopyPlan slug={copyFrom} /> : <CreateLayout />;
}

function CopyPlan({ slug }: { slug: string }) {
  const source = usePublishedTrip(slug);
  if (source.isPending)
    return <p className="text-slate-600 dark:text-slate-400">Loading the plan to copy…</p>;
  if (source.isError) {
    return (
      <CreateLayout
        notice={
          <Banner variant="warning">
            That plan is no longer available to copy. You can still create a new trip.
          </Banner>
        }
      />
    );
  }
  const { trip } = source.data;
  const today = format(new Date(), 'yyyy-MM-dd');
  return (
    <CreateLayout
      copyFromSlug={trip.canonicalSlug}
      sourceDayCount={trip.dayCount}
      defaults={{
        destination: trip.destination,
        fromDate: today,
        toDate: addDays(today, trip.dayCount - 1),
      }}
      notice={<Banner>Copying the plan from “{trip.name}”. Pick a new name and dates.</Banner>}
    />
  );
}

function CreateLayout({
  copyFromSlug,
  sourceDayCount,
  defaults,
  notice,
}: {
  copyFromSlug?: string;
  sourceDayCount?: number;
  defaults?: { destination: Destination; fromDate: string; toDate: string };
  notice?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [destination, setDestination] = useState<Destination | null>(defaults?.destination ?? null);

  async function onSubmit(values: TripFormValues): Promise<ServerFieldErrors | void> {
    const email = values.organiserEmail || null;
    try {
      const res = await createTrip({
        name: values.name,
        destinationId: values.destination.id,
        fromDate: values.fromDate,
        toDate: values.toDate,
        organiserEmail: email,
        copyFromSlug: copyFromSlug ?? null,
      });
      const organiserToken = res.trip.links!.organiserToken!;
      queryClient.setQueryData(tripKey(organiserToken), { trip: res.trip, access: res.access });
      rememberTrip({ name: res.trip.name, role: 'organiser', token: organiserToken });
      const state: CreatedState = {
        emailedTo: res.emailSent ? email : null,
        emailFailed: res.emailSent === false,
      };
      navigate(`/o/${organiserToken}?created=1`, { state });
    } catch (err) {
      if (isApiError(err, 'TRIP_NAME_TAKEN')) return { name: err.message };
      if (isApiError(err, 'VALIDATION_ERROR')) {
        const fields = (err.details as { fields?: Record<string, string[]> } | null)?.fields ?? {};
        const out: ServerFieldErrors = {};
        for (const [key, messages] of Object.entries(fields)) {
          const field = key === 'destinationId' ? 'destination' : key;
          if (FIELDS.has(field)) out[field as keyof ServerFieldErrors] = messages[0];
        }
        return Object.keys(out).length ? out : { root: err.message };
      }
      if (isApiError(err)) return { root: err.message };
      return { root: 'Something went wrong. Please try again.' };
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,36rem)_1fr] lg:justify-center">
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {copyFromSlug ? 'Copy this plan' : 'Create a trip'}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            You’ll get links to share with your group — no sign-up needed.
          </p>
        </div>
        {notice}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TripForm
            mode={copyFromSlug ? 'copy' : 'create'}
            submitLabel="Create trip"
            busyLabel="Creating…"
            defaultValues={defaults}
            sourceDayCount={sourceDayCount}
            onDestinationChange={setDestination}
            onSubmit={onSubmit}
          />
        </div>
      </section>
      {destination && (
        <aside aria-labelledby="earlier-heading" className="hidden space-y-3 lg:block">
          <h2 id="earlier-heading" className="font-semibold">
            Earlier trips to {destination.name}
          </h2>
          <EarlierTripsList destinationId={destination.id} excludeSlug={copyFromSlug} />
        </aside>
      )}
    </div>
  );
}
