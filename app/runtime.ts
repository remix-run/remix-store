export type Env = Record<string, string | undefined>;

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Runtime {
  cache?: Cache;
  env?: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

// Oxygen values are bound to the incoming Request so concurrent requests never
// share environment, cache, or waitUntil state.
const runtimes = new WeakMap<Request, Runtime>();

export function initializeRuntime(
  request: Request,
  env?: Env,
  context?: ExecutionContext,
  cache?: Cache,
): void {
  runtimes.set(request, {
    cache,
    env,
    waitUntil: context?.waitUntil.bind(context),
  });
}

export function getRuntime(request: Request): Runtime {
  return runtimes.get(request) ?? {};
}
