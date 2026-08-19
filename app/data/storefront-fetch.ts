import { object, parseSafe, string } from "remix/data-schema";

const RETRY_DELAY_MS = 100;
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504]);
const StringBodySchema = string();
const StorefrontQuerySchema = object({ query: string() });

interface RetryingStorefrontFetchOptions {
  delayMs?: number;
  fetch?: typeof globalThis.fetch;
}

/** Retries idempotent Storefront API queries once after transient failures. */
export function createRetryingStorefrontFetch({
  delayMs = RETRY_DELAY_MS,
  fetch: originFetch,
}: RetryingStorefrontFetchOptions = {}): typeof globalThis.fetch {
  return async (input, init) => {
    let fetchImpl = originFetch ?? globalThis.fetch;
    let canRetry = !init?.signal?.aborted && isStorefrontQuery(init?.body);

    try {
      let response = await fetchImpl(input, init);
      if (!canRetry || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }
    } catch (error) {
      if (!canRetry || init?.signal?.aborted) throw error;
    }

    await waitForRetry(delayMs, init?.signal);
    // The retry result is authoritative. If it also fails, Hydrogen receives
    // that final response/error while the client still records only one retry.
    return fetchImpl(input, init);
  };
}

function isStorefrontQuery(body: BodyInit | null | undefined): boolean {
  let stringBody = parseSafe(StringBodySchema, body);
  if (!stringBody.success) return false;

  try {
    let request = parseSafe(
      StorefrontQuerySchema,
      JSON.parse(stringBody.value),
    );
    return request.success && !/\bmutation\b/i.test(request.value.query);
  } catch {
    return false;
  }
}

async function waitForRetry(delayMs: number, signal?: AbortSignal | null) {
  if (signal?.aborted) throw signal.reason;
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    let timeout = setTimeout(finish, delayMs);

    function finish() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }

    function abort() {
      clearTimeout(timeout);
      reject(signal?.reason);
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}
