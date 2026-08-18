import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  testEnv,
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
    assert.match(html, /<title>Home \| The Remix Store<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/"/);
    assert.match(
      html,
      /<meta property="og:site_name" content="The Remix Store"/,
    );
    assert.match(
      html,
      /<meta property="og:url" content="https:\/\/example\.com\/"/,
    );
    assert.match(
      html,
      /<meta name="twitter:card" content="summary_large_image"/,
    );
    assert.match(html, /id="shopify-consent"/);
    assert.match(html, /storefront-banner\.js/);
    assert.match(html, /"mode":"default-banner"/);
    assert.match(html, /Main navigation/);
    assert.match(html, /All Products/);
    assert.match(html, /Store policies/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("attributes Storefront API requests to the configured storefront", async () => {
    let headers: Headers[] = [];
    let upstreamFetch = createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixCollection: collectionData,
      RemixHomeEditorial: homeData,
      RemixNavigation: navigationData,
    });
    let storefrontFetch = (async (input, init) => {
      headers.push(new Headers(init?.headers));
      return upstreamFetch(input, init);
    }) as typeof globalThis.fetch;
    let app = createTestApp(storefrontFetch);

    let response = await app.fetch(new Request("https://example.com/"));

    assert.equal(response.status, 200);
    assert.ok(headers.length > 0);
    for (let requestHeaders of headers) {
      assert.equal(
        requestHeaders.get("Shopify-Storefront-Id"),
        testEnv.PUBLIC_STOREFRONT_ID,
      );
    }
  });

  it("renders Canadian pages with localized links, scripts, canonical, and context", async () => {
    let productVariables: Record<string, unknown> | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: () => ({
          shop: { id: "gid://shopify/Shop/test" },
          localization: { country: { currency: { isoCode: "CAD" } } },
        }),
        RemixCollection(body) {
          productVariables = body.variables;
          return collectionData();
        },
        RemixHomeEditorial: homeData,
        RemixNavigation: navigationData,
      }),
    );

    let response = await app.fetch(new Request("https://example.com/en-ca/"));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<html lang="en-CA" data-market-prefix="\/en-ca"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/example\.com\/en-ca\/"/,
    );
    assert.match(html, /href="\/en-ca\/collections\/racing"/);
    assert.match(html, /href="\/en-ca\/products\/test-catalog-product"/);
    assert.match(html, /country.{0,20}CA/);
    assert.match(html, /active.{0,20}CAD/);
    assert.match(html, /root.{0,30}en-ca/);
    assert.equal(productVariables?.country, "CA");
    assert.equal(productVariables?.language, "EN");
    assert.equal(productVariables?.handle, "all");
  });

  it("server-renders the active sale marquee in the shell", async () => {
    let response = await fetchHome();
    let html = await response.text();

    assert.match(html, /data-store-wide-sale="true"/);
    assert.match(html, /Summer Sale\. 20% off everything\. Ends Jun\.2\./);
    assert.match(html, /Now thru Jun\.2/);
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

  it("server-renders static snow only on December home requests", async () => {
    let decemberApp = createHomeApp(() => new Date("2026-12-01T00:00:00Z"));
    let decemberResponse = await decemberApp.fetch(
      new Request("https://example.com" + routes.home.href()),
    );
    let decemberHtml = await decemberResponse.text();
    assert.match(decemberHtml, /data-seasonal-snow="true"/);
    assert.match(decemberHtml, /data-snow-static="true"/);
    assert.match(decemberHtml, /<canvas aria-hidden="true"><\/canvas>/);
    assert.match(decemberHtml, /\/assets\/component\.js/);

    let nonHomeResponse = await decemberApp.fetch(
      new Request("https://example.com/not-found"),
    );
    assert.doesNotMatch(await nonHomeResponse.text(), /data-seasonal-snow/);

    let januaryResponse = await fetchHome(
      () => new Date("2027-01-01T00:00:00Z"),
    );
    assert.doesNotMatch(await januaryResponse.text(), /data-seasonal-snow/);
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
    assert.match(html, /<title>Something went wrong<\/title>/);
    assert.match(html, /Storefront unavailable/);
    assert.doesNotMatch(html, /Upstream failure/);
  });

  it("returns a server-rendered 404 for unknown routes", async () => {
    let app = createTestApp(shellMenuFetch);

    let response = await app.fetch(new Request("https://example.com/missing"));

    assert.equal(response.status, 404);
    let html = await response.text();
    assert.match(html, /<title>Not Found<\/title>/);
    assert.match(html, /Page not found/);
    assert.doesNotMatch(html, /\/brand\/matrix\/error-404\.png/);
    assert.match(html, /Return home/);
  });
});

function fetchHome(clock: () => Date = () => new Date("2026-06-01T00:00:00Z")) {
  return createHomeApp(clock).fetch(
    new Request("https://example.com" + routes.home.href()),
  );
}

function createHomeApp(clock: () => Date) {
  return createTestApp(
    createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixCollection: collectionData,
      RemixHomeEditorial: homeData,
      RemixNavigation: navigationData,
    }),
    { seasonalSnow: { clock } },
  );
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
    shop: {
      primaryDomain: { url: "https://shop.example.com" },
      storeWideSale: {
        reference: {
          __typename: "Metaobject",
          title: { value: "Summer Sale" },
          description: { value: "20% off everything" },
          endDateTime: { value: "2099-06-02T12:00:00Z" },
        },
      },
    },
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
