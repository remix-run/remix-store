import {
  createShopifyRequestContext,
  createStorefrontClient,
  handleShopifyRedirects,
  handleShopifyRoutes,
  type CacheInstance,
} from "@shopify/hydrogen";
import { createMultiMatcher } from "remix/route-pattern/match";
import { createContextKey, type Middleware } from "remix/router";
import { redirect } from "remix/response/redirect";

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
import {
  localizeInternalUrl,
  type ActiveMarket,
} from "../lib/public/market.ts";
import { routeTemplates } from "../lib/public/route-templates.ts";
import { routes } from "../routes.ts";
import { getRuntime, type Env } from "../runtime.ts";
import { MarketConfig } from "./market.tsx";

export interface StorefrontOptions {
  cache?: CacheInstance;
  env?: Env;
  fetch?: typeof globalThis.fetch;
}

/** Request-scoped data every page shell renders: menus, sale, cart, analytics. */
export interface StorefrontShellData {
  analyticsShop: AnalyticsShop | null;
  cartInitialData: CartInitialData;
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
}

export const EMPTY_SHELL_DATA: StorefrontShellData = {
  analyticsShop: null,
  cartInitialData: { cart: null },
  footerMenu: FALLBACK_FOOTER_MENU,
  navigationMenu: FALLBACK_NAVIGATION_MENU,
  storeWideSale: null,
};

export const StorefrontClient = createContextKey<AppStorefrontClient>();
/**
 * Shell data starts loading before the route runs, so controllers query their
 * own data in parallel instead of after it. The renderer awaits it.
 */
export const ShellDataConfig = createContextKey<Promise<StorefrontShellData>>();
const storefrontProperty = { property: "storefrontClient" } as const;
const shellDataProperty = { property: "shellData" } as const;

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
  ]
> {
  return async (context, next) => {
    // Asset requests are served before any Storefront wiring and never need
    // a Shopify context or cart lookup.
    if (context.url.pathname.startsWith("/assets/")) return next();

    let runtime = getRuntime(context.request);
    let env = { ...runtime.env, ...options.env };

    if (
      !runtime.buyerIp &&
      context.request.method === "POST" &&
      context.url.pathname === routes.subscribe.action.href()
    ) {
      // Subscription abuse controls require an adapter-supplied, trusted IP.
      // Fail closed before Storefront/Admin work, without logging request data.
      let headers = new Headers({ "Cache-Control": "private, no-store" });
      let body = {
        error: "Something went wrong. Please try again.",
        success: false,
      };
      if (context.request.headers.get("Accept")?.includes("application/json")) {
        return Response.json(body, { status: 503, headers });
      }
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Subscribe unavailable</title></head><body><main><h1>Subscribe</h1><p role="alert">Something went wrong. Please try again.</p></main></body></html>',
        { status: 503, headers },
      );
    }

    let storeDomain = env.PUBLIC_STORE_DOMAIN;
    let storefrontId = env["PUBLIC" + "_STOREFRONT_" + "ID"];

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

    let activeMarket = context.get(MarketConfig);
    let requestContext = createShopifyRequestContext({
      request: context.request,
      i18n: activeMarket,
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
        storefrontId,
        privateStorefrontToken,
        cache,
        waitUntil: runtime.waitUntil,
        fetch: storefrontFetch,
      },
    });

    context.set(StorefrontClient, storefrontClient, storefrontProperty);

    let seoRoute = matchSeoRoute(context.url);
    if (seoRoute) {
      let shellData =
        seoRoute === routes.seo.robots
          ? queryAnalyticsShop(
              storefrontClient,
              storefrontId ?? "0",
              normalizeStoreDomain(storeDomain),
            ).then((analyticsShop) => ({ ...EMPTY_SHELL_DATA, analyticsShop }))
          : Promise.resolve(EMPTY_SHELL_DATA);
      context.set(ShellDataConfig, shellData, shellDataProperty);

      return applyResponseHeaders(requestContext, await next());
    }

    // Shopify-owned checkout, permalink, AJAX cart, and /api/cart routes must
    // run before the app router. Match them against the prefix-free app path
    // while retaining the active market on the request-scoped client.
    let routingRequest = requestWithUrl(context.request, context.url);
    let shopifyRoute = handleShopifyRoutes({
      request: routingRequest,
      requestContext,
      sessionManager:
        createEphemeralHydrogenRouteSessionManager(routingRequest),
      storefrontClient,
      routeTemplates,
      handlers: [cartHandlers],
    });
    if (shopifyRoute) {
      return noStore(
        localizeRedirect(await shopifyRoute, activeMarket, context.url),
      );
    }

    let discount = getDiscountRequest(routingRequest);
    if (discount) {
      let location = localizeInternalUrl(
        discount.location,
        activeMarket.pathPrefix,
      );
      let headers = new Headers({
        Location: location,
      });
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
        redirect(location, { status: 303, headers }),
      );
    }

    // Subscription POSTs need the request-scoped Storefront client for fresh
    // variant verification, and product grid fragments render only cards, so
    // neither needs shell/cart network requests.
    if (
      (context.request.method === "POST" &&
        context.url.pathname === routes.subscribe.action.href()) ||
      isProductGridFragment(context.url)
    ) {
      context.set(
        ShellDataConfig,
        Promise.resolve(EMPTY_SHELL_DATA),
        shellDataProperty,
      );
      return applyResponseHeaders(requestContext, await next());
    }

    let shellData = Promise.all([
      queryShellMenus(storefrontClient, storeDomain),
      getCartData(context.request, storefrontClient),
      queryAnalyticsShop(
        storefrontClient,
        storefrontId ?? "0",
        normalizeStoreDomain(storeDomain),
      ),
    ]).then(
      ([shellMenus, cartInitialData, analyticsShop]): StorefrontShellData => ({
        analyticsShop,
        cartInitialData,
        footerMenu: shellMenus.footerMenu,
        navigationMenu: shellMenus.navigationMenu,
        storeWideSale: shellMenus.storeWideSale,
      }),
    );
    // Shell queries only reject when the request aborts. Observe that here so
    // a route that returns without rendering cannot leave it unhandled.
    shellData.catch(() => {});
    context.set(ShellDataConfig, shellData, shellDataProperty);

    let response = await next();
    // Finish every Shopify query before applying its response headers, as
    // when the shell loaded before the route.
    await shellData;
    if (response.status === 404) {
      response =
        (await handleShopifyRedirects({
          request: routingRequest,
          storefrontClient,
          routeTemplates,
        })) ?? response;
      response = localizeRedirect(response, activeMarket, context.url);
    }
    return applyResponseHeaders(requestContext, noStoreRedirect(response));
  };
}

