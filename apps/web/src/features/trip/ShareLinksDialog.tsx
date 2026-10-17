import type { TripLinks } from '@tripplanner/shared';
import { Check, Copy, KeyRound, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toaster';
import { buildShareLinks, type ShareLink } from '../../lib/shareLinks';

/** Edit + view-only links for everyone who may share; organiser link only for the organiser (AC1.1, AC2.8). */
export function ShareLinksDialog({
  open,
  onOpenChange,
  links,
  tripName,
  justCreated = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: TripLinks;
  tripName: string;
  justCreated?: boolean;
}) {
  const shareLinks = buildShareLinks(links);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={justCreated ? 'Your trip is ready!' : 'Share this trip'}
      description={
        justCreated
          ? 'Send the edit link to fellow travellers. Bookmark your organiser link — it’s also saved on this device.'
          : 'Anyone with a link can open the trip — no sign-up needed.'
      }
    >
      <ul className="space-y-3">
        {shareLinks.map((link) => (
          <ShareLinkRow key={link.kind} link={link} tripName={tripName} />
        ))}
      </ul>
      <div className="mt-5 flex justify-end">
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </div>
    </Dialog>
  );
}

function ShareLinkRow({ link, tripName }: { link: ShareLink; tripName: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const organiser = link.kind === 'organiser';
  const canShare = typeof navigator.share === 'function' && !organiser;

  return (
    <li
      className={`rounded-xl border p-3 ${
        organiser
          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 font-medium">
        {organiser && <KeyRound className="size-4 text-amber-600" aria-hidden />}
        {link.label}
      </div>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">{link.hint}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link.url}
          aria-label={link.label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Copy ${link.label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
              toast.show('Link copied');
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.show('Couldn’t copy — select the link and copy it manually.', 'error');
            }
          }}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
        {canShare && (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Share ${link.label}`}
            onClick={() =>
              navigator.share({ title: tripName, url: link.url }).catch(() => undefined)
            }
          >
            <Share2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}
