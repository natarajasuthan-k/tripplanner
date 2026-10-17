// Autosave state machine for one day — frontend-spec §3.4, goal AC2.3, AC2.4, AC2.7.
//
// - Saves 1s after typing stops, and immediately on flush (blur).
// - One request in flight per day; edits made meanwhile are sent when it finishes.
// - Sends the version the local text is based on; a 409 pauses autosave and exposes `conflict`.
// - Network/5xx/429 failures retry after 2s, 5s, 10s, then show "Not saved — Retry".
// - Text is mirrored to localStorage until acknowledged, so nothing is lost on reload.
import type { Day, DayConflictDetails } from '@tripplanner/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { readJson, remove, STORAGE_KEYS, writeJson } from '../../lib/storage';
import { saveDay } from './api';
import { setUnsaved } from './unsaved';

export const AUTOSAVE_DELAY_MS = 1000;
export const RETRY_DELAYS_MS = [2000, 5000, 10000];

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'retrying' | 'error' | 'conflict';

interface Draft {
  text: string;
  baseVersion: number;
  savedAt: string;
}

export interface UseDayAutosaveOptions {
  token: string;
  day: Day;
  editorName: string | null;
  enabled: boolean;
  onSaved: (day: Day) => void;
  onCompleted?: () => void;
}

