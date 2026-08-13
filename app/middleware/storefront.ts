import {
  createShopifyRequestContext,
  createStorefrontClient,
  handleShopifyRedirects,
  handleShopifyRoutes,
  type CacheInstance,
} from "@shopify/hydrogen";
import { createMultiMatcher } from "remix/route-pattern/match";
import { createContextKey, type Middleware } from "remix/router";

import { cartHandlers, getCartData } from "../data/cart.server.ts";
import type { CartInitialData } from "../data/cart.ts";
import { applyDiscountCode } from "../data/discount.server.ts";
import { getStorefrontCache } from "../data/storefront-cache.ts";
import { createRetryingStorefrontFetch } from "../data/storefront-fetch.ts";
import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
  normalizeStoreDomain,
  queryAnalyticsShop,
  queryShellMenus,
  type AnalyticsShop,
  type AppStorefrontClient,
  type NavigationMenuData,
  type StoreWideSaleData,
} from "../data/storefront.ts";
import { routeTemplates } from "../lib/public/route-templates.ts";
import { routes } from "../routes.ts";
import { getRuntime, type Env } from "../runtime.ts";

// Pin runtime requests explicitly; Hydrogen's preview validation schema already
// contains post-2026-04 deprecations, so it is not itself a reliable version pin.
export const STOREFRONT_API_VERSION = "2026-04";

export interface StorefrontOptions {
  cache?: CacheInstance;
  env?: Env;
  fetch?: typeof globalThis.fetch;
}

export const StorefrontClient = createContextKey<AppStorefrontClient>();
export const NavigationMenuConfig = createContextKey<NavigationMenuData>();
export const FooterMenuConfig = createContextKey<NavigationMenuData>();
export const StoreWideSaleConfig = createContextKey<StoreWideSaleData | null>();
export const CartInitialDataConfig = createContextKey<CartInitialData>();
export const AnalyticsShopConfig = createContextKey<AnalyticsShop | null>();
const storefrontProperty = { property: "storefrontClient" } as const;
const navigationMenuProperty = { property: "navigationMenu" } as const;
const footerMenuProperty = { property: "footerMenu" } as const;
const storeWideSaleProperty = { property: "storeWideSale" } as const;
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
      key: typeof StoreWideSaleConfig;
      value: StoreWideSaleData | null;
      property: "storeWideSale";
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

    let privateStorefrontToken = env["PRIVATE" + "_STOREFRONT_" + "API_TOKEN"];
    if (!storeDomain || !privateStorefrontToken) {
      throw new Error(
        "PUBLIC_STORE_DOMAIN and PRIVATE_STOREFRONT_API_TOKEN are required to query Shopify.",
      );
    }

    let buyerIp = runtime.buyerIp;
    if (!buyerIp) {
      throw new Error("The runtime adapter must provide a trusted buyer IP.");
    }

    let requestContext = createShopifyRequestContext({
      request: context.request,
      i18n: { country: "US", language: "EN" },
      buyerIp,
    });
    let storefrontFetch = createRetryingStorefrontFetch({
      fetch: options.fetch,
    });
    let cache = options.cache ?? getStorefrontCache(context.request);
    let storefrontClient = createStorefrontClient({
      type: "private",
      requestContext,
      config: {
        storeDomain,
        apiVersion: STOREFRONT_API_VERSION,
        privateStorefrontToken,
        buyerIp,
        cache,
        waitUntil: runtime.waitUntil,
        fetch: storefrontFetch,
      },
    });

    context.set(StorefrontClient, storefrontClient, storefrontProperty);

    let seoRoute = matchSeoRoute(context.url);
    if (seoRoute) {
      let analyticsShop =
        seoRoute === routes.seo.robots
          ? await queryAnalyticsShop(
              storefrontClient,
              env["PUBLIC" + "_STOREFRONT_" + "ID"] ?? "0",
              normalizeStoreDomain(storeDomain),
            )
          : null;
      context.set(
        NavigationMenuConfig,
        FALLBACK_NAVIGATION_MENU,
        navigationMenuProperty,
      );
      context.set(FooterMenuConfig, FALLBACK_FOOTER_MENU, footerMenuProperty);
      context.set(StoreWideSaleConfig, null, storeWideSaleProperty);
      context.set(
        CartInitialDataConfig,
        { cart: null },
        cartInitialDataProperty,
      );
      context.set(AnalyticsShopConfig, analyticsShop, analyticsShopProperty);

      return applyResponseHeaders(requestContext, await next());
    }

    // Shopify-owned checkout, permalink, AJAX cart, and /api/cart routes must
    // run before the app router. Hydrogen applies request-context headers.
    let shopifyResponse = await handleShopifyRoutes({
      request: context.request,
      requestContext,
      sessionManager: createRouteSessionManager(context.request),
      storefrontClient,
      handlers: [cartHandlers],
    });
    if (shopifyResponse) return noStore(shopifyResponse);

    let discount = getDiscountRequest(context.request);
    if (discount) {
      let headers = new Headers({ Location: discount.location });
      headers.set("Cache-Control", "private, no-store");

      if (discount.code && context.request.method === "GET") {
        try {
          let discountHeaders = await applyDiscountCode(
            context.request,
            storefrontClient,
            discount.code,
          );
          for (let [name, value] of discountHeaders)
            headers.append(name, value);
        } catch (error) {
          if (
            context.request.signal.aborted &&
            error === context.request.signal.reason
          )
            throw error;
          console.error("[hydrogen] Discount application failed");
        }
      }

      return applyResponseHeaders(
        requestContext,
        new Response(null, { status: 303, headers }),
      );
    }

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
      StoreWideSaleConfig,
      shellMenus.storeWideSale,
      storeWideSaleProperty,
    );
    context.set(
      CartInitialDataConfig,
      cartInitialData,
      cartInitialDataProperty,
    );
    context.set(AnalyticsShopConfig, analyticsShop, analyticsShopProperty);

    let response = await next();
    if (response.status === 404) {
      response =
        (await handleShopifyRedirects({
          request: context.request,
          storefrontClient,
          routeTemplates,
        })) ?? response;
    }
    return applyResponseHeaders(requestContext, noStoreRedirect(response));
  };
}

