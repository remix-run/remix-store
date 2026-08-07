import {
  createShopifyRequestContext,
  createStorefrontClient,
  type StorefrontClient as HydrogenStorefrontClient,
} from "@shopify/hydrogen";
import { createContextKey, type Middleware } from "remix/router";

import { getRuntime, type Env } from "../runtime.ts";

export interface StorefrontOptions {
  env?: Env;
  fetch?: typeof globalThis.fetch;
}

export const StorefrontClient = createContextKey<HydrogenStorefrontClient>();
const storefrontProperty = { property: "storefrontClient" } as const;

export function storefront(options: StorefrontOptions = {}): Middleware<
  readonly [
    {
      key: typeof StorefrontClient;
      value: HydrogenStorefrontClient;
      property: "storefrontClient";
    },
  ]
> {
  return async (context, next) => {
    let runtime = getRuntime(context.request);
    let env = { ...runtime.env, ...options.env };
    let storeDomain = env.PUBLIC_STORE_DOMAIN;
    let publicStorefrontToken = env.PUBLIC_STOREFRONT_API_TOKEN;

    if (!storeDomain || !publicStorefrontToken) {
      throw new Error(
        "PUBLIC_STORE_DOMAIN and PUBLIC_STOREFRONT_API_TOKEN are required to query Shopify.",
      );
    }

    let requestContext = createShopifyRequestContext({
      request: context.request,
      i18n: { country: "US", language: "EN" },
    });
    let storefrontClient = createStorefrontClient({
      type: "public",
      requestContext,
      config: {
        storeDomain,
        publicStorefrontToken,
        cache: runtime.cache,
        waitUntil: runtime.waitUntil,
        fetch: options.fetch,
      },
    });

    context.set(StorefrontClient, storefrontClient, storefrontProperty);
    let response = await next();
    return applyResponseHeaders(requestContext, response);
  };
}

function applyResponseHeaders(
  requestContext: ReturnType<typeof createShopifyRequestContext>,
  response: Response,
): Response {
  try {
    requestContext.applyResponseHeaders(response.headers);
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    // Some runtimes expose immutable response headers. Recreate the response so
    // Hydrogen can append its request-context headers at the final boundary.
    let mutableResponse = new Response(response.body, response);
    requestContext.applyResponseHeaders(mutableResponse.headers);
    return mutableResponse;
  }
}
