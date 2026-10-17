import { emailSchema, EMAIL_MAX, RECOVER_MESSAGE } from '@tripplanner/shared';
import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { recoverLinks } from '../features/published/api';
import { isApiError } from '../lib/api';

/** frontend-spec §3.6 — "Forgot my link" (F10, AC12.4–12.5). */
export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      await recoverLinks(parsed.data);
      setSent(true);
    } catch (err) {
      setError(
        isApiError(err, 'RATE_LIMITED')
          ? 'Please wait before trying again.'
          : isApiError(err)
            ? err.message
            : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot my link</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Enter the email you gave when creating your trips. We’ll send you the organiser links.
        </p>
      </div>
      {sent ? (
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-teal-900 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100"
        >
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{RECOVER_MESSAGE} Check your inbox (and spam).</p>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-3">
          <label htmlFor="recover-email" className="block font-medium">
            Email
          </label>
          <input
            id="recover-email"
            type="email"
            autoComplete="email"
            maxLength={EMAIL_MAX}
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'recover-error' : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          {error && (
            <p id="recover-error" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send my links'}
          </Button>
        </form>
      )}
    </section>
  );
}