function requestWithUrl(request: Request, url: URL): Request {
  if (request.url === url.href) return request;
  // Share the body: Hydrogen consumes it only when a route matches; otherwise
  // the app controller reads it. Cloning would leave an unread stream branch.
  return new Request(url, request);
}

function localizeRedirect(
  response: Response,
  market: ActiveMarket,
  requestUrl: URL,
): Response {
  if (!market.pathPrefix || response.status < 300 || response.status >= 400) {
    return response;
  }
  let location = response.headers.get("Location");
  if (!location) return response;

  let target: URL;
  try {
    target = new URL(location, requestUrl);
  } catch {
    return response;
  }
  if (target.origin !== requestUrl.origin) return response;

  let localized = localizeInternalUrl(
    `${target.pathname}${target.search}${target.hash}`,
    market.pathPrefix,
  );
  if (localized === location) return response;
  let mutable = new Response(response.body, response);
  mutable.headers.set("Location", localized);
  return mutable;
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

const productGridFragmentMatcher = createMultiMatcher<true>();
productGridFragmentMatcher.add(routes.collections.products.pattern, true);
productGridFragmentMatcher.add(routes.collections.loadMore.pattern, true);

function isProductGridFragment(url: URL): boolean {
  return productGridFragmentMatcher.match(url) != null;
}

type EphemeralHydrogenRouteSessionManager = Parameters<
  typeof handleShopifyRoutes
>[0]["sessionManager"];
type EphemeralSessionItem = Parameters<
  EphemeralHydrogenRouteSessionManager["setSessionItem"]
>[1];

/**
 * Request-local scratch state required by Hydrogen compatibility routes.
 * Values never survive the request and are never committed to a cookie. This
 * is not a durable session boundary and is unsafe for Customer Account API
 * authentication, OAuth state/PKCE/nonces, or any cross-request state.
 */
function createEphemeralHydrogenRouteSessionManager(
  request: Request,
): EphemeralHydrogenRouteSessionManager {
  let values = new Map<string, EphemeralSessionItem>();

  return {
    getSessionOrigin() {
      return new URL(request.url).origin;
    },
    getSessionItem(key: string) {
      return values.get(key);
    },
    setSessionItem(key: string, value: EphemeralSessionItem) {
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
