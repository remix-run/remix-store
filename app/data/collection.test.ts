import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  createTestStorefrontClient,
  graphqlResponse,
} from "../testing/storefront-client.ts";
import { queryCollection } from "./collection.ts";
import { StorefrontQueryError } from "./storefront.ts";

describe("queryCollection", () => {
  it("maps collection cards and preserves pagination variables", async () => {
    let requestBody: CollectionRequestBody | undefined;
    let client = createTestStorefrontClient(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return graphqlResponse({
        collection: {
          id: "collection",
          handle: "racing",
          title: "Racing",
          description: "Racing apparel",
          seo: { title: null },
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
    assert.ok(result);
    assert.deepEqual(result.products.nodes[0], {
      compareAtPrice: "$30.00",
      handle: "shirt",
      id: "product",
      images: [],
      isOnSale: true,
      price: "$20.00",
      title: "Shirt",
    });
    assert.deepEqual(result.products.pageInfo, {
      hasNextPage: true,
      endCursor: "next",
    });
  });

  it("returns null for a missing collection", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({ collection: null }),
    );

    assert.equal(await queryCollection(client, "missing"), null);
  });

  it("throws GraphQL failures as StorefrontQueryError", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse(null, [{ message: "Upstream failure" }]),
    );

    await assert.rejects(
      queryCollection(client, "racing"),
      (error: unknown) => {
        assert.ok(error instanceof StorefrontQueryError);
        assert.equal(
          error.message,
          "The Storefront API did not return collection data.",
        );
        return true;
      },
    );
  });
});

interface CollectionRequestBody {
  variables?: {
    after?: string;
    country?: string;
    first?: number;
    handle?: string;
    language?: string;
  };
}
