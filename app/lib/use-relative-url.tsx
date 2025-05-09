import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { isMagicHidden } from "./show-the-magic";

/**
 * Strips the domain for internal URLs
 */
export function useRelativeUrl(ogUrl: string) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");

  if (!rootData || isMagicHidden(rootData)) {
    throw new Error("Failed to find data for root loader");
  }

  const { header, publicStoreDomain } = rootData;
  const primaryDomainUrl = header.shop.primaryDomain.url;

  const url =
    ogUrl.includes("myshopify.com") ||
    ogUrl.includes(publicStoreDomain) ||
    ogUrl.includes(primaryDomainUrl)
      ? new URL(ogUrl).pathname
      : ogUrl;
  const isExternal = !url.startsWith("/");

  return { url, isExternal };
}
