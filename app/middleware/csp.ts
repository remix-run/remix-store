import { getShopifyCspDirectives } from "@shopify/hydrogen";
import { csp as remixCsp } from "remix/middleware/csp";

import { getRuntime } from "../runtime.ts";

export interface CspOptions {
  /** Allows the Node HMR event stream and Vite's HMR socket on local ports. */
  development?: boolean;
}

/**
 * Enforces a nonce-based policy on HTML responses. `render()` stamps the nonce
 * on generated import maps, module preloads, and styles; the document stamps
 * it on authored scripts. `'strict-dynamic'` lets those trusted scripts load
 * their own dependencies, such as Shopify's CDN scripts and lazy islands.
 *
 * Hydrogen supplies the Shopify origins (CDN, Shop Pay, consent, analytics,
 * and the shop's own domains); Remix owns the nonce lifecycle.
 */
export function csp({ development = false }: CspOptions = {}) {
  let localConnections = development
    ? [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "ws://localhost:*",
        "ws://127.0.0.1:*",
      ]
    : [];

  return remixCsp({
    policy: ({ nonce, context }) => {
      let env = getRuntime(context.request).env;
      let shopify = getShopifyCspDirectives({
        storeDomain: env?.PUBLIC_STORE_DOMAIN?.trim() || undefined,
        checkoutDomain: env?.PUBLIC_CHECKOUT_DOMAIN?.trim() || undefined,
      });

      return {
        ...shopify,
        // Nonces authorize scripts. Hydrogen's host sources are only a
        // fallback that 'strict-dynamic' browsers ignore, so leave them out.
        scriptSrc: [`'nonce-${nonce}'`, "'strict-dynamic'"],
        connectSrc: unique([...shopify.connectSrc, ...localConnections]),
        // Nothing on the site sets a <base>; Hydrogen's default allows 'self'.
        baseUri: ["'none'"],
      };
    },
  });
}

function unique(sources: string[]): string[] {
  return [...new Set(sources)];
}
