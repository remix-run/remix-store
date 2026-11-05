import {
  handleShopifyRedirects,
  handleShopifyRoutes,
  type ShopifyRequestContext,
} from "@shopify/hydrogen";
import { SuperHeaders } from "remix/headers";
import { redirect } from "remix/response/redirect";

import { cartHandlers } from "../data/cart-handlers.ts";
import { applyDiscountCode } from "../data/discount.ts";
import type { AppStorefrontClient } from "../data/storefront.ts";
import { cacheControl } from "../lib/cache-control.ts";
import {
  localizeInternalUrl,
  type ActiveMarket,
} from "../lib/public/market.ts";
import { routeTemplates } from "../lib/public/route-templates.ts";

export interface ShopifyRouteContext {
  market: ActiveMarket;
  request: Request;
  requestContext: ShopifyRequestContext;
  storefrontClient: AppStorefrontClient;
  /** The prefix-free app URL; the market lives on the request-scoped client. */
  url: URL;
}

/**
 * Answer Shopify-owned checkout, permalink, AJAX cart, `/api/cart`, and
 * discount-link requests before the app router, or return null.
 */
export async function handleShopifyCompatibilityRoute(
  context: ShopifyRouteContext,
): Promise<Response | null> {
  let routingRequest = requestWithUrl(context.request, context.url);
  let shopifyRoute = handleShopifyRoutes({
    request: routingRequest,
    requestContext: context.requestContext,
    sessionManager: createEphemeralHydrogenRouteSessionManager(routingRequest),
    storefrontClient: context.storefrontClient,
    routeTemplates,
    handlers: [cartHandlers],
  });
  if (shopifyRoute) {
    return noStore(
      localizeRedirect(await shopifyRoute, context.market, context.url),
    );
  }

  let discount = getDiscountRequest(routingRequest);
  if (discount) {
    return applyResponseHeaders(
      context.requestContext,
      await discountRedirect(context, discount),
    );
  }

  return null;
}

/**
 * Give an app 404 the chance to follow a Shopify URL redirect, keeping every
 * redirect private and inside the active market.
 */
export async function withShopifyRedirect(
  context: ShopifyRouteContext,
  response: Response,
): Promise<Response> {
  if (response.status === 404) {
    response =
      (await handleShopifyRedirects({
        request: requestWithUrl(context.request, context.url),
        storefrontClient: context.storefrontClient,
        routeTemplates,
      })) ?? response;
    response = localizeRedirect(response, context.market, context.url);
  }
  return noStoreRedirect(response);
}

export function applyResponseHeaders(
  requestContext: ShopifyRequestContext,
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

  let localized = localizeInternalUrl(relativeUrl(target), market.pathPrefix);
  if (localized === location) return response;
  let mutable = new Response(response.body, response);
  mutable.headers.set("Location", localized);
  return mutable;
}

interface DiscountRequest {
  code: string | null;
  location: string;
}

/**
 * Redirect away from a discount link, applying the code to the cart on GET.
 * A failed application still redirects; the shopper just keeps full price.
 */
async function discountRedirect(
  { market, request, storefrontClient }: ShopifyRouteContext,
  discount: DiscountRequest,
): Promise<Response> {
  let location = localizeInternalUrl(discount.location, market.pathPrefix);
  let headers = new SuperHeaders({
    Location: location,
    cacheControl: cacheControl.privateNoStore,
  });

  if (discount.code && request.method === "GET") {
    try {
      let discountHeaders = await applyDiscountCode(
        request,
        storefrontClient,
        discount.code,
      );
      for (let [name, value] of discountHeaders) headers.append(name, value);
    } catch (error) {
      if (request.signal.aborted && error === request.signal.reason)
        throw error;
      console.error("[hydrogen] Discount application failed");
    }
  }

  return redirect(location, { status: 303, headers });
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
  // Copying the headers also covers responses whose headers are immutable.
  let headers = new SuperHeaders(response.headers);
  headers.cacheControl = cacheControl.privateNoStore;
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
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
