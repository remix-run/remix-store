import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { loadAnalyticsShopOrNull } from "../../data/analytics-shop.ts";
import { isStorefrontFailure } from "../../data/storefront.ts";
import {
  querySitemapPageCounts,
  querySitemapResources,
  type SitemapResourceType,
} from "./data.ts";
import { cacheControl } from "../../lib/cache-control.ts";
import { robotsResponse } from "./robots.ts";
import {
  sitemapIndexResponse,
  sitemapResponse,
  type SitemapUrl,
} from "./sitemap.ts";
import { CA_MARKET, marketUrl, US_MARKET } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";

export default createController(routes.seo, {
  actions: {
    async robots({ storefrontClient, url }) {
      let analyticsShop = await loadAnalyticsShopOrNull(storefrontClient);
      return robotsResponse({
        origin: url.origin,
        shopId: analyticsShop?.shopId,
        sitemapPath: routes.seo.sitemapIndex.href(),
      });
    },
    async sitemapIndex({ storefrontClient, url }) {
      try {
        let [usCounts, caCounts] = await Promise.all([
          querySitemapPageCounts(storefrontClient, US_MARKET.country),
          querySitemapPageCounts(storefrontClient, CA_MARKET.country),
        ]);
        let locations = [url.origin + routes.seo.sitemapStatic.href()];

        for (let type of ["products", "collections"] as const) {
          let pageCount = Math.max(usCounts[type], caCounts[type]);
          for (let page = 1; page <= pageCount; page++) {
            locations.push(
              url.origin +
                routes.seo.sitemapResource.href({ page: String(page), type }),
            );
          }
        }

        return sitemapIndexResponse(locations);
      } catch (error) {
        if (!isStorefrontFailure(error)) throw error;
        return sitemapUnavailable(error);
      }
    },
    sitemapStatic({ url }) {
      let home = marketUrl(url, routes.home.href(), US_MARKET.pathPrefix);
      let canadianHome = marketUrl(
        url,
        routes.home.href(),
        CA_MARKET.pathPrefix,
      );
      let alternates = [
        { href: home, hreflang: US_MARKET.locale },
        { href: canadianHome, hreflang: CA_MARKET.locale },
      ];
      return sitemapResponse(
        [
          { alternates, location: home },
          { alternates, location: canadianHome },
        ],
        { fallbackLocation: home },
      );
    },
    async sitemapResource({ params, storefrontClient, url }) {
      let type = sitemapType(params.type);
      let page = positiveInteger(params.page);
      if (!type || !page) return new Response("Not Found", { status: 404 });

      try {
        let [usSitemap, caSitemap] = await Promise.all([
          querySitemapResources(
            storefrontClient,
            type,
            page,
            US_MARKET.country,
          ),
          querySitemapResources(
            storefrontClient,
            type,
            page,
            CA_MARKET.country,
          ),
        ]);
        let usByHandle = new Map(
          usSitemap.items.map((item) => [item.handle, item]),
        );
        let caByHandle = new Map(
          caSitemap.items.map((item) => [item.handle, item]),
        );
        let handles = new Set([...usByHandle.keys(), ...caByHandle.keys()]);
        let urls: SitemapUrl[] = [...handles].flatMap((handle) => {
          let usItem = usByHandle.get(handle);
          let caItem = caByHandle.get(handle);
          let pathname =
            type === "products"
              ? routes.products.show.href({ handle })
              : routes.collections.show.href({ handle });
          let usLocation = marketUrl(url, pathname, US_MARKET.pathPrefix);
          let caLocation = marketUrl(url, pathname, CA_MARKET.pathPrefix);
          let alternates =
            usItem && caItem
              ? [
                  { href: usLocation, hreflang: US_MARKET.locale },
                  { href: caLocation, hreflang: CA_MARKET.locale },
                ]
              : undefined;
          let sitemapUrl = (
            item: NonNullable<typeof usItem>,
            location: string,
          ): SitemapUrl => ({
            alternates,
            image: item.image?.filepath
              ? {
                  caption: item.image.alt ?? undefined,
                  location: item.image.filepath,
                }
              : undefined,
            lastModified: item.updatedAt,
            location,
          });
          return [
            ...(usItem ? [sitemapUrl(usItem, usLocation)] : []),
            ...(caItem ? [sitemapUrl(caItem, caLocation)] : []),
          ];
        });
        return sitemapResponse(urls, {
          fallbackLocation: url.origin + routes.home.href(),
        });
      } catch (error) {
        if (!isStorefrontFailure(error)) throw error;
        return sitemapUnavailable(error);
      }
    },
  },
});

function sitemapUnavailable(cause: unknown): Response {
  console.error("[seo] Sitemap generation failed", cause);
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: new SuperHeaders({
      cacheControl: cacheControl.noStore,
      contentType: "text/plain; charset=utf-8",
      "Retry-After": "60",
    }),
  });
}

function sitemapType(value: string): SitemapResourceType | null {
  return value === "products" || value === "collections" ? value : null;
}

function positiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  let number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
