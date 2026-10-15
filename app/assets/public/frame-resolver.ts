import type { ResolveFrameOptions } from "remix/component";

/**
 * How long a prefetched page stays usable. Pages are `private, no-store`, so
 * the browser's HTTP cache can't hold them; this is the only reuse.
 */
const PREFETCH_TTL_MS = 30_000;

/** The page the visitor most recently signaled intent to open. */
let prefetch:
  | {
      key: string;
      expiresAt: number;
      controller: AbortController;
      response: Promise<Response>;
    }
  | undefined;

/**
 * Starts the request a navigation to `url` would make, for the next matching
 * untargeted GET request to reuse. Replaces an unused earlier prefetch.
 */
export function prefetchFrame(url: URL): void {
  let key = prefetchKey(url);
  if (prefetch?.key === key && prefetch.expiresAt > Date.now()) return;

  prefetch?.controller.abort();
  let controller = new AbortController();
  let response = requestFrame(url, { signal: controller.signal });
  // A failed prefetch falls back to a normal request when it's used.
  response.catch(() => {});
  prefetch = {
    key,
    expiresAt: Date.now() + PREFETCH_TTL_MS,
    controller,
    response,
  };
}

export async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<Response> {
  let method = options?.method?.toUpperCase() ?? "GET";
  if (method !== "GET") {
    // A submission through Remix may change what the prefetched page shows.
    prefetch?.controller.abort();
    prefetch = undefined;
  } else if (!options?.target && !options?.formData) {
    let prefetched = await takePrefetch(url, options?.signal);
    if (prefetched) return prefetched;
  }

  return requestFrame(url, options);
}

/**
 * Returns the prefetched response for `url` if it succeeded. Failed requests
 * and error pages fall back to a normal request, which gets the current page;
 * a body that fails while streaming is handled like any navigation's.
 */
async function takePrefetch(
  url: URL,
  signal: AbortSignal | undefined,
): Promise<Response | undefined> {
  let entry = prefetch;
  if (entry?.key !== prefetchKey(url)) return undefined;

  // A response body can be read once, so a prefetch serves one request.
  prefetch = undefined;
  if (entry.expiresAt <= Date.now() || signal?.aborted) {
    entry.controller.abort();
    return undefined;
  }
  signal?.addEventListener("abort", () => entry.controller.abort(), {
    once: true,
  });

  let response = await entry.response.catch(() => undefined);
  if (response?.ok) return response;
  entry.controller.abort();
  return undefined;
}

function prefetchKey(url: URL): string {
  let key = new URL(url);
  key.hash = "";
  return key.href;
}

async function requestFrame(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<Response> {
  let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
  if (options?.target) headers.set("X-Remix-Target", options.target);

  let method = options?.method?.toUpperCase() ?? "GET";
  let body = submissionBody(options?.formData, options?.encType, headers);
  let response = await fetch(url, {
    body,
    credentials: "same-origin",
    headers,
    method,
    signal: options?.signal,
  });
  let contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(
      `Failed to resolve HTML frame: ${response.status} ${response.statusText}`,
    );
  }

  // Keep the Response so Remix can use the final URL after a redirect while
  // still rendering branded error documents from non-success responses.
  return response;
}

function submissionBody(
  formData: FormData | undefined,
  encType: string | undefined,
  headers: Headers,
): BodyInit | undefined {
  if (!formData) return undefined;

  if (encType?.toLowerCase() === "multipart/form-data") return formData;

  if (encType?.toLowerCase() === "text/plain") {
    headers.set("Content-Type", "text/plain;charset=UTF-8");
    return Array.from(
      formData,
      ([name, value]) =>
        `${name}=${value instanceof File ? value.name : value}\r\n`,
    ).join("");
  }

  let searchParams = new URLSearchParams();
  for (let [name, value] of formData) {
    searchParams.append(name, value instanceof File ? value.name : value);
  }
  return searchParams;
}
