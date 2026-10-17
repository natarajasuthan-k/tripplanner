import { Lightbulb, X } from 'lucide-react';
import { markTipSeen, useTipSeen } from '../../lib/preferences';

type Role = 'organiser' | 'editor' | 'viewer';

const TIPS: Record<Role, string> = {
  organiser:
    'You’re the organiser. Use Share to invite travellers (edit link) or viewers (view-only link). Keep this organiser link private — it controls the trip. We’ve saved it on this device under “Your trips”.',
  editor:
    'You can edit any day — changes save automatically. Use Share to invite others to the trip.',
  viewer: 'This is a read-only view of the plan.',
};

/** First-visit tip per role, dismissible for good on this device (AC16.3–16.4). */
export function RoleTip({
  role,
  hasRecoveryEmail = true,
}: {
  role: Role;
  hasRecoveryEmail?: boolean;
}) {
  const seen = useTipSeen(role);
  if (seen) return null;
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100"
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1">
        {TIPS[role]}
        {role === 'organiser' && !hasRecoveryEmail && (
          <> Next time, add your email when creating a trip so you can recover the link anywhere.</>
        )}
      </p>
      <button
        type="button"
        aria-label="Dismiss tip"
        onClick={() => markTipSeen(role)}
        className="-m-1 rounded-md p-1 hover:bg-teal-100 dark:hover:bg-teal-400/20"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
