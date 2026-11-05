import {
  createShopifyRequestContext,
  createStorefrontClient,
  type CacheInstance,
} from "@shopify/hydrogen";
import { createContextKey, type Middleware } from "remix/router";

import { getStorefrontCache } from "./storefront-cache.ts";
import { createRetryingStorefrontFetch } from "./storefront-fetch.ts";
import type { AppStorefrontClient } from "../data/storefront.ts";
import type { ActiveMarket } from "../lib/public/market.ts";
import { getRuntime, type Env } from "../runtime.ts";
import { MarketConfig } from "./market.ts";
import {
  loadShellData,
  ShellDataConfig,
  type StorefrontShellData,
} from "./shell-data.ts";
import {
  applyResponseHeaders,
  handleShopifyCompatibilityRoute,
  withShopifyRedirect,
  type ShopifyRouteContext,
} from "./shopify-routes.ts";

export interface StorefrontOptions {
  cache?: CacheInstance;
  env?: Env;
  fetch?: typeof globalThis.fetch;
}

export const StorefrontClient = createContextKey<AppStorefrontClient>();
/** Adapter bindings merged with app-level overrides. */
export const RequestEnv = createContextKey<Env>();
/** The adapter-supplied, trusted buyer IP. Every app request has one. */
export const BuyerIp = createContextKey<string>();

export function storefront(options: StorefrontOptions = {}): Middleware<
  readonly [
    {
      key: typeof StorefrontClient;
      value: AppStorefrontClient;
      property: "storefrontClient";
    },
    {
      key: typeof ShellDataConfig;
      value: Promise<StorefrontShellData>;
      property: "shellData";
    },
    { key: typeof RequestEnv; value: Env; property: "env" },
    { key: typeof BuyerIp; value: string; property: "buyerIp" },
  ]
> {
  return async (context, next) => {
    // Asset requests are served before any Storefront wiring and never need
    // a Shopify context or cart lookup.
    if (context.url.pathname.startsWith("/assets/")) return next();

    let runtime = getRuntime(context.request);
    let env: Env = { ...runtime.env, ...options.env };
    // Storefront requests and subscription abuse controls both depend on a
    // trusted IP, so fail closed before any route runs.
    let buyerIp = runtime.buyerIp;
    if (!buyerIp) {
      throw new Error("The runtime adapter must provide a trusted buyer IP.");
    }

    let market = context.get(MarketConfig);
    let { requestContext, storefrontClient } = createRequestStorefrontClient({
      buyerIp,
      cache: options.cache ?? getStorefrontCache(context.request),
      env,
      fetch: options.fetch,
      market,
      request: context.request,
      waitUntil: runtime.waitUntil,
    });
    let routeContext: ShopifyRouteContext = {
      market,
      request: context.request,
      requestContext,
      storefrontClient,
      url: context.url,
    };

    let shopifyResponse = await handleShopifyCompatibilityRoute(routeContext);
    if (shopifyResponse) return shopifyResponse;

    let shellData = loadShellData(
      context.request,
      context.url,
      storefrontClient,
    );
    context.set(RequestEnv, env, { property: "env" });
    context.set(BuyerIp, buyerIp, { property: "buyerIp" });
    context.set(StorefrontClient, storefrontClient, {
      property: "storefrontClient",
    });
    context.set(ShellDataConfig, shellData, { property: "shellData" });

    // Apply Shopify's response headers once the route and shell queries finish.
    let [response] = await Promise.all([next(), shellData]);
    return applyResponseHeaders(
      requestContext,
      await withShopifyRedirect(routeContext, response),
    );
  };
}

interface RequestStorefrontClientOptions {
  buyerIp: string;
  cache: CacheInstance;
  env: Env;
  fetch?: typeof globalThis.fetch;
  market: ActiveMarket;
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function createRequestStorefrontClient(
  options: RequestStorefrontClientOptions,
) {
  let storeDomain = options.env.PUBLIC_STORE_DOMAIN;
  let privateStorefrontToken = options.env.PRIVATE_STOREFRONT_API_TOKEN;
  if (!storeDomain || !privateStorefrontToken) {
    throw new Error(
      "PUBLIC_STORE_DOMAIN and PRIVATE_STOREFRONT_API_TOKEN are required to query Shopify.",
    );
  }

  let requestContext = createShopifyRequestContext({
    request: options.request,
    i18n: options.market,
    buyerIp: options.buyerIp,
  });
  let storefrontClient: AppStorefrontClient = createStorefrontClient({
    type: "private",
    requestContext,
    config: {
      storeDomain,
      storefrontId: options.env.PUBLIC_STOREFRONT_ID,
      privateStorefrontToken,
      cache: options.cache,
      waitUntil: options.waitUntil,
      fetch: createRetryingStorefrontFetch({ fetch: options.fetch }),
    },
  });
  return { requestContext, storefrontClient };
}