export function useDayAutosave({
  token,
  day,
  editorName,
  enabled,
  onSaved,
  onCompleted,
}: UseDayAutosaveOptions) {
  const [text, setTextState] = useState(day.text);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [conflict, setConflict] = useState<Day | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => {
    const saved = readJson<Draft | null>(STORAGE_KEYS.draft(day.id), null);
    return saved && saved.text !== day.text ? saved : null;
  });

  const textRef = useRef(day.text);
  const baseRef = useRef({ text: day.text, version: day.version });
  const inFlight = useRef(false);
  const pending = useRef(false);
  const conflictRef = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCount = useRef(0);
  // Lets `save` re-invoke itself (retries, queued edits) without a self-reference.
  const saveRef = useRef<() => Promise<void>>(async () => {});
  // Latest props for async callbacks, updated after each render.
  const opts = useRef({ token, editorName, enabled, onSaved, onCompleted });
  useLayoutEffect(() => {
    opts.current = { token, editorName, enabled, onSaved, onCompleted };
  });

  const isDirty = () => textRef.current !== baseRef.current.text;

  const updateUnsaved = useCallback(
    (s: SaveStatus) => {
      setUnsaved(day.id, isDirty() || s === 'saving' || s === 'retrying' || s === 'conflict');
    },
    [day.id],
  );

  const setStatusTracked = useCallback(
    (s: SaveStatus) => {
      setStatus(s);
      updateUnsaved(s);
    },
    [updateUnsaved],
  );

  const save = useCallback(async (): Promise<void> => {
    const { token: tk, editorName: name, enabled: on } = opts.current;
    if (!on || !name || conflictRef.current) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    const sent = textRef.current;
    if (sent === baseRef.current.text) return;

    clearTimeout(debounce.current);
    clearTimeout(retryTimer.current);
    inFlight.current = true;
    setStatusTracked('saving');
    try {
      const { day: saved } = await saveDay(tk, day.id, {
        text: sent,
        version: baseRef.current.version,
        editorName: name,
      });
      retryCount.current = 0;
      baseRef.current = { text: saved.text, version: saved.version };
      if (textRef.current === sent) {
        // Adopt the server's normalised text (e.g. stripped control characters).
        textRef.current = saved.text;
        setTextState(saved.text);
        remove(STORAGE_KEYS.draft(day.id));
        setStatusTracked('saved');
      } else {
        pending.current = true;
        setStatusTracked('dirty');
      }
      opts.current.onSaved(saved);
    } catch (err) {
      // Edits typed meanwhile are included in the next attempt; don't bypass the back-off.
      pending.current = false;
      if (err instanceof ApiError && err.code === 'DAY_VERSION_CONFLICT') {
        const current = (err.details as DayConflictDetails | null)?.current ?? null;
        conflictRef.current = true;
        setConflict(current);
        setStatusTracked('conflict');
      } else if (err instanceof ApiError && err.code === 'TRIP_COMPLETED') {
        setStatusTracked('error');
        opts.current.onCompleted?.();
      } else if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 429
      ) {
        setStatusTracked('error');
      } else if (retryCount.current < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[retryCount.current++]!;
        setStatusTracked('retrying');
        retryTimer.current = setTimeout(() => void saveRef.current(), delay);
      } else {
        setStatusTracked('error');
      }
    } finally {
      inFlight.current = false;
      if (pending.current && !conflictRef.current) {
        pending.current = false;
        void saveRef.current();
      }
    }
  }, [day.id, setStatusTracked]);
  useLayoutEffect(() => {
    saveRef.current = save;
  }, [save]);

  const setText = useCallback(
    (value: string) => {
      textRef.current = value;
      setTextState(value);
      writeJson(STORAGE_KEYS.draft(day.id), {
        text: value,
        baseVersion: baseRef.current.version,
        savedAt: new Date().toISOString(),
      } satisfies Draft);
      if (conflictRef.current) return; // paused until the conflict is resolved
      setStatusTracked(isDirty() ? 'dirty' : 'saved');
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    },
    [day.id, save, setStatusTracked],
  );

  const flush = useCallback(() => {
    clearTimeout(debounce.current);
    void save();
  }, [save]);

  const retry = useCallback(() => {
    retryCount.current = 0;
    clearTimeout(retryTimer.current);
    void save();
  }, [save]);

  /** Overwrite the newer server version with the local text (AC2.4 "Keep mine"). */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    baseRef.current = { text: conflict.text, version: conflict.version };
    conflictRef.current = false;
    setConflict(null);
    void save();
  }, [conflict, save]);

  /** Discard the local text in favour of the server version (AC2.4 "Use theirs"). */
  const useTheirs = useCallback(() => {
    if (!conflict) return;
    baseRef.current = { text: conflict.text, version: conflict.version };
    textRef.current = conflict.text;
    setTextState(conflict.text);
    remove(STORAGE_KEYS.draft(day.id));
    conflictRef.current = false;
    setConflict(null);
    setStatusTracked('saved');
    opts.current.onSaved(conflict);
  }, [conflict, day.id, setStatusTracked]);

  const restoreDraft = useCallback(() => {
    if (!draft) return;
    baseRef.current = { ...baseRef.current, version: draft.baseVersion };
    setDraft(null);
    setText(draft.text);
  }, [draft, setText]);

  const discardDraft = useCallback(() => {
    remove(STORAGE_KEYS.draft(day.id));
    setDraft(null);
  }, [day.id]);

  // Adopt newer server text when there are no local changes (polling, AC2.3).
  useEffect(() => {
    if (inFlight.current || conflictRef.current || isDirty()) return;
    if (day.version === baseRef.current.version && day.text === baseRef.current.text) return;
    baseRef.current = { text: day.text, version: day.version };
    textRef.current = day.text;
    setTextState(day.text);
  }, [day.text, day.version]);

  // Resume after a connection drop (frontend-spec §9 "Offline").
  useEffect(() => {
    if (status !== 'error' && status !== 'retrying') return;
    const onOnline = () => retry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [status, retry]);

  // Send pending edits when leaving the page section; clear timers.
  useEffect(
    () => () => {
      clearTimeout(debounce.current);
      clearTimeout(retryTimer.current);
      if (textRef.current !== baseRef.current.text && !conflictRef.current) void save();
      setUnsaved(day.id, false);
    },
    [day.id, save],
  );

  return {
    text,
    setText,
    flush,
    retry,
    status,
    conflict,
    keepMine,
    useTheirs,
    draft,
    restoreDraft,
    discardDraft,
  };
}
