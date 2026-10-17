import type { Context } from 'hono';

/**
 * Run work after the response (Workers `waitUntil`), so its duration can't leak information
 * (BR12). Outside Workers (tests) it is awaited inline. Errors are logged, never thrown.
 */
export async function runInBackground(c: Context, work: () => Promise<void>): Promise<void> {
  const task = work().catch((err: unknown) => {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'background task failed',
        error: err instanceof Error ? err.name : 'unknown',
      }),
    );
  });
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    await task;
  }
}
