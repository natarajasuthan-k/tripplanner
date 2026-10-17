import type { DeleteRequestView } from '@tripplanner/shared';
import { format, parseISO } from 'date-fns';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';

/** Organiser banner for pending delete requests (AC7.2–7.3). */
export function DeleteRequestsBanner({
  requests,
  onApprove,
  onDismiss,
}: {
  requests: DeleteRequestView[];
  onApprove: () => void;
  onDismiss: () => void;
}) {
  if (requests.length === 0) return null;
  const [latest, ...others] = requests;
  const when = (r: DeleteRequestView) => format(parseISO(r.createdAt), 'd MMM, HH:mm');

  return (
    <Banner
      variant="action"
      actions={
        <>
          <Button size="sm" variant="danger" onClick={onApprove}>
            Approve (delete)
          </Button>
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Dismiss all
          </Button>
        </>
      }
    >
      {others.length === 0 ? (
        <>
          <strong>{latest!.requestedByName}</strong> asked to delete this trip on {when(latest!)}.
        </>
      ) : (
        <details>
          <summary className="cursor-pointer">
            <strong>{latest!.requestedByName}</strong> and {others.length} other
            {others.length > 1 ? 's' : ''} asked to delete this trip.
          </summary>
          <ul className="mt-2 list-disc pl-5">
            {requests.map((r) => (
              <li key={r.id}>
                {r.requestedByName} — {when(r)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Banner>
  );
}
