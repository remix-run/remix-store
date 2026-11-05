import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  createTestStorefrontClient,
  graphqlResponse,
} from "../testing/storefront-client.ts";
import { queryHome } from "./home.ts";
import { StorefrontQueryError } from "./storefront.ts";

describe("queryHome", () => {
  it("maps valid home editorial data and skips malformed entries", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({
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

    assert.equal(result.hero?.collectionHandle, "racing");
    assert.equal(result.hero?.assetImages.length, 1);
    // The hero sizes and crops its frames for each screen.
    assert.equal(
      result.hero?.assetImages[0]?.url,
      "https://cdn.shopify.com/frame.jpg?foo=bar",
    );
    assert.equal(result.lookbookEntries.length, 1);
    assert.deepEqual(result.lookbookEntries[0]?.focalPoint, {
      x: 0.25,
      y: 0.75,
    });
    assert.equal(result.lookbookEntries[0]?.product?.handle, "racing-shirt");
  });

  it("returns safe empty editorial fallbacks when metaobjects are missing", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({
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

    assert.equal(result.hero, null);
    assert.deepEqual(result.lookbookEntries, []);
  });

  it("renders an empty catalog when only the catalog query fails", async () => {
    let client = createTestStorefrontClient(async (_input, init) => {
      let body = String(init?.body);
      return body.includes("RemixCollection")
        ? graphqlResponse(null, [{ message: "Catalog outage" }])
        : graphqlResponse({
            shop: { name: "Remix Store", description: null },
            hero: null,
            lookbook: null,
          });
    });

    let result = await queryHome(client);

    assert.equal(result.shop.name, "Remix Store");
    assert.deepEqual(result.products, []);
    assert.deepEqual(result.pageInfo, { hasNextPage: false, endCursor: null });
  });

  it("throws when the editorial query fails", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse(null, [{ message: "Upstream failure" }]),
    );

    await assert.rejects(queryHome(client), (error: unknown) => {
      assert.ok(error instanceof StorefrontQueryError);
      assert.equal(
        error.message,
        "The Storefront API did not return home data.",
      );
      return true;
    });
  });
});
