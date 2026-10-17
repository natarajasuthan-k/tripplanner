// Edit name / destination / dates — frontend-spec §3.3, §7 "Edit Trip"; goal AC10.1–10.4.
import type { DaysWouldBeRemovedDetails, RemovedDay, TripView } from '@tripplanner/shared';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toaster';
import { isApiError } from '../../lib/api';
import { TripForm, type ServerFieldErrors, type TripFormValues } from '../create/TripForm';
import { tripKey, updateTrip } from './api';

type Pending = { body: Parameters<typeof updateTrip>[1]; removedDays: RemovedDay[] };

export function EditTripDialog({
  open,
  onOpenChange,
  token,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  trip: TripView;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Pending['body']): Promise<ServerFieldErrors | void> {
    try {
      const res = await updateTrip(token, body);
      queryClient.setQueryData(tripKey(token), res);
      setPending(null);
      onOpenChange(false);
      toast.show('Trip updated');
    } catch (err) {
      if (isApiError(err, 'DAYS_WOULD_BE_REMOVED')) {
        setPending({ body, removedDays: (err.details as DaysWouldBeRemovedDetails).removedDays });
        return;
      }
      if (isApiError(err, 'TRIP_NAME_TAKEN')) return { name: err.message };
      if (isApiError(err, 'TRIP_VERSION_CONFLICT')) {
        await queryClient.invalidateQueries({ queryKey: tripKey(token) });
        onOpenChange(false);
        toast.show('This trip was changed elsewhere — please review and try again.', 'error');
        return;
      }
      if (isApiError(err, 'VALIDATION_ERROR')) {
        const fields = (err.details as { fields?: Record<string, string[]> } | null)?.fields ?? {};
        const out: ServerFieldErrors = {};
        for (const [k, v] of Object.entries(fields)) {
          out[(k === 'destinationId' ? 'destination' : k) as keyof ServerFieldErrors] = v[0];
        }
        return Object.keys(out).length ? out : { root: err.message };
      }
      return { root: isApiError(err) ? err.message : 'Couldn’t save the changes.' };
    }
  }

  function onSubmit(values: TripFormValues) {
    const body: Pending['body'] = { version: trip.version };
    if (values.name !== trip.name) body.name = values.name;
    if (values.destination.id !== trip.destination.id) body.destinationId = values.destination.id;
    if (values.fromDate !== trip.fromDate) body.fromDate = values.fromDate;
    if (values.toDate !== trip.toDate) body.toDate = values.toDate;
    if (Object.keys(body).length === 1) {
      onOpenChange(false);
      return Promise.resolve();
    }
    return send(body);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPending(null);
        onOpenChange(o);
      }}
      title={pending ? 'Remove days with plans?' : 'Edit trip details'}
      description={
        pending
          ? 'The new dates are shorter. These days have plans that will be deleted:'
          : 'Day plans stay with their day number — Day 1 stays Day 1 when you move the dates.'
      }
    >
      {pending ? (
        <ShrinkDatesConfirm
          removedDays={pending.removedDays}
          busy={busy}
          onBack={() => setPending(null)}
          onConfirm={async () => {
            setBusy(true);
            await send({ ...pending.body, confirmRemoveDays: true });
            setBusy(false);
          }}
        />
      ) : (
        <TripForm
          key={`${trip.version}-${open}`}
          mode="edit"
          submitLabel="Save changes"
          defaultValues={{
            name: trip.name,
            destination: trip.destination,
            fromDate: trip.fromDate,
            toDate: trip.toDate,
          }}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/** Lists the days that would lose their plans (AC10.2). */
export function ShrinkDatesConfirm({
  removedDays,
  busy,
  onBack,
  onConfirm,
}: {
  removedDays: RemovedDay[];
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {removedDays.map((d) => (
          <li
            key={d.position}
            className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm dark:border-red-500/30 dark:bg-red-500/10"
          >
            <p className="font-medium">
              Day {d.position} · {format(parseISO(d.date), 'EEE d MMM')}
            </p>
            <p className="truncate text-slate-600 dark:text-slate-300">{d.textPreview}</p>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Saving…' : 'Remove days and save'}
        </Button>
      </div>
    </div>
  );
}
