import * as fs from "node:fs";
import * as http from "node:http";

/** Recorded Storefront API response bodies, keyed by `operationKey()`. */
export type StorefrontRecording = Record<string, unknown>;

export interface StorefrontServerOptions {
  port: number;
  recording: StorefrontRecording;
  /**
   * Origin of the live Storefront API, for example
   * `https://example.myshopify.com`. When set, unrecorded queries are
   * forwarded there and their responses are added to `recording`. Omit it to
   * replay only.
   */
  upstream?: string;
}

export interface StorefrontServer {
  /** Operation keys that were requested but not recorded. */
  misses: Set<string>;
  close(): Promise<void>;
}

const forwardedHeaderExclusions = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "host",
]);

/**
 * Serves recorded Storefront API responses, optionally recording missing ones
 * from the live API. Mutations are always rejected so recording can never
 * create carts or orders.
 */
export async function startStorefront({
  port,
  recording,
  upstream,
}: StorefrontServerOptions): Promise<StorefrontServer> {
  let misses = new Set<string>();

  let server = http.createServer(async (request, response) => {
    let body = "";
    for await (let chunk of request) body += chunk;

    let key: string;
    try {
      key = operationKey(body);
    } catch (error) {
      sendJson(response, 400, { errors: [{ message: String(error) }] });
      return;
    }

    if (Object.hasOwn(recording, key)) {
      sendJson(response, 200, recording[key]);
      return;
    }

    if (!upstream) {
      misses.add(key);
      sendJson(response, 500, {
        errors: [{ message: `No recorded response for ${key}` }],
      });
      return;
    }

    let headers = new Headers();
    for (let [name, value] of Object.entries(request.headers)) {
      if (forwardedHeaderExclusions.has(name) || value === undefined) continue;
      headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }

    let upstreamResponse = await fetch(new URL(request.url ?? "/", upstream), {
      method: request.method,
      headers,
      body,
    });
    let data: unknown = await upstreamResponse.json();
    if (upstreamResponse.ok && !hasErrors(data)) recording[key] = data;
    sendJson(response, upstreamResponse.status, data);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    misses,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

/** Identifies a Storefront request by operation name and variables. */
export function operationKey(body: string): string {
  let { query, variables } = JSON.parse(body) as {
    query?: unknown;
    variables?: unknown;
  };
  if (typeof query !== "string") {
    throw new Error("Storefront request has no query.");
  }

  let match = query.match(/\b(query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (!match) throw new Error("Storefront request has no operation name.");
  if (match[1] === "mutation") {
    throw new Error(`Refusing Storefront mutation ${match[2]}.`);
  }

  return `${match[2]} ${JSON.stringify(sortKeys(variables ?? {}))}`;
}

export function readRecording(path: string): StorefrontRecording {
  return JSON.parse(fs.readFileSync(path, "utf8")) as StorefrontRecording;
}

export function writeRecording(
  path: string,
  recording: StorefrontRecording,
): void {
  let sorted = Object.fromEntries(
    Object.entries(recording).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

function hasErrors(data: unknown): boolean {
  return typeof data === "object" && data !== null && "errors" in data;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  );
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}
