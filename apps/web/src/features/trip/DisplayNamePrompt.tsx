import { displayNameSchema, DISPLAY_NAME_MAX } from '@tripplanner/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

/** Asks for a display name before the first edit; stored on this device (AC2.2). */
export function DisplayNamePrompt({
  open,
  onOpenChange,
  onSubmit,
  initial = '',
  title = 'What should we call you?',
  description = 'Your name appears next to your edits so the group knows who added what. It’s saved on this device only.',
  submitLabel = 'Continue',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  initial?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = displayNameSchema.safeParse(value);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Please enter your name');
            return;
          }
          onSubmit(parsed.data);
        }}
      >
        <label htmlFor="display-name" className="mb-1 block text-sm font-medium">
          Your name
        </label>
        <input
          id="display-name"
          autoFocus
          value={value}
          maxLength={DISPLAY_NAME_MAX}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'display-name-error' : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        {error && (
          <p id="display-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}
