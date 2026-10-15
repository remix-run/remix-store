import { resolveMarketPath } from "./market.ts";

/** Whether a menu link points at the page being viewed, ignoring its query. */
export function isCurrentPage(href: string, pathname: string): boolean {
  let target = new URL(href, "http://localhost").pathname;
  return trimTrailingSlash(target) === trimTrailingSlash(pathname);
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Whether a link leads to a catalog page, which is safe to prefetch. Menus
 * come from Shopify and may link to routes with side effects, such as
 * discount codes or cart permalinks.
 */
export function isCatalogLink(href: string): boolean {
  let url = new URL(href, "http://localhost");
  if (url.origin !== "http://localhost") return false;
  let resolution = resolveMarketPath(url.pathname);
  return (
    resolution.kind === "market" &&
    /^\/(collections|products)(\/|$)/.test(resolution.pathname)
  );
}
