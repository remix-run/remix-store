import type { Env } from "./runtime.ts";

/** Reads only the buyer-IP header guaranteed by the Oxygen adapter. */
export function resolveOxygenBuyerIp(request: Request): string | undefined {
  return nonEmptyHeader(request.headers, "oxygen-buyer-ip");
}

/**
 * Reads Fly's edge-controlled header on Fly. Other Node runtimes use the client
 * address resolved by the HTTP adapter from the socket or a trusted proxy.
 */
export function resolveNodeBuyerIp(
  request: Request,
  env: Env,
  clientAddress?: string,
): string | undefined {
  if (env.FLY_APP_NAME) return nonEmptyHeader(request.headers, "fly-client-ip");
  return clientAddress?.trim() || undefined;
}

function nonEmptyHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name)?.trim() || undefined;
}
