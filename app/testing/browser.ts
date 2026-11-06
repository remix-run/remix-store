import type { RenderResult } from "remix/component/test";

type Act = RenderResult["act"];

/**
 * Resolves on the next task. The microtask queue drains completely before a
 * task starts, so every promise chain already in flight has settled.
 */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Settles in-flight promise chains, then flushes the component updates they queued. */
export async function flushAsync(act: Act): Promise<void> {
  await act(nextTask);
}

/**
 * Waits, a task at a time, until `predicate` holds, flushing component
 * updates in between when given `act`. Fails after `timeout` milliseconds.
 */
export async function waitFor(
  predicate: () => boolean,
  { act, timeout = 2_000 }: { act?: Act; timeout?: number } = {},
): Promise<void> {
  let deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Condition not met within ${timeout}ms: ${predicate}`);
    }
    await nextTask();
    if (act) await act(() => {});
  }
}
