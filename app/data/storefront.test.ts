import {
  createShopifyRequestContext,
  createStorefrontClient,
} from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { queryShop } from "./storefront.ts";

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
