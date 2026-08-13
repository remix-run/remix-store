import { createController } from "remix/router";

import {
  querySitemapPageCounts,
  querySitemapResources,
  type SitemapResourceType,
} from "../../data/seo-resources.ts";
import { robotsResponse } from "../../lib/robots.ts";
import {
  sitemapIndexResponse,
  sitemapResponse,
  type SitemapUrl,
} from "../../lib/sitemap.ts";
import { marketPath } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";

export default createController(routes.seo, {
  actions: {
    robots({ analyticsShop, url }) {
      return robotsResponse({
        origin: url.origin,
        shopId: analyticsShop?.shopId,
        sitemapPath: routes.seo.sitemapIndex.href(),
      });
    },
    async sitemapIndex({ storefrontClient, url }) {
      try {
        let [usCounts, caCounts] = await Promise.all([
          querySitemapPageCounts(storefrontClient, "US"),
          querySitemapPageCounts(storefrontClient, "CA"),
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
        return sitemapUnavailable(error);
      }
    },
    sitemapStatic({ url }) {
      let home = url.origin + routes.home.href();
      let canadianHome = url.origin + marketPath(routes.home.href(), "/en-ca");
      let alternates = [
        { href: home, hreflang: "en-US" as const },
        { href: canadianHome, hreflang: "en-CA" as const },
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
          querySitemapResources(storefrontClient, type, page, "US"),
          querySitemapResources(storefrontClient, type, page, "CA"),
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
          let usLocation = url.origin + pathname;
          let caLocation = url.origin + marketPath(pathname, "/en-ca");
          let alternates =
            usItem && caItem
              ? [
                  { href: usLocation, hreflang: "en-US" as const },
                  { href: caLocation, hreflang: "en-CA" as const },
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
        return sitemapUnavailable(error);
      }
    },
  },
});

function sitemapUnavailable(error: unknown): Response {
  console.error("[seo] Sitemap generation failed", error);
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "60",
    },
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
