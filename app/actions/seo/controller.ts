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
        let counts = await querySitemapPageCounts(storefrontClient);
        let locations = [url.origin + routes.seo.sitemapStatic.href()];

        for (let type of ["products", "collections"] as const) {
          for (let page = 1; page <= counts[type]; page++) {
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
      return sitemapResponse([{ location: home }], { fallbackLocation: home });
    },
    async sitemapResource({ params, storefrontClient, url }) {
      let type = sitemapType(params.type);
      let page = positiveInteger(params.page);
      if (!type || !page) return new Response("Not Found", { status: 404 });

      try {
        let sitemap = await querySitemapResources(storefrontClient, type, page);
        let urls: SitemapUrl[] = sitemap.items.map((item) => ({
          image: item.image?.filepath
            ? {
                caption: item.image.alt ?? undefined,
                location: item.image.filepath,
              }
            : undefined,
          lastModified: item.updatedAt,
          location:
            url.origin +
            (type === "products"
              ? routes.products.show.href({ handle: item.handle })
              : routes.collections.show.href({ handle: item.handle })),
        }));
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
