import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  createTestStorefrontClient,
  graphqlResponse,
} from "../testing/storefront-client.ts";
import { queryBackInStockEligibleVariant, queryProduct } from "./product.ts";
import { StorefrontQueryError } from "./storefront.ts";

const VARIANT_ID = "gid://shopify/ProductVariant/1";

describe("queryProduct", () => {
  it("returns null for a missing product", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({ product: null }),
    );

    assert.equal(
      await queryProduct(client, "missing", new URLSearchParams()),
      null,
    );
  });

  it("throws GraphQL failures as StorefrontQueryError", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse(null, [{ message: "Upstream failure" }]),
    );

    await assert.rejects(
      queryProduct(client, "shirt", new URLSearchParams()),
      (error: unknown) => {
        assert.ok(error instanceof StorefrontQueryError);
        assert.equal(
          error.message,
          "The Storefront API did not return product data.",
        );
        return true;
      },
    );
  });
});

describe("queryBackInStockEligibleVariant", () => {
  it("returns a sold-out variant of an opted-in product", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse(variantNode()),
    );

    assert.deepEqual(
      await queryBackInStockEligibleVariant(client, "shirt", VARIANT_ID),
      { productHandle: "shirt", variantTitle: "Red" },
    );
  });

  it("rejects available variants and variants of another product", async () => {
    for (let [node, handle] of [
      [variantNode({ availableForSale: true }), "shirt"],
      [variantNode(), "other-product"],
    ] as const) {
      let client = createTestStorefrontClient(async () =>
        graphqlResponse(node),
      );
      assert.equal(
        await queryBackInStockEligibleVariant(client, handle, VARIANT_ID),
        null,
      );
    }
  });

  it("returns null during a Storefront outage but propagates aborts", async () => {
    let outage = createTestStorefrontClient(async () => {
      throw new TypeError("connection lost");
    });
    assert.equal(
      await queryBackInStockEligibleVariant(outage, "shirt", VARIANT_ID),
      null,
    );

    let abort = new DOMException("The request was aborted", "AbortError");
    let aborted = createTestStorefrontClient(async () => {
      throw abort;
    });
    await assert.rejects(
      queryBackInStockEligibleVariant(aborted, "shirt", VARIANT_ID),
      (error: unknown) => error === abort,
    );
  });
});

function variantNode({ availableForSale = false } = {}) {
  return {
    node: {
      id: VARIANT_ID,
      title: "Red",
      availableForSale,
      product: {
        handle: "shirt",
        subscribeIfBackInStock: { value: "true" },
      },
    },
  };
}
