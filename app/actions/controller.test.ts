import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
} from "../testing/storefront.ts";

const shellMenuFetch = createStorefrontFetch({
  RemixAnalyticsShop: analyticsShopData,
  RemixNavigation: navigationData,
});

describe("platform skeleton", () => {
  it("server-renders the storefront shell and browser entry", async () => {
    let response = await fetchHome();
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(
      html,
      /<script src="\/assets\/entry\.js" type="module"><\/script>/,
    );
    assert.match(html, /Test Remix Store/);
    assert.match(html, /Main navigation/);
    assert.match(html, /All Products/);
    assert.match(html, /Store policies/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("server-renders home editorial and catalog data", async () => {
    let response = await fetchHome();
    let html = await response.text();

    assert.match(html, /Remix 3 Racing Team Collection/);
    assert.match(html, /Shop New Items/);
    assert.match(html, /href="\/collections\/racing"/);
    assert.match(html, /cdn\.shopify\.com\/hero\.jpg/);
    assert.match(html, /cdn\.shopify\.com\/lookbook\.jpg/);
    assert.match(html, /Coming Soon/);
    assert.match(html, /Test catalog product/);
  });

  it("renders a branded 500 when the Storefront API returns errors", async (t) => {
    let mockFetch = (async () =>
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "Upstream failure" }],
        }),
        { headers: { "Content-Type": "application/json" } },
      )) as typeof globalThis.fetch;
    let app = createTestApp(mockFetch);
    t.mock.method(console, "error", () => {});

    let response = await app.fetch(
      new Request("https://example.com" + routes.home.href()),
    );
    let html = await response.text();

    assert.equal(response.status, 500);
    assert.match(html, /Storefront unavailable/);
    assert.doesNotMatch(html, /Upstream failure/);
  });

  it("returns a server-rendered 404 for unknown routes", async () => {
    let app = createTestApp(shellMenuFetch);

    let response = await app.fetch(new Request("https://example.com/missing"));

    assert.equal(response.status, 404);
    let html = await response.text();
    assert.match(html, /Page not found/);
    assert.doesNotMatch(html, /\/brand\/matrix\/error-404\.png/);
    assert.match(html, /Return home/);
  });
});

function fetchHome() {
  let app = createTestApp(
    createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixCollection: collectionData,
      RemixHomeEditorial: homeData,
      RemixNavigation: navigationData,
    }),
  );

  return app.fetch(new Request("https://example.com" + routes.home.href()));
}

function navigationData() {
  return {
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
  };
}

function homeData() {
  return {
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
                      asJson: { focalPoint: { x: 0.4, y: 0.6 } },
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
}

function collectionData() {
  return {
    collection: {
      id: "gid://shopify/Collection/1",
      handle: "all",
      title: "All products",
      description: "The complete catalog",
      products: {
        nodes: [
          {
            id: "gid://shopify/Product/1",
            handle: "test-catalog-product",
            title: "Test catalog product",
            images: { nodes: [] },
            selectedOrFirstAvailableVariant: null,
            priceRange: {
              minVariantPrice: { amount: "20.00", currencyCode: "USD" },
              maxVariantPrice: { amount: "20.00", currencyCode: "USD" },
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  };
}
