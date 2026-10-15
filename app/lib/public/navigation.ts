/** Whether a menu link points at the page being viewed, ignoring its query. */
export function isCurrentPage(href: string, pathname: string): boolean {
  let target = new URL(href, "http://localhost").pathname;
  return trimTrailingSlash(target) === trimTrailingSlash(pathname);
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