interface DiscountRequest {
  code: string | null;
  location: string;
}

function getDiscountRequest(request: Request): DiscountRequest | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  let url = new URL(request.url);
  let discountPath = url.pathname.match(/^\/discount\/([^/]+)\/?$/);
  if (discountPath) {
    let code = decodePathSegment(discountPath[1]!);
    let candidate =
      url.searchParams.get("redirect") ??
      url.searchParams.get("return_to") ??
      "/";
    let target = safeSameOriginUrl(url, candidate);

    for (let [name, value] of url.searchParams) {
      if (name !== "redirect" && name !== "return_to" && name !== "discount") {
        target.searchParams.append(name, value);
      }
    }

    return { code, location: relativeUrl(target) };
  }

  if (!url.searchParams.has("discount")) return null;
  let code = normalizeDiscountCode(url.searchParams.get("discount"));
  url.searchParams.delete("discount");
  return { code, location: relativeUrl(url) };
}

function decodePathSegment(value: string): string | null {
  try {
    return normalizeDiscountCode(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function normalizeDiscountCode(value: string | null): string | null {
  return value && value.length <= 255 ? value : null;
}

function safeSameOriginUrl(requestUrl: URL, candidate: string): URL {
  try {
    let target = new URL(candidate, requestUrl);
    return target.origin === requestUrl.origin
      ? target
      : new URL("/", requestUrl);
  } catch {
    return new URL("/", requestUrl);
  }
}

function relativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function noStoreRedirect(response: Response): Response {
  return response.status >= 300 && response.status < 400
    ? noStore(response)
    : response;
}

function noStore(response: Response): Response {
  try {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    let mutableResponse = new Response(response.body, response);
    mutableResponse.headers.set("Cache-Control", "private, no-store");
    return mutableResponse;
  }
}

type SeoRoute = (typeof routes.seo)[keyof typeof routes.seo];

const seoRouteMatcher = createMultiMatcher<SeoRoute>();
for (let route of Object.values(routes.seo)) {
  seoRouteMatcher.add(route.pattern, route);
}

function matchSeoRoute(url: URL): SeoRoute | null {
  return seoRouteMatcher.match(url)?.data ?? null;
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
