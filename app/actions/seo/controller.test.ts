import { createCartCookie } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../../testing/storefront.ts";

describe("SEO resource routes", () => {
  it("publishes crawler rules while loading only the required shop identity", async () => {
    let shellQueries = 0;
    let app = seoApp(undefined, () => shellQueries++);

    let response = await app.fetch(
      new Request("https://preview.example/robots.txt"),
    );
    let body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(shellQueries, 1);
    assert.equal(
      response.headers.get("Cache-Control"),
      "public, max-age=86400",
    );
    assert.match(response.headers.get("Content-Type") ?? "", /^text\/plain/);
    assert.match(body, /^User-agent: \*/);
    assert.match(body, /Disallow: \/cart/);
    assert.match(body, /Disallow: \/admin/);
    assert.match(body, /Disallow: \/\*\/collections\/\*%2B\*/);
    assert.match(body, /Disallow: \/blogs\/\*\+\*/);
    assert.match(body, /Disallow: \/policies\//);
    assert.match(body, /Disallow: \/\*\/\*\?\*ls=\*&ls=\*/);
    assert.match(body, /Disallow: \/test\/checkouts/);
    assert.match(body, /Sitemap: https:\/\/preview\.example\/sitemap\.xml/);
  });

  it("indexes every Storefront sitemap page without loading HTML shell data", async () => {
    let shellQueries = 0;
    let app = seoApp(undefined, () => shellQueries++);
    let cookie = createCartCookie("gid://shopify/Cart/test").split(";", 1)[0];

    let response = await app.fetch(
      new Request("https://preview.example/sitemap.xml", {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    let body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(shellQueries, 0);
    assert.match(
      response.headers.get("Content-Type") ?? "",
      /^application\/xml/,
    );
    assert.match(body, /<sitemapindex/);
    assert.match(body, /https:\/\/preview\.example\/sitemap\/static\.xml/);
    assert.match(body, /https:\/\/preview\.example\/sitemap\/products\/1\.xml/);
    assert.match(body, /https:\/\/preview\.example\/sitemap\/products\/2\.xml/);
    assert.match(
      body,
      /https:\/\/preview\.example\/sitemap\/collections\/1\.xml/,
    );

    let staticResponse = await app.fetch(
      new Request("https://preview.example/sitemap/static.xml"),
    );
    assert.match(
      await staticResponse.text(),
      /<loc>https:\/\/preview\.example\/<\/loc>/,
    );
  });

  it("renders canonical product URLs and image metadata from Shopify", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = seoApp((body) => {
      variables = body.variables;
      return {
        sitemap: {
          resources: {
            hasNextPage: false,
            items: [
              {
                __typename: "SitemapResource",
                handle: "remix-shirt",
                updatedAt: "2026-06-15T12:00:00Z",
                image: {
                  alt: "Remix & friends",
                  filepath: "https://cdn.shopify.com/shirt.jpg?v=1&width=1200",
                },
              },
            ],
          },
        },
      };
    });

    let response = await app.fetch(
      new Request("https://preview.example/sitemap/products/3.xml"),
    );
    let body = await response.text();

    assert.deepEqual(variables, { page: 3, type: "PRODUCT" });
    assert.match(
      body,
      /<loc>https:\/\/preview\.example\/products\/remix-shirt<\/loc>/,
    );
    assert.match(body, /<lastmod>2026-06-15T12:00:00Z<\/lastmod>/);
    assert.match(body, /<changefreq>weekly<\/changefreq>/);
    assert.match(body, /xmlns:image=/);
    assert.match(body, /v=1&amp;width=1200/);
    assert.match(body, /Remix &amp; friends/);
  });

  it("uses Hydrogen's homepage fallback for an empty resource page", async () => {
    let response = await seoApp().fetch(
      new Request("https://preview.example/sitemap/collections/2.xml"),
    );

    assert.equal(response.status, 200);
    assert.match(
      await response.text(),
      /<loc>https:\/\/preview\.example\/<\/loc>/,
    );
  });

  it("returns a retryable 503 when Shopify cannot generate a sitemap", async (t) => {
    let app = seoApp(() => {
      throw new Error("Storefront unavailable");
    });
    t.mock.method(console, "error", () => {});

    let response = await app.fetch(
      new Request("https://preview.example/sitemap/products/1.xml"),
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(await response.text(), "Sitemap temporarily unavailable");
  });

  it("rejects unsupported sitemap types and invalid pages without querying Shopify", async () => {
    let app = seoApp(() => {
      throw new Error("resource query should not run");
    });

    let [unsupported, invalidPage] = await Promise.all([
      app.fetch(new Request("https://preview.example/sitemap/pages/1.xml")),
      app.fetch(new Request("https://preview.example/sitemap/products/0.xml")),
    ]);

    assert.equal(unsupported.status, 404);
    assert.equal(invalidPage.status, 404);
  });
});

function seoApp(
  resourceHandler: Parameters<
    typeof createStorefrontFetch
  >[0][string] = () => ({
    sitemap: { resources: { hasNextPage: false, items: [] } },
  }),
  onShellQuery: () => void = () => {},
) {
  return createTestApp(
    createStorefrontFetch({
      Cart() {
        onShellQuery();
        return { cart: null };
      },
      RemixAnalyticsShop() {
        onShellQuery();
        return analyticsShopData();
      },
      RemixNavigation() {
        onShellQuery();
        return navigationData();
      },
      RemixSitemapIndex: () => ({
        products: { pagesCount: { count: 2 } },
        collections: { pagesCount: { count: 1 } },
      }),
      RemixSitemapResources: resourceHandler,
    }),
  );
}
