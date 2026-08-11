import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MemoryStorefrontCache } from "../data/storefront-cache.ts";
import { render } from "../middleware/render.tsx";
import { createApp } from "../router.ts";
import { routes } from "../routes.ts";

const testEnv = {
  PUBLIC_STORE_DOMAIN: "example.myshopify.com",
  ["PUBLIC_" + "STOREFRONT_API_TOKEN"]: "test-token",
};

function createTestApp(fetch: typeof globalThis.fetch = shellMenuFetch) {
  return createApp({
    renderer: render({
      documentAssets: { css: [], entry: "/assets/entry.js", js: [] },
      resolveClientEntry(_entryId, component) {
        return { href: "/assets/component.js", exportName: component.name };
      },
    }),
    storefront: { cache: new MemoryStorefrontCache(), env: testEnv, fetch },
  });
}

const shellMenuFetch = (async () =>
  new Response(
    JSON.stringify({
      data: {
        menu: null,
        footerMenu: null,
        shop: { primaryDomain: { url: "https://example.com" } },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  )) as typeof globalThis.fetch;

describe("platform skeleton", () => {
  it("server-renders live Storefront API data and a hydration entry", async () => {
    let calls = 0;
    let mockFetch = (async (_input, init) => {
      calls++;
      let query = JSON.parse(String(init?.body)).query as string;
      let data = query.includes("RemixNavigation")
        ? {
            menu: {
              items: [
                {
                  id: "all",
                  title: "All Products",
                  url: "https://example.myshopify.com/collections/all",
                },
              ],
            },
            footerMenu: null,
            shop: { primaryDomain: { url: "https://shop.example.com" } },
          }
        : {
            shop: {
              name: "Test Remix Store",
              description: "A test storefront",
            },
            hero: {
              assetImages: {
                references: {
                  nodes: [
                    {
                      __typename: "MediaImage",
                      id: "hero-media",
                      image: {
                        id: "hero-image",
                        url: "https://cdn.shopify.com/hero.jpg",
                        altText: "Racing collection",
                        width: 1600,
                        height: 900,
                      },
                    },
                  ],
                },
              },
              collection: {
                reference: { __typename: "Collection", handle: "racing" },
              },
            },
            lookbook: {
              entries: {
                references: {
                  nodes: [
                    {
                      __typename: "Metaobject",
                      id: "lookbook-entry",
                      fields: [
                        {
                          key: "image",
                          reference: {
                            __typename: "MediaImage",
                            id: "lookbook-media",
                            presentation: {
                              asJson: {
                                focalPoint: { x: 0.4, y: 0.6 },
                              },
                            },
                            image: {
                              id: "lookbook-image",
                              url: "https://cdn.shopify.com/lookbook.jpg",
                              altText: "Lookbook",
                              width: 1200,
                              height: 1600,
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          };
      return new Response(JSON.stringify({ data }), {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
    let app = createTestApp(mockFetch);

    let response = await app.fetch(
      new Request("https://example.com" + routes.home.href()),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.match(html, /Test Remix Store/);
    assert.match(html, /Main navigation/);
    assert.match(html, /All Products/);
    assert.match(html, /Store policies/);
    assert.match(html, /"exportName":"RemixLogo"/);
    assert.match(html, /"exportName":"Footer"/);
    assert.match(html, /Remix 3 Racing Team Collection/);
    assert.match(html, /Shop New Items/);
    assert.match(html, /\/collections\/racing/);
    assert.match(html, /cdn\.shopify\.com\/hero\.jpg/);
    assert.match(html, /cdn\.shopify\.com\/lookbook\.jpg/);
    assert.match(html, /Coming Soon/);
    assert.match(html, /object-position: 40% 60%/);
    assert.match(html, /Product catalog goes here/);
    assert.match(html, /--color-blue-brand: #20aaff/);
    assert.doesNotMatch(html, /--color-blue:/);
    assert.match(html, /inter-italic-latin-var\.woff2/);
    assert.match(html, /lexend-zetta-black\.woff2/);
    assert.match(html, /"exportName":"HomeHero"/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("renders a branded 500 when the Storefront API returns errors", async () => {
    let mockFetch = (async () =>
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "Upstream failure" }],
        }),
        { headers: { "Content-Type": "application/json" } },
      )) as typeof globalThis.fetch;
    let app = createTestApp(mockFetch);
    let originalConsoleError = console.error;
    console.error = () => {};

    try {
      let response = await app.fetch(
        new Request("https://example.com" + routes.home.href()),
      );
      let html = await response.text();

      assert.equal(response.status, 500);
      assert.match(html, /Storefront unavailable/);
      assert.doesNotMatch(html, /Upstream failure/);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("returns a server-rendered 404 for unknown routes", async () => {
    let app = createTestApp();

    let response = await app.fetch(new Request("https://example.com/missing"));

    assert.equal(response.status, 404);
    let html = await response.text();
    assert.match(html, /Page not found/);
    assert.doesNotMatch(html, /\/brand\/matrix\/error-404\.png/);
    assert.match(html, /Return home/);
  });
});
