import {
  createShopifyRequestContext,
  createStorefrontClient,
} from "@shopify/hydrogen";

import { US_MARKET } from "../lib/public/market.ts";

/** A public Storefront client for the US market whose requests go to `fetch`. */
export function createTestStorefrontClient(fetch: typeof globalThis.fetch) {
  return createStorefrontClient({
    type: "public",
    requestContext: createShopifyRequestContext({
      request: new Request("https://storefront.example/"),
      i18n: US_MARKET,
    }),
    config: {
      storeDomain: "example.myshopify.com",
      storefrontId: "test-storefront-id",
      publicStorefrontToken: "test-token",
      cache: new NoopCache(),
      fetch,
    },
  });
}

export function graphqlResponse(
  data: unknown,
  errors?: Array<{ message: string }>,
): Response {
  return new Response(JSON.stringify(errors ? { data, errors } : { data }), {
    headers: { "Content-Type": "application/json" },
  });
}

class NoopCache {
  get() {}
  set() {}
  delete() {}
}
