import * as assert from "remix/assert";
import type { FakeTimers, TestContext } from "remix/test";

/**
 * Waits for `promise` while advancing fake time between polls, so timers it
 * schedules along the way fire without real waiting. Polls use real timers,
 * which lets in-flight work reach its next timer between advances.
 */
export async function advanceUntilSettled<T>(
  t: TestContext,
  timers: FakeTimers,
  promise: Promise<T>,
  { stepMs = 100 }: { stepMs?: number } = {},
): Promise<T> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await t.waitFor(
    async () => {
      if (!settled) await timers.advanceAsync(stepMs);
      assert.ok(settled);
    },
    { interval: 0, timeout: 2_000 },
  );
  return promise;
}
