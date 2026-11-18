import type { TestContext } from "remix/test";

type Act = (callback: () => unknown) => Promise<unknown>;

/** Retries `assertion` after flushing component updates until it passes. */
export function waitFor(
  t: TestContext,
  act: Act,
  assertion: () => void,
): Promise<void> {
  return t.waitFor(
    async () => {
      await act(() => {});
      assertion();
    },
    { interval: 0, timeout: 2_000 },
  );
}
