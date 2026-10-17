import type { Day } from '@tripplanner/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { saveDay } from './api';
import { hasUnsaved } from './unsaved';
import { useDayAutosave, type UseDayAutosaveOptions } from './useDayAutosave';

vi.mock('./api', () => ({ saveDay: vi.fn() }));
const saveDayMock = vi.mocked(saveDay);

const baseDay: Day = {
  id: '0192f0c4-0000-7000-8000-000000000001',
  position: 1,
  date: '2026-12-05',
  text: '',
  version: 1,
  updatedByName: null,
  updatedAt: null,
  editors: [],
};

function setup(overrides: Partial<UseDayAutosaveOptions> = {}) {
  const onSaved = vi.fn();
  const onCompleted = vi.fn();
  const hook = renderHook<ReturnType<typeof useDayAutosave>, UseDayAutosaveOptions>(
    (props) => useDayAutosave(props),
    {
      initialProps: {
        token: 'tok',
        day: baseDay,
        editorName: 'Asha',
        enabled: true,
        onSaved,
        onCompleted,
        ...overrides,
      },
    },
  );
  return { ...hook, onSaved, onCompleted };
}

const saved = (text: string, version: number): { day: Day } => ({
  day: { ...baseDay, text, version, updatedByName: 'Asha', updatedAt: 'now' },
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  saveDayMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDayAutosave (frontend-spec §3.4)', () => {
  it('saves 1s after typing stops, with the base version (AC2.3)', async () => {
    saveDayMock.mockResolvedValue(saved('Hello', 2));
    const { result, onSaved } = setup();

    act(() => result.current.setText('Hel'));
    await advance(500);
    act(() => result.current.setText('Hello'));
    expect(result.current.status).toBe('dirty');
    expect(hasUnsaved()).toBe(true);
    await advance(999);
    expect(saveDayMock).not.toHaveBeenCalled();
    await advance(1);

    expect(saveDayMock).toHaveBeenCalledTimes(1);
    expect(saveDayMock).toHaveBeenCalledWith('tok', baseDay.id, {
      text: 'Hello',
      version: 1,
      editorName: 'Asha',
    });
    expect(result.current.status).toBe('saved');
    expect(onSaved).toHaveBeenCalledWith(saved('Hello', 2).day);
    expect(localStorage.getItem(`tp.draft.${baseDay.id}`)).toBeNull();
    expect(hasUnsaved()).toBe(false);
  });

  it('flushes immediately on blur', async () => {
    saveDayMock.mockResolvedValue(saved('x', 2));
    const { result } = setup();
    act(() => result.current.setText('x'));
    await act(async () => result.current.flush());
    expect(saveDayMock).toHaveBeenCalledTimes(1);
  });

  it('does not save without a display name (AC2.2)', async () => {
    const { result } = setup({ editorName: null });
    act(() => result.current.setText('x'));
    await advance(2000);
    expect(saveDayMock).not.toHaveBeenCalled();
  });

  it('sends edits typed during an in-flight save afterwards, with the new version', async () => {
    let resolveFirst!: (v: { day: Day }) => void;
    saveDayMock
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(saved('ab', 3));
    const { result } = setup();

    act(() => result.current.setText('a'));
    await advance(1000);
    act(() => result.current.setText('ab'));
    await advance(1000); // debounce fires while the first save is in flight → queued
    expect(saveDayMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirst(saved('a', 2)));
    await advance(0);
    expect(saveDayMock).toHaveBeenCalledTimes(2);
    expect(saveDayMock.mock.calls[1]![2]).toMatchObject({ text: 'ab', version: 2 });
    expect(result.current.status).toBe('saved');
  });

  it('pauses on a version conflict and resolves with Keep mine / Use theirs (AC2.4)', async () => {
    const theirs = { ...baseDay, text: 'theirs', version: 5, updatedByName: 'Ravi' };
    saveDayMock.mockRejectedValueOnce(
      new ApiError(409, 'DAY_VERSION_CONFLICT', 'conflict', { current: theirs }),
    );
    const { result } = setup();

    act(() => result.current.setText('mine'));
    await advance(1000);
    expect(result.current.status).toBe('conflict');
    expect(result.current.conflict).toEqual(theirs);

    act(() => result.current.setText('mine!'));
    await advance(3000);
    expect(saveDayMock).toHaveBeenCalledTimes(1); // autosave paused

    saveDayMock.mockResolvedValueOnce(saved('mine!', 6));
    await act(async () => result.current.keepMine());
    expect(saveDayMock.mock.calls[1]![2]).toMatchObject({ text: 'mine!', version: 5 });
    expect(result.current.status).toBe('saved');
  });

  it('Use theirs replaces the local text without saving', async () => {
    const theirs = { ...baseDay, text: 'theirs', version: 5 };
    saveDayMock.mockRejectedValueOnce(
      new ApiError(409, 'DAY_VERSION_CONFLICT', 'conflict', { current: theirs }),
    );
    const { result, onSaved } = setup();
    act(() => result.current.setText('mine'));
    await advance(1000);
    act(() => result.current.useTheirs());
    expect(result.current.text).toBe('theirs');
    expect(result.current.conflict).toBeNull();
    expect(onSaved).toHaveBeenCalledWith(theirs);
    expect(saveDayMock).toHaveBeenCalledTimes(1);
  });

  it('retries network failures after 2s, 5s, 10s, then shows an error (AC2.7)', async () => {
    saveDayMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    const { result } = setup();
    act(() => result.current.setText('x'));
    await advance(1000);
    expect(result.current.status).toBe('retrying');
    await advance(2000);
    await advance(5000);
    await advance(10000);
    expect(saveDayMock).toHaveBeenCalledTimes(4);
    expect(result.current.status).toBe('error');
    expect(localStorage.getItem(`tp.draft.${baseDay.id}`)).toContain('"text":"x"');

    saveDayMock.mockResolvedValueOnce(saved('x', 2));
    await act(async () => result.current.retry());
    expect(result.current.status).toBe('saved');
  });

  it('retries automatically when the connection comes back (frontend-spec §9)', async () => {
    saveDayMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    const { result } = setup();
    act(() => result.current.setText('x'));
    await advance(1000 + 2000 + 5000 + 10000);
    expect(result.current.status).toBe('error');

    saveDayMock.mockResolvedValueOnce(saved('x', 2));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await advance(0);
    expect(result.current.status).toBe('saved');
  });

  it('reports Completed trips', async () => {
    saveDayMock.mockRejectedValueOnce(new ApiError(409, 'TRIP_COMPLETED', 'ended'));
    const { result, onCompleted } = setup();
    act(() => result.current.setText('x'));
    await advance(1000);
    expect(onCompleted).toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });

  it('adopts newer server text only when there are no local changes', async () => {
    const { result, rerender } = setup();
    const props = (day: Day): UseDayAutosaveOptions => ({
      token: 'tok',
      day,
      editorName: 'Asha',
      enabled: true,
      onSaved: vi.fn(),
    });

    rerender(props({ ...baseDay, text: 'from Ravi', version: 2 }));
    expect(result.current.text).toBe('from Ravi');

    act(() => result.current.setText('local edit'));
    rerender(props({ ...baseDay, text: 'from Ravi again', version: 3 }));
    expect(result.current.text).toBe('local edit');
  });

  it('offers to restore an unsaved draft from a previous visit', () => {
    localStorage.setItem(
      `tp.draft.${baseDay.id}`,
      JSON.stringify({ text: 'lost text', baseVersion: 1, savedAt: 'x' }),
    );
    const { result } = setup();
    expect(result.current.draft?.text).toBe('lost text');
    act(() => result.current.restoreDraft());
    expect(result.current.text).toBe('lost text');
    expect(result.current.status).toBe('dirty');
  });
});
