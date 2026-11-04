import { csp as remixCsp } from "remix/middleware/csp";

export interface CspOptions {
  /** Allows the Node HMR event stream and Vite's HMR socket on local ports. */
  development?: boolean;
}

const SHOPIFY_CDN = "https://cdn.shopify.com";

/**
 * Enforces a nonce-based policy on HTML responses. `render()` stamps the nonce
 * on generated import maps, module preloads, and styles; the document stamps
 * it on authored scripts. `'strict-dynamic'` lets those trusted scripts load
 * their own dependencies, such as Shopify's CDN scripts and lazy islands.
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
    policy: ({ nonce }) => ({
      defaultSrc: ["'self'"],
      scriptSrc: [`'nonce-${nonce}'`, "'strict-dynamic'"],
      // Style attributes and the elements Shopify's scripts inject carry no
      // nonce. A nonce here would disable 'unsafe-inline', so leave it out.
      styleSrc: ["'self'", "'unsafe-inline'", SHOPIFY_CDN],
      // Oxygen serves built assets and product images from Shopify's CDN.
      imgSrc: ["'self'", "data:", SHOPIFY_CDN],
      fontSrc: ["'self'", SHOPIFY_CDN],
      // Shopify analytics, consent, and performance reporting endpoints.
      connectSrc: [
        "'self'",
        SHOPIFY_CDN,
        "https://*.shopifysvc.com",
        ...localConnections,
      ],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
    }),
  });
}
