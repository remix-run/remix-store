import type { Env } from "./runtime.ts";

/** Reads only the buyer-IP header guaranteed by the Oxygen adapter. */
export function resolveOxygenBuyerIp(request: Request): string | undefined {
  return nonEmptyHeader(request.headers, "oxygen-buyer-ip");
}

/**
 * Reads Fly's edge-controlled header only inside Fly. Local development uses a
 * fixed loopback identity instead of trusting request headers.
 */
export function resolveNodeBuyerIp(
  request: Request,
  env: Env,
): string | undefined {
  if (env.FLY_APP_NAME) return nonEmptyHeader(request.headers, "fly-client-ip");
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return "127.0.0.1";
  }
  return undefined;
}

function nonEmptyHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name)?.trim() || undefined;
}
