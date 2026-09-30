import type { Env } from "./runtime.ts";

/** Header a trusted CDN overwrites with the connecting client's IP. */
export const CDN_CLIENT_IP_HEADER = "x-cdn-client-ip";
/** Shared secret proving a request came through the trusted CDN. */
export const CDN_ORIGIN_SECRET_HEADER = "x-cdn-origin-secret";

/** Reads only the buyer-IP header guaranteed by the Oxygen adapter. */
export function resolveOxygenBuyerIp(request: Request): string | undefined {
  return nonEmptyHeader(request.headers, "oxygen-buyer-ip");
}

/**
 * Reads Fly's edge-controlled header on Fly, unless the request carries the
 * configured CDN origin secret; then the CDN's client-IP header is trusted
 * because Fly's header only sees the CDN. Other Node runtimes use the client
 * address resolved by the HTTP adapter from the socket or a trusted proxy.
 */
export function resolveNodeBuyerIp(
  request: Request,
  env: Env,
  clientAddress?: string,
): string | undefined {
  if (env.FLY_APP_NAME) {
    if (isTrustedCdnRequest(request, env)) {
      return nonEmptyHeader(request.headers, CDN_CLIENT_IP_HEADER);
    }
    return nonEmptyHeader(request.headers, "fly-client-ip");
  }
  return clientAddress?.trim() || undefined;
}

function isTrustedCdnRequest(request: Request, env: Env): boolean {
  let expected = env.CDN_ORIGIN_SECRET;
  let actual = request.headers.get(CDN_ORIGIN_SECRET_HEADER);
  return Boolean(expected && actual && constantTimeEqual(actual, expected));
}

function constantTimeEqual(a: string, b: string): boolean {
  let length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function nonEmptyHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name)?.trim() || undefined;
}
