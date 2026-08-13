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
    let staticBody = await staticResponse.text();
    assert.match(staticBody, /xmlns:xhtml=/);
    assert.match(staticBody, /<loc>https:\/\/preview\.example\/<\/loc>/);
    assert.match(staticBody, /<loc>https:\/\/preview\.example\/en-ca\/<\/loc>/);
    assert.equal((staticBody.match(/hreflang="en-US"/g) ?? []).length, 2);
    assert.equal((staticBody.match(/hreflang="en-CA"/g) ?? []).length, 2);
    assert.doesNotMatch(staticBody, /fr-CA|\/en-us/);
  });

  it("keeps prefixed sitemap requests canonical while querying distinct fixed US and CA contexts", async () => {
    let contexts: Array<{
      operation: string;
      variables: Record<string, unknown>;
    }> = [];
    let resource = (handle: string) => ({
      sitemap: {
        resources: {
          hasNextPage: false,
          items: [
            {
              __typename: "SitemapResource",
              handle,
              updatedAt: "2026-06-15T12:00:00Z",
              image: null,
            },
          ],
        },
      },
    });
    let app = createTestApp(
      createStorefrontFetch({
        RemixCanadianSitemapIndex(body) {
          assert.match(body.query, /@inContext\(country: CA, language: EN\)/);
          contexts.push({ operation: "ca-index", variables: body.variables });
          return {
            products: { pagesCount: { count: 1 } },
            collections: { pagesCount: { count: 0 } },
          };
        },
        RemixCanadianSitemapResources(body) {
          assert.match(body.query, /@inContext\(country: CA, language: EN\)/);
          contexts.push({
            operation: "ca-resources",
            variables: body.variables,
          });
          return resource("canadian-shirt");
        },
        RemixSitemapIndex(body) {
          assert.match(body.query, /@inContext\(country: US, language: EN\)/);
          contexts.push({ operation: "us-index", variables: body.variables });
          return {
            products: { pagesCount: { count: 1 } },
            collections: { pagesCount: { count: 0 } },
          };
        },
        RemixSitemapResources(body) {
          assert.match(body.query, /@inContext\(country: US, language: EN\)/);
          contexts.push({
            operation: "us-resources",
            variables: body.variables,
          });
          return resource("us-shirt");
        },
      }),
    );

    let indexResponse = await app.fetch(
      new Request("https://preview.example/en-ca/sitemap.xml"),
    );
    let resourceResponse = await app.fetch(
      new Request("https://preview.example/en-ca/sitemap/products/1.xml"),
    );
    let [indexBody, resourceBody] = await Promise.all([
      indexResponse.text(),
      resourceResponse.text(),
    ]);

    assert.equal(indexResponse.status, 200);
    assert.equal(resourceResponse.status, 200);
    assert.deepEqual(
      contexts.toSorted((left, right) =>
        left.operation.localeCompare(right.operation),
      ),
      [
        { operation: "ca-index", variables: {} },
        {
          operation: "ca-resources",
          variables: { page: 1, type: "PRODUCT" },
        },
        { operation: "us-index", variables: {} },
        {
          operation: "us-resources",
          variables: { page: 1, type: "PRODUCT" },
        },
      ],
    );
    assert.match(indexBody, /https:\/\/preview\.example\/sitemap\/static\.xml/);
    assert.match(
      indexBody,
      /https:\/\/preview\.example\/sitemap\/products\/1\.xml/,
    );
    assert.doesNotMatch(indexBody, /\/en-ca\/sitemap/);
    assert.match(
      resourceBody,
      /<loc>https:\/\/preview\.example\/products\/us-shirt<\/loc>/,
    );
    assert.match(
      resourceBody,
      /<loc>https:\/\/preview\.example\/en-ca\/products\/canadian-shirt<\/loc>/,
    );
    assert.doesNotMatch(resourceBody, /\/en-ca\/products\/us-shirt/);
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
    assert.match(
      body,
      /<loc>https:\/\/preview\.example\/en-ca\/products\/remix-shirt<\/loc>/,
    );
    assert.match(body, /hreflang="en-US"/);
    assert.match(body, /hreflang="en-CA"/);
    assert.match(body, /<lastmod>2026-06-15T12:00:00Z<\/lastmod>/);
    assert.match(body, /<changefreq>weekly<\/changefreq>/);
    assert.match(body, /xmlns:image=/);
    assert.match(body, /v=1&amp;width=1200/);
    assert.match(body, /Remix &amp; friends/);
  });

  it("emits market-only resources without false alternates", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixCanadianSitemapResources: () => ({
          sitemap: {
            resources: {
              hasNextPage: false,
              items: [
                {
                  __typename: "SitemapResource",
                  handle: "canada-only",
                  updatedAt: "2026-06-15T12:00:00Z",
                  image: null,
                },
              ],
            },
          },
        }),
        RemixNavigation: navigationData,
        RemixSitemapResources: () => ({
          sitemap: {
            resources: {
              hasNextPage: false,
              items: [
                {
                  __typename: "SitemapResource",
                  handle: "us-only",
                  updatedAt: "2026-06-15T12:00:00Z",
                  image: null,
                },
              ],
            },
          },
        }),
      }),
    );

    let response = await app.fetch(
      new Request("https://preview.example/sitemap/products/1.xml"),
    );
    let body = await response.text();

    assert.match(body, /https:\/\/preview\.example\/products\/us-only/);
    assert.match(
      body,
      /https:\/\/preview\.example\/en-ca\/products\/canada-only/,
    );
    assert.doesNotMatch(body, /hreflang=/);
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
