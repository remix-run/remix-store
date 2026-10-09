import type { Middleware } from "remix/router";

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

/** Give framework-owned internal dispatch the same request-scoped bindings. */
export function runtimeDispatch(): Middleware {
  return (context, next) => {
    let runtime = runtimes.get(context.request);
    if (runtime) {
      let router = context.router;
      let origin = context.url.origin;
      // Scope the facade to this context; never mutate the shared router. Its
      // closure survives streaming and concurrent requests retain distinct envs.
      context.router = new Proxy(router, {
        get(target, key) {
          if (key === "fetch")
            return (input: Request | URL | string, init?: RequestInit) => {
              let request =
                input instanceof Request && !init
                  ? input
                  : new Request(input, init);
              // Cross-origin frames/redirects must not inherit trusted bindings.
              if (new URL(request.url).origin === origin)
                runtimes.set(request, runtime);
              return target.fetch(request);
            };
          let value = Reflect.get(target, key, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    return next();
  };
}
