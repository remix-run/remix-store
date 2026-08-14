import type { Handle } from "remix/ui";

/**
 * Mounts a client entry component outside the real reconciler so prop-diff
 * tests can drive re-renders without a DOM tree.
 *
 * `queueTask` tasks are flushed with a live `AbortSignal` after each render so
 * post-update side effects run in the same order the runtime would run them.
 * `handle.update()` re-renders
 * synchronously until both updates and queued tasks settle.
 */
export function createTestComponent<Props extends Record<string, unknown>>(
  type: (handle: Handle<Props>) => () => unknown,
) {
  let props = {} as Props;
  let tasks: Array<(signal: AbortSignal) => void> = [];
  let updateRequested = false;
  let handle = {
    props,
    signal: new AbortController().signal,
    update: async () => {
      updateRequested = true;
      return new AbortController().signal;
    },
    queueTask(task: (signal: AbortSignal) => void) {
      tasks.push(task);
    },
  } as Handle<Props>;
  let renderComponent: (() => unknown) | undefined;
  return {
    render(nextProps: Props) {
      Object.assign(props, nextProps);
      renderComponent ??= type(handle);
      renderComponent();
      do {
        updateRequested = false;
        let pendingTasks = tasks.splice(0);
        for (let task of pendingTasks) task(new AbortController().signal);
        if (updateRequested) renderComponent();
      } while (updateRequested || tasks.length > 0);
    },
  };
}

export function renderTestComponent<Props extends Record<string, unknown>>(
  component: { render(props: Props): void },
  props: Props,
): void {
  component.render(props);
}
