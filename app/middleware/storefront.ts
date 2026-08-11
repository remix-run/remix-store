import {
  createShopifyRequestContext,
  createStorefrontClient,
  handleShopifyRoutes,
  type CacheInstance,
} from "@shopify/hydrogen";
import { createContextKey, type Middleware } from "remix/router";

import { cartHandlers, getCartData } from "../data/cart.server.ts";
import type { CartInitialData } from "../data/cart.ts";
import { getStorefrontCache } from "../data/storefront-cache.ts";
import { createRetryingStorefrontFetch } from "../data/storefront-fetch.ts";
import {
  normalizeStoreDomain,
  queryAnalyticsShop,
  queryShellMenus,
  type AnalyticsShop,
  type AppStorefrontClient,
  type NavigationMenuData,
} from "../data/storefront.ts";
import { getRuntime, type Env } from "../runtime.ts";

export interface StorefrontOptions {
  cache?: CacheInstance;
  env?: Env;
  fetch?: typeof globalThis.fetch;
}

export const StorefrontClient = createContextKey<AppStorefrontClient>();
export const NavigationMenuConfig = createContextKey<NavigationMenuData>();
export const FooterMenuConfig = createContextKey<NavigationMenuData>();
export const CartInitialDataConfig = createContextKey<CartInitialData>();
export const AnalyticsShopConfig = createContextKey<AnalyticsShop | null>();
const storefrontProperty = { property: "storefrontClient" } as const;
const navigationMenuProperty = { property: "navigationMenu" } as const;
const footerMenuProperty = { property: "footerMenu" } as const;
const cartInitialDataProperty = { property: "cartInitialData" } as const;
const analyticsShopProperty = { property: "analyticsShop" } as const;

export function storefront(options: StorefrontOptions = {}): Middleware<
  readonly [
    {
      key: typeof StorefrontClient;
      value: AppStorefrontClient;
      property: "storefrontClient";
    },
    {
      key: typeof NavigationMenuConfig;
      value: NavigationMenuData;
      property: "navigationMenu";
    },
    {
      key: typeof FooterMenuConfig;
      value: NavigationMenuData;
      property: "footerMenu";
    },
    {
      key: typeof CartInitialDataConfig;
      value: CartInitialData;
      property: "cartInitialData";
    },
    {
      key: typeof AnalyticsShopConfig;
      value: AnalyticsShop | null;
      property: "analyticsShop";
    },
  ]
> {
  return async (context, next) => {
    // Asset requests are served before any Storefront wiring and never need
    // a Shopify context or cart lookup.
    if (context.url.pathname.startsWith("/assets/")) return next();

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
    let storefrontFetch = createRetryingStorefrontFetch({
      fetch: options.fetch,
    });
    let cache = options.cache ?? getStorefrontCache(context.request);
    let storefrontClient = createStorefrontClient({
      type: "public",
      requestContext,
      config: {
        storeDomain,
        publicStorefrontToken,
        cache,
        waitUntil: runtime.waitUntil,
        fetch: storefrontFetch,
      },
    });

    context.set(StorefrontClient, storefrontClient, storefrontProperty);

    // Shopify-owned routes, including /api/cart, must run before the app
    // router. handleShopifyRoutes applies request-context headers itself.
    // Redirect fallbacks remain scoped to the later 2.11 routing feature.
    let shopifyResponse = await handleShopifyRoutes({
      request: context.request,
      requestContext,
      sessionManager: createRouteSessionManager(context.request),
      storefrontClient,
      handlers: [cartHandlers],
    });
    if (shopifyResponse) return shopifyResponse;

    let storefrontId = env["PUBLIC" + "_STOREFRONT_" + "ID"] ?? "0";
    let [shellMenus, cartInitialData, analyticsShop] = await Promise.all([
      queryShellMenus(storefrontClient, storeDomain),
      getCartData(context.request, storefrontClient),
      queryAnalyticsShop(
        storefrontClient,
        storefrontId,
        normalizeStoreDomain(storeDomain),
      ),
    ]);
    context.set(
      NavigationMenuConfig,
      shellMenus.navigationMenu,
      navigationMenuProperty,
    );
    context.set(FooterMenuConfig, shellMenus.footerMenu, footerMenuProperty);
    context.set(
      CartInitialDataConfig,
      cartInitialData,
      cartInitialDataProperty,
    );
    context.set(AnalyticsShopConfig, analyticsShop, analyticsShopProperty);

    let response = await next();
    return applyResponseHeaders(requestContext, response);
  };
}

type RouteSessionManager = Parameters<
  typeof handleShopifyRoutes
>[0]["sessionManager"];

function createRouteSessionManager(request: Request): RouteSessionManager {
  let values = new Map<string, unknown>();

  return {
    getSessionOrigin() {
      return new URL(request.url).origin;
    },
    getSessionItem(key: string) {
      return values.get(key);
    },
    setSessionItem(key: string, value: unknown) {
      values.set(key, value);
    },
    removeSessionItem(key: string) {
      values.delete(key);
    },
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
