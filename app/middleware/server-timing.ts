import { createContextKey, type Middleware } from "remix/router";

/**
 * Collects request phases for the `Server-Timing` response header, so browser
 * devtools and benchmarks can see where server time goes.
 *
 * Workers runtimes, including Oxygen, advance the clock only across I/O. There,
 * network phases such as Storefront queries are accurate but CPU-bound phases
 * such as rendering read near zero; measure those under Node.
 */
export class ServerTimingCollector {
  readonly startTime = performance.now();
  #metrics: string[] = [];

  /** Records a phase that began at `start`, a `performance.now()` value, and ends now. */
  measure(name: string, start: number, description?: string): void {
    let duration = Math.max(0, performance.now() - start).toFixed(1);
    let desc = description
      ? `;desc="${description.replace(/["\\]/g, "")}"`
      : "";
    this.#metrics.push(`${name}${desc};dur=${duration}`);
  }

  header(): string {
    return this.#metrics.join(", ");
  }
}

export const ServerTiming = createContextKey<ServerTimingCollector>();

export function serverTiming(): Middleware {
  return async (context, next) => {
    let timing = new ServerTimingCollector();
    context.set(ServerTiming, timing);

    let response = await next();
    timing.measure("total", timing.startTime);
    try {
      response.headers.append("Server-Timing", timing.header());
      return response;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      let mutableResponse = new Response(response.body, response);
      mutableResponse.headers.append("Server-Timing", timing.header());
      return mutableResponse;
    }
  };
}

/** Times each Storefront API request by its GraphQL operation name. */
export function timeStorefrontFetch(
  fetch: typeof globalThis.fetch,
  timing: ServerTimingCollector | undefined,
): typeof globalThis.fetch {
  if (!timing) return fetch;
  return async (input, init) => {
    let start = performance.now();
    try {
      return await fetch(input, init);
    } finally {
      timing.measure("query", start, operationName(init?.body));
    }
  };
}

function operationName(body: BodyInit | null | undefined): string {
  if (typeof body !== "string") return "unknown";
  return /\b(?:query|mutation)\s+(\w+)/.exec(body)?.[1] ?? "unknown";
}

/**
 * Resolves once the document's first chunk is rendered, recording how long
 * rendering took. Headers already wait for that chunk, so this adds no delay.
 */
export async function timeFirstChunk(
  response: Response,
  timing: ServerTimingCollector | undefined,
  start: number,
): Promise<Response> {
  if (!timing || !response.body) return response;

  let reader = response.body.getReader();
  let first = await reader.read();
  timing.measure("render", start);

  let body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done) controller.close();
      else controller.enqueue(first.value);
    },
    async pull(controller) {
      let { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(body, response);
}
