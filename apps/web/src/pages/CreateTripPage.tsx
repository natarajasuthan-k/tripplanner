import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { TripForm, type ServerFieldErrors, type TripFormValues } from '../features/create/TripForm';
import { createTrip, tripKey } from '../features/trip/api';
import { isApiError } from '../lib/api';
import { rememberTrip } from '../lib/myTrips';

/** frontend-spec §3.2 — F1 (copying a plan, F12, arrives in Phase 2). */
export default function CreateTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const copyFrom = params.get('from');

  async function onSubmit(values: TripFormValues): Promise<ServerFieldErrors | void> {
    try {
      const res = await createTrip({
        name: values.name,
        destinationId: values.destination.id,
        fromDate: values.fromDate,
        toDate: values.toDate,
      });
      const organiserToken = res.trip.links!.organiserToken!;
      queryClient.setQueryData(tripKey(organiserToken), { trip: res.trip, access: res.access });
      rememberTrip({ name: res.trip.name, role: 'organiser', token: organiserToken });
      navigate(`/o/${organiserToken}?created=1`);
    } catch (err) {
      if (isApiError(err, 'TRIP_NAME_TAKEN')) return { name: err.message };
      if (isApiError(err, 'VALIDATION_ERROR')) {
        const fields = (err.details as { fields?: Record<string, string[]> } | null)?.fields ?? {};
        const out: ServerFieldErrors = {};
        for (const [key, messages] of Object.entries(fields)) {
          const field = key === 'destinationId' ? 'destination' : key;
          if (field in { name: 1, destination: 1, fromDate: 1, toDate: 1 }) {
            out[field as keyof ServerFieldErrors] = messages[0];
          }
        }
        return Object.keys(out).length ? out : { root: err.message };
      }
      if (isApiError(err)) return { root: err.message };
      return { root: 'Something went wrong. Please try again.' };
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a trip</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          You’ll get links to share with your group — no sign-up needed.
        </p>
      </div>
      {copyFrom && (
        <Banner>Copying a published plan is coming soon. You can still create a new trip.</Banner>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TripForm submitLabel="Create trip" onSubmit={onSubmit} />
      </div>
    </section>
  );
}
