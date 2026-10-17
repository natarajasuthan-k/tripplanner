// Create-trip form — frontend-spec §3.2, §7; goal AC1.1–1.6.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  dayCountInclusive,
  destinationSchema,
  isIsoDate,
  isoDateSchema,
  TRIP_MAX_DAYS,
  TRIP_NAME_MAX,
  tripNameSchema,
  validateDateRange,
  type Destination,
} from '@tripplanner/shared';
import { format } from 'date-fns';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { DestinationAutocomplete } from './DestinationAutocomplete';

const formSchema = z
  .object({
    name: tripNameSchema,
    destination: destinationSchema
      .nullable()
      .refine((d) => d !== null, 'Please choose a destination from the list'),
    fromDate: z.string().min(1, 'Please choose a start date').pipe(isoDateSchema),
    toDate: z.string().min(1, 'Please choose an end date').pipe(isoDateSchema),
  })
  .superRefine((value, ctx) => {
    for (const issue of validateDateRange(value)) {
      ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
    }
  });

export type TripFormInput = z.input<typeof formSchema>;
export type TripFormValues = z.output<typeof formSchema> & { destination: Destination };
export type ServerFieldErrors = Partial<Record<keyof TripFormInput | 'root', string>>;

interface TripFormProps {
  submitLabel: string;
  onSubmit: (values: TripFormValues) => Promise<ServerFieldErrors | void>;
}

const inputClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-950 ${
    invalid ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
  }`;

export function TripForm({ submitLabel, onSubmit }: TripFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TripFormInput, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: { name: '', destination: null, fromDate: '', toDate: '' },
  });

  const fromDate = useWatch({ control, name: 'fromDate' });
  const toDate = useWatch({ control, name: 'toDate' });
  const dayCount =
    isIsoDate(fromDate) && isIsoDate(toDate) && toDate >= fromDate
      ? dayCountInclusive(fromDate, toDate)
      : null;
  const todayLocal = format(new Date(), 'yyyy-MM-dd');

  const submit = handleSubmit(async (values) => {
    const serverErrors = await onSubmit(values as TripFormValues);
    if (!serverErrors) return;
    for (const [field, message] of Object.entries(serverErrors)) {
      setError(field as keyof TripFormInput | 'root', { message }, { shouldFocus: true });
    }
  });

  const fieldError = (name: keyof TripFormInput) =>
    errors[name]?.message ? (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
        {errors[name]?.message}
      </p>
    ) : null;
  const describedBy = (name: keyof TripFormInput) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-1 block font-medium">
          Trip name
        </label>
        <input
          id="name"
          maxLength={TRIP_NAME_MAX}
          placeholder="e.g. Kyoto Winter 2026"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name')}
          className={inputClass(!!errors.name)}
          {...register('name')}
        />
        {fieldError('name')}
      </div>

      <div>
        <label htmlFor="destination" className="mb-1 block font-medium">
          Destination
        </label>
        <Controller
          control={control}
          name="destination"
          render={({ field }) => (
            <DestinationAutocomplete
              id="destination"
              ref={field.ref}
              value={field.value as Destination | null}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={!!errors.destination}
              describedBy={describedBy('destination')}
            />
          )}
        />
        {fieldError('destination')}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fromDate" className="mb-1 block font-medium">
            From
          </label>
          <input
            id="fromDate"
            type="date"
            min={todayLocal}
            aria-invalid={errors.fromDate ? true : undefined}
            aria-describedby={describedBy('fromDate')}
            className={inputClass(!!errors.fromDate)}
            {...register('fromDate', { deps: ['toDate'] })}
          />
          {fieldError('fromDate')}
        </div>
        <div>
          <label htmlFor="toDate" className="mb-1 block font-medium">
            To
          </label>
          <input
            id="toDate"
            type="date"
            min={fromDate || todayLocal}
            aria-invalid={errors.toDate ? true : undefined}
            aria-describedby={describedBy('toDate')}
            className={inputClass(!!errors.toDate)}
            {...register('toDate')}
          />
          {fieldError('toDate')}
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {dayCount !== null
          ? `${dayCount} day${dayCount === 1 ? '' : 's'}${dayCount > TRIP_MAX_DAYS ? ` — the maximum is ${TRIP_MAX_DAYS}` : ''}`
          : `Up to ${TRIP_MAX_DAYS} days.`}
      </p>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Creating…' : submitLabel}
      </Button>
    </form>
  );
}
