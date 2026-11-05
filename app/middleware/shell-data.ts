import { createMultiMatcher } from "remix/route-pattern/match";

import { loadAnalyticsShopOrNull } from "../data/analytics-shop.ts";
import { getCartData } from "../data/cart-handlers.ts";
import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
  loadShellMenusOrFallback,
} from "../data/menus.ts";
import type { AppStorefrontClient } from "../data/storefront.ts";
import { routes } from "../routes.ts";
import type { ShellData } from "../ui/shell-data.tsx";

/** The Storefront part of the page shell: menus, sale, cart, analytics. */
export type StorefrontShellData = Omit<ShellData, "currentPath" | "market">;

export const FALLBACK_SHELL_DATA: StorefrontShellData = {
  analyticsShop: null,
  cartInitialData: { cart: null },
  footerMenu: FALLBACK_FOOTER_MENU,
  navigationMenu: FALLBACK_NAVIGATION_MENU,
  storeWideSale: null,
};

/**
 * Requests from Remix's browser runtime. The page that sends them has already
 * hydrated, so client-owned state such as the cart is live in the browser.
 */
export function isClientNavigation(request: Request): boolean {
  return request.headers.get("X-Remix-Frame") === "true";
}

/**
 * Load the menus, cart, and analytics shop for responses that render the page
 * shell. Everything else gets the fallback without any Storefront requests.
 */
export function loadShellData(
  request: Request,
  url: URL,
  storefrontClient: AppStorefrontClient,
): Promise<StorefrontShellData> {
  if (!rendersPageShell(request, url)) {
    return Promise.resolve(FALLBACK_SHELL_DATA);
  }
  return Promise.all([
    loadShellMenusOrFallback(storefrontClient),
    isClientNavigation(request)
      ? undefined
      : getCartData(request, storefrontClient),
    loadAnalyticsShopOrNull(storefrontClient),
  ]).then(([shellMenus, cartInitialData, analyticsShop]) => ({
    ...shellMenus,
    cartInitialData,
    analyticsShop,
  }));
}

/**
 * Routes whose responses never include the page shell: SEO documents and the
 * product grid fragments, which render only cards.
 */
const shellFreeRoutes = [
  ...Object.values(routes.seo),
  routes.collections.products,
  routes.collections.loadMore,
];
const shellFreeRouteMatcher = createMultiMatcher<true>();
for (let route of shellFreeRoutes) {
  shellFreeRouteMatcher.add(route.pattern, true);
}

function rendersPageShell(request: Request, url: URL): boolean {
  // Form submissions render at most a result page with the fallback shell.
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return shellFreeRouteMatcher.match(url) == null;
}
