export type Env = Record<string, string | undefined>;

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Runtime {
  buyerIp?: string;
  cache?: Cache;
  env?: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

// Runtime values are bound to the incoming Request so concurrent requests never
// share environment, cache, or waitUntil state.
const runtimes = new WeakMap<Request, Runtime>();

export async function fetchWithRuntime(
  request: Request,
  runtime: Runtime,
  handler: () => Promise<Response>,
): Promise<Response> {
  runtimes.set(request, runtime);

  try {
    return await handler();
  } catch (error) {
    if (!(request.signal.aborted && error === request.signal.reason)) {
      console.error(error);
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export function getRuntime(request: Request): Runtime {
  return runtimes.get(request) ?? {};
}
