import {
  createShopifyRequestContext,
  createStorefrontClient,
} from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
  queryCollection,
  queryHome,
  queryProduct,
  queryProductNavigation,
  queryShellMenus,
  queryShop,
} from "./storefront.ts";

describe("Storefront data", () => {
  it("returns shop data explicitly", async () => {
    let client = createTestClient(async () =>
      storefrontResponse({
        shop: { name: "Remix Store", description: "Soft" },
      }),
    );

    let result = await queryShop(client);

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.name, "Remix Store");
  });

  it("returns GraphQL errors instead of throwing", async () => {
    let client = createTestClient(async () =>
      storefrontResponse(null, [{ message: "Upstream failure" }]),
    );

    let result = await queryShop(client);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(
        result.message,
        "The Storefront API did not return shop data.",
      );
    }
  });

  it("maps valid home editorial data and skips malformed entries", async () => {
    let client = createTestClient(async () =>
      storefrontResponse({
        shop: { name: "Remix Store", description: "Soft" },
        hero: {
          assetImages: {
            references: {
              nodes: [
                {
                  __typename: "MediaImage",
                  id: "media",
                  image: {
                    id: "image",
                    url: "https://cdn.shopify.com/frame.jpg?foo=bar",
                    altText: "Frame",
                    width: 2400,
                    height: 1350,
                  },
                },
                { __typename: "Product", id: "wrong" },
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
                  id: "entry",
                  fields: [
                    {
                      key: "image",
                      reference: {
                        __typename: "MediaImage",
                        id: "lookbook-media",
                        presentation: {
                          asJson: { focalPoint: { x: 0.25, y: 0.75 } },
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
                    {
                      key: "product",
                      reference: {
                        __typename: "Product",
                        id: "product",
                        handle: "racing-shirt",
                        title: "Racing Shirt",
                        priceRange: {
                          minVariantPrice: {
                            amount: "42.00",
                            currencyCode: "USD",
                          },
                        },
                      },
                    },
                  ],
                },
                { __typename: "Metaobject", id: "invalid", fields: [] },
              ],
            },
          },
        },
      }),
    );

    let result = await queryHome(client);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.hero?.collectionHandle, "racing");
    assert.equal(result.data.hero?.assetImages.length, 1);
    let heroUrl = new URL(result.data.hero!.assetImages[0]!.url);
    assert.equal(heroUrl.searchParams.get("foo"), "bar");
    assert.equal(heroUrl.searchParams.get("width"), "1600");
    assert.equal(heroUrl.searchParams.get("height"), "900");
    assert.equal(heroUrl.searchParams.get("crop"), "center");
    assert.equal(result.data.lookbookEntries.length, 1);
    assert.deepEqual(result.data.lookbookEntries[0]?.focalPoint, {
      x: 0.25,
      y: 0.75,
    });
    assert.equal(
      result.data.lookbookEntries[0]?.product?.handle,
      "racing-shirt",
    );
  });

  it("returns safe empty editorial fallbacks when metaobjects are missing", async () => {
    let client = createTestClient(async () =>
      storefrontResponse({
        shop: { name: "Remix Store", description: null },
        hero: null,
        lookbook: {
          entries: {
            references: {
              nodes: [
                { __typename: "Metaobject", id: "missing-image", fields: [] },
              ],
            },
          },
        },
      }),
    );

    let result = await queryHome(client);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.hero, null);
    assert.deepEqual(result.data.lookbookEntries, []);
  });

  it("maps collection cards and preserves pagination variables", async () => {
    let requestBody: { variables?: Record<string, unknown> } | undefined;
    let client = createTestClient(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return storefrontResponse({
        collection: {
          id: "collection",
          handle: "racing",
          title: "Racing",
          description: "Racing apparel",
          products: {
            nodes: [
              {
                id: "product",
                handle: "shirt",
                title: "Shirt",
                images: { nodes: [] },
                selectedOrFirstAvailableVariant: {
                  price: { amount: "20.00", currencyCode: "USD" },
                  compareAtPrice: { amount: "30.00", currencyCode: "USD" },
                },
                priceRange: {
                  maxVariantPrice: { amount: "25.00", currencyCode: "USD" },
                },
              },
            ],
            pageInfo: { hasNextPage: true, endCursor: "next" },
          },
        },
      });
    });

    let result = await queryCollection(client, "racing", {
      after: "current",
      first: 8,
    });

    assert.deepEqual(requestBody?.variables, {
      after: "current",
      country: "US",
      first: 8,
      handle: "racing",
      language: "EN",
    });
    assert.equal(result.ok, true);
    if (!result.ok || !result.data) return;
    assert.deepEqual(result.data.products.nodes[0], {
      compareAtPrice: "$30.00",
      handle: "shirt",
      id: "product",
      images: [],
      isOnSale: true,
      price: "$20.00",
      title: "Shirt",
    });
    assert.deepEqual(result.data.products.pageInfo, {
      hasNextPage: true,
      endCursor: "next",
    });
  });

  it("returns collection and product GraphQL failures explicitly", async () => {
    let client = createTestClient(async () =>
      storefrontResponse(null, [{ message: "Upstream failure" }]),
    );

    let collection = await queryCollection(client, "racing");
    let product = await queryProduct(client, "shirt", new URLSearchParams());

    assert.equal(collection.ok, false);
    if (!collection.ok) {
      assert.equal(
        collection.message,
        "The Storefront API did not return collection data.",
      );
    }
    assert.equal(product.ok, false);
    if (!product.ok) {
      assert.equal(
        product.message,
        "The Storefront API did not return product data.",
      );
    }
  });

  it("returns missing collection and product data without an error", async () => {
    let collectionClient = createTestClient(async () =>
      storefrontResponse({ collection: null }),
    );
    let productClient = createTestClient(async () =>
      storefrontResponse({ product: null }),
    );

    let collection = await queryCollection(collectionClient, "missing");
    let product = await queryProduct(
      productClient,
      "missing",
      new URLSearchParams(),
    );

    assert.deepEqual(collection, { ok: true, data: null });
    assert.deepEqual(product, { ok: true, data: null });
  });

  it("normalizes internal menu links and policy routes", async () => {
    let client = createTestClient(async () =>
      storefrontResponse({
        menu: {
          items: [
            {
              id: "all",
              title: "All Products",
              url: "https://shop.example.com/collections/all?sort=best#grid",
            },
            {
              id: "external",
              title: "Remix",
              url: "https://remix.run/",
            },
            {
              id: "unsafe",
              title: "Unsafe",
              url: "javascript:alert(1)",
            },
            { id: "empty", title: "Empty", url: null },
          ],
        },
        footerMenu: {
          items: [
            {
              id: "privacy",
              title: "Privacy Policy",
              url: "https://example.myshopify.com/policies/privacy-policy",
            },
            {
              id: "external-privacy",
              title: "Privacy Policy",
              url: "https://remix.run/privacy",
            },
          ],
        },
        shop: { primaryDomain: { url: "https://shop.example.com" } },
      }),
    );

    let result = await queryShellMenus(client, "example.myshopify.com");

    assert.deepEqual(result.navigationMenu.items, [
      {
        id: "all",
        title: "All Products",
        url: "/collections/all?sort=best#grid",
      },
      { id: "external", title: "Remix", url: "https://remix.run/" },
      { id: "unsafe", title: "Unsafe", url: "/" },
    ]);
    assert.deepEqual(result.footerMenu.items, [
      {
        id: "privacy",
        title: "Privacy Policy",
        url: "/policies/privacy-policy",
      },
      {
        id: "external-privacy",
        title: "Privacy Policy",
        url: "https://remix.run/privacy",
      },
    ]);
  });

  it("normalizes the dedicated product sidebar menu", async () => {
    let client = createTestClient(async () =>
      storefrontResponse({
        menu: {
          items: [
            {
              id: "all",
              title: "All products",
              url: "https://shop.example.com/collections/all",
            },
          ],
        },
        shop: { primaryDomain: { url: "https://shop.example.com" } },
      }),
    );

    let result = await queryProductNavigation(client, "example.myshopify.com");

    assert.deepEqual(result.items, [
      { id: "all", title: "All products", url: "/collections/all" },
    ]);
  });

  it("falls back when menu data is unavailable", async (t) => {
    let client = createTestClient(async () => {
      throw new TypeError("connection lost");
    });
    t.mock.method(console, "error", () => {});

    let result = await queryShellMenus(client, "example.myshopify.com");

    assert.equal(result.navigationMenu, FALLBACK_NAVIGATION_MENU);
    assert.equal(result.footerMenu, FALLBACK_FOOTER_MENU);
  });

  it("returns transport failures instead of exposing them", async () => {
    let client = createTestClient(async () => {
      throw new TypeError("connection lost");
    });

    let result = await queryShop(client);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "The Storefront API request failed.");
      assert.ok(result.errors instanceof Error);
    }
  });
});

function createTestClient(fetch: typeof globalThis.fetch) {
  return createStorefrontClient({
    type: "public",
    requestContext: createShopifyRequestContext({
      request: new Request("https://storefront.example/"),
      i18n: { country: "US", language: "EN" },
    }),
    config: {
      storeDomain: "example.myshopify.com",
      publicStorefrontToken: "test-token",
      cache: new TestCache(),
      fetch,
    },
  });
}

class TestCache {
  get() {}
  set() {}
  delete() {}
}

function storefrontResponse(
  data: unknown,
  errors?: Array<{ message: string }>,
) {
  return new Response(JSON.stringify(errors ? { data, errors } : { data }), {
    headers: { "Content-Type": "application/json" },
  });
}
