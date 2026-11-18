/** Whether a menu link points at the page being viewed, ignoring its query. */
export function isCurrentPage(href: string, pathname: string): boolean {
  let target = URL.parse(href, "http://localhost")?.pathname;
  return (
    target !== undefined &&
    trimTrailingSlash(target) === trimTrailingSlash(pathname)
  );
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
