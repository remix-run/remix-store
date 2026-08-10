import {
  createShopifyRequestContext,
  createStorefrontClient,
} from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
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

  it("falls back when menu data is unavailable", async () => {
    let client = createTestClient(async () => {
      throw new TypeError("connection lost");
    });
    let originalConsoleError = console.error;
    console.error = () => {};

    try {
      let result = await queryShellMenus(client, "example.myshopify.com");

      assert.equal(result.navigationMenu, FALLBACK_NAVIGATION_MENU);
      assert.equal(result.footerMenu, FALLBACK_FOOTER_MENU);
    } finally {
      console.error = originalConsoleError;
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
