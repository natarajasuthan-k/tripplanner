// Trip form for create, copy and edit — frontend-spec §3.2, §7; goal AC1.1–1.6, AC10.1,
// AC12.1–12.2, AC14.3.
import { zodResolver } from '@hookform/resolvers/zod';
import {
  dayCountInclusive,
  destinationSchema,
  EMAIL_MAX,
  isIsoDate,
  isoDateSchema,
  TRIP_MAX_DAYS,
  TRIP_NAME_MAX,
  tripNameSchema,
  validateDateRange,
  type Destination,
} from '@tripplanner/shared';
import { format } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { DestinationAutocomplete } from './DestinationAutocomplete';

export type TripFormMode = 'create' | 'copy' | 'edit';

function makeSchema(mode: TripFormMode, originalFromDate?: string) {
  return z
    .object({
      name: tripNameSchema,
      destination: destinationSchema
        .nullable()
        .refine((d) => d !== null, 'Please choose a destination from the list'),
      fromDate: z.string().min(1, 'Please choose a start date').pipe(isoDateSchema),
      toDate: z.string().min(1, 'Please choose an end date').pipe(isoDateSchema),
      organiserEmail: z
        .string()
        .trim()
        .max(EMAIL_MAX, `Email must be at most ${EMAIL_MAX} characters`)
        .refine(
          (v) => v === '' || z.email().safeParse(v).success,
          'Please enter a valid email address',
        ),
    })
    .superRefine((value, ctx) => {
      // Editing: an unchanged past From date is allowed for trips under way (goal Q24).
      const allowPastFrom = mode === 'edit' && value.fromDate === originalFromDate;
      for (const issue of validateDateRange(value, new Date(), { allowPastFrom })) {
        ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message });
      }
    });
}

type Schema = ReturnType<typeof makeSchema>;
export type TripFormInput = z.input<Schema>;
export type TripFormValues = z.output<Schema> & { destination: Destination };
export type ServerFieldErrors = Partial<Record<keyof TripFormInput | 'root', string>>;

interface TripFormProps {
  mode?: TripFormMode;
  submitLabel: string;
  busyLabel?: string;
  defaultValues?: Partial<Omit<TripFormInput, 'organiserEmail'>>;
  /** Copy mode: number of days in the source plan, to warn when fewer are copied (AC14.3). */
  sourceDayCount?: number;
  onDestinationChange?: (destination: Destination | null) => void;
  onSubmit: (values: TripFormValues) => Promise<ServerFieldErrors | void>;
  onCancel?: () => void;
}

const inputClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 dark:bg-slate-950 ${
    invalid ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
  }`;

export function TripForm({
  mode = 'create',
  submitLabel,
  busyLabel = 'Saving…',
  defaultValues,
  sourceDayCount,
  onDestinationChange,
  onSubmit,
  onCancel,
}: TripFormProps) {
  const originalFromDate = mode === 'edit' ? defaultValues?.fromDate : undefined;
  const schema = useMemo(() => makeSchema(mode, originalFromDate), [mode, originalFromDate]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TripFormInput, unknown, z.output<Schema>>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      destination: null,
      fromDate: '',
      toDate: '',
      organiserEmail: '',
      ...defaultValues,
    },
  });

  const fromDate = useWatch({ control, name: 'fromDate' });
  const toDate = useWatch({ control, name: 'toDate' });
  const destination = useWatch({ control, name: 'destination' }) as Destination | null;
  useEffect(() => onDestinationChange?.(destination), [destination, onDestinationChange]);

  const dayCount =
    isIsoDate(fromDate) && isIsoDate(toDate) && toDate >= fromDate
      ? dayCountInclusive(fromDate, toDate)
      : null;
  const todayLocal = format(new Date(), 'yyyy-MM-dd');
  const notCopied =
    sourceDayCount && dayCount !== null && dayCount < sourceDayCount
      ? sourceDayCount - dayCount
      : 0;

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
  const describedBy = (name: keyof TripFormInput, hint?: string) =>
    [errors[name] ? `${name}-error` : null, hint].filter(Boolean).join(' ') || undefined;

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
            min={
              mode === 'edit' && originalFromDate && originalFromDate < todayLocal
                ? undefined
                : todayLocal
            }
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
      <div aria-live="polite" className="space-y-1 text-sm">
        <p className="text-slate-500 dark:text-slate-400">
          {dayCount !== null
            ? `${dayCount} day${dayCount === 1 ? '' : 's'}${dayCount > TRIP_MAX_DAYS ? ` — the maximum is ${TRIP_MAX_DAYS}` : ''}`
            : `Up to ${TRIP_MAX_DAYS} days.`}
        </p>
        {notCopied > 0 && (
          <p className="text-amber-700 dark:text-amber-300">
            {notCopied} day{notCopied === 1 ? '' : 's'} from the original won’t be copied.
          </p>
        )}
      </div>

      {mode !== 'edit' && (
        <div>
          <label htmlFor="organiserEmail" className="mb-1 block font-medium">
            Your email <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="organiserEmail"
            type="email"
            autoComplete="email"
            maxLength={EMAIL_MAX}
            placeholder="you@example.com"
            aria-invalid={errors.organiserEmail ? true : undefined}
            aria-describedby={describedBy('organiserEmail', 'organiserEmail-hint')}
            className={inputClass(!!errors.organiserEmail)}
            {...register('organiserEmail')}
          />
          <p id="organiserEmail-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            We’ll email you the organiser link so you never lose it. Used for nothing else.
          </p>
          {fieldError('organiserEmail')}
        </div>
      )}

      {errors.root?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors.root.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? busyLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
