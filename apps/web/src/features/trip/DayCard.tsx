import { DAY_TEXT_MAX, DAY_TEXT_WARN, type Day, type Editor } from '@tripplanner/shared';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Check, Copy, Loader2, Pencil, RotateCcw } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { setCachedDay } from './api';
import { useDayAutosave, type SaveStatus } from './useDayAutosave';
import { usePresence } from './usePresence';

interface DayCardProps {
  token: string;
  day: Day;
  canEdit: boolean;
  editorName: string | null;
  /** Ask for a display name first (AC2.2); `then` runs after it is set. */
  requestName: (then: () => void) => void;
  onCompleted: () => void;
}

export function DayCard({
  token,
  day,
  canEdit,
  editorName,
  requestName,
  onCompleted,
}: DayCardProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const autosave = useDayAutosave({
    token,
    day,
    editorName,
    enabled: canEdit,
    onSaved: (saved) => setCachedDay(queryClient, token, saved),
    onCompleted,
  });
  usePresence(token, day.id, editorName, canEdit && focused);

  // Grow the textarea with its content.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`;
  }, [autosave.text]);

  const headingId = `day-${day.id}-heading`;
  const length = autosave.text.length;

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-semibold">
          Day {day.position}
          <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
            {format(parseISO(day.date), 'EEE d MMM')}
          </span>
        </h3>
        <PresenceIndicator editors={day.editors} />
        {canEdit && <SaveStatusText status={autosave.status} onRetry={autosave.retry} />}
      </header>

      {autosave.draft && canEdit && (
        <div className="mb-3">
          <Banner
            variant="warning"
            actions={
              <>
                <Button size="sm" onClick={autosave.restoreDraft}>
                  Restore
                </Button>
                <Button size="sm" variant="secondary" onClick={autosave.discardDraft}>
                  Discard
                </Button>
              </>
            }
          >
            You have unsaved text for this day from an earlier visit. Restore it?
          </Banner>
        </div>
      )}

      {canEdit ? (
        <>
          <label htmlFor={`day-${day.id}-text`} className="sr-only">
            Plans for day {day.position}
          </label>
          <textarea
            id={`day-${day.id}-text`}
            ref={textareaRef}
            value={autosave.text}
            maxLength={DAY_TEXT_MAX}
            readOnly={!editorName}
            placeholder={editorName ? 'Add plans, places, timings…' : 'Click to add plans…'}
            onChange={(e) => autosave.setText(e.target.value)}
            onFocus={() => {
              if (!editorName) {
                textareaRef.current?.blur();
                requestName(() => textareaRef.current?.focus());
                return;
              }
              setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
              autosave.flush();
            }}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 leading-relaxed outline-none focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus:border-teal-400 dark:focus:bg-slate-900"
          />
          <div className="mt-1 flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <LastEdited day={day} />
            <span className={length >= DAY_TEXT_WARN ? 'text-amber-600 dark:text-amber-400' : ''}>
              {length.toLocaleString()}/{DAY_TEXT_MAX.toLocaleString()}
            </span>
          </div>
        </>
      ) : (
        <>
          {day.text ? (
            <p className="leading-relaxed whitespace-pre-wrap">{day.text}</p>
          ) : (
            <p className="text-slate-400 italic dark:text-slate-500">Nothing planned yet.</p>
          )}
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <LastEdited day={day} />
          </div>
        </>
      )}

      {autosave.conflict && (
        <ConflictPanel
          mine={autosave.text}
          latest={autosave.conflict}
          onKeepMine={autosave.keepMine}
          onUseTheirs={autosave.useTheirs}
        />
      )}
    </article>
  );
}

function LastEdited({ day }: { day: Day }) {
  if (!day.updatedAt || !day.updatedByName) return <span />;
  return (
    <span>
      Last edited by {day.updatedByName} · {format(parseISO(day.updatedAt), 'd MMM, HH:mm')}
    </span>
  );
}

export function PresenceIndicator({ editors }: { editors: Editor[] }) {
  const names = [...new Set(editors.map((e) => e.displayName))];
  return (
    <span aria-live="polite" className="text-xs text-sky-700 dark:text-sky-300">
      {names.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Pencil className="size-3" aria-hidden />
          {names.length === 1
            ? `${names[0]} is editing…`
            : `${names[0]} and ${names.length - 1} other${names.length > 2 ? 's' : ''} are editing…`}
        </span>
      )}
    </span>
  );
}

const STATUS_TEXT: Partial<Record<SaveStatus, string>> = {
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  retrying: 'Saving failed — retrying…',
};

function SaveStatusText({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <span aria-live="polite" className="ml-auto text-xs text-slate-500 dark:text-slate-400">
      {status === 'error' ? (
        <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
          Not saved
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 underline"
          >
            <RotateCcw className="size-3" aria-hidden />
            Retry
          </button>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          {status === 'saving' && <Loader2 className="size-3 animate-spin" aria-hidden />}
          {status === 'saved' && <Check className="size-3 text-teal-600" aria-hidden />}
          {STATUS_TEXT[status] ?? ''}
        </span>
      )}
    </span>
  );
}

function ConflictPanel({
  mine,
  latest,
  onKeepMine,
  onUseTheirs,
}: {
  mine: string;
  latest: Day;
  onKeepMine: () => void;
  onUseTheirs: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <p className="mb-3 text-sm font-medium text-amber-900 dark:text-amber-200">
        {latest.updatedByName ?? 'Someone'} saved a newer version while you were editing. Which one
        should we keep?
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <VersionBox title="Your version" text={mine} />
        <VersionBox
          title={`Latest (${latest.updatedByName ?? 'someone else'})`}
          text={latest.text}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onKeepMine}>
          Keep mine
        </Button>
        <Button size="sm" variant="secondary" onClick={onUseTheirs}>
          Use theirs
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(mine);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy className="size-4" aria-hidden />
          {copied ? 'Copied' : 'Copy mine'}
        </Button>
      </div>
    </div>
  );
}

function VersionBox({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400">
        {title}
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg bg-white p-2 font-sans text-sm whitespace-pre-wrap dark:bg-slate-950">
        {text || <em className="text-slate-400">(empty)</em>}
      </pre>
    </div>
  );
}
