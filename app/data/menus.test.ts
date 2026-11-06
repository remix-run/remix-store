import { StorefrontApiError } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  createTestStorefrontClient,
  graphqlResponse,
} from "../testing/storefront-client.ts";
import {
  FALLBACK_NAVIGATION_MENU,
  loadProductNavigationOrEmpty,
  loadShellMenusOrFallback,
  toActiveStoreWideSale,
} from "./menus.ts";

describe("Storefront menus", () => {
  it("normalizes internal menu links and policy routes", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({
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
      }),
    );

    let result = await loadShellMenusOrFallback(client);

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
    assert.deepEqual(result.storeWideSale, {
      title: "Summer Sale",
      description: "20% off everything",
      endDateTime: "2099-06-02T12:00:00Z",
    });
  });

  it("accepts only complete, active store-wide sale metadata", () => {
    let now = Date.parse("2026-06-01T12:00:00Z");
    let activeSale = {
      __typename: "Metaobject",
      title: { value: " Summer Sale " },
      description: { value: " 20% off everything " },
      endDateTime: { value: "2026-06-02T12:00:00Z" },
    };

    assert.deepEqual(toActiveStoreWideSale(activeSale, now), {
      title: "Summer Sale",
      description: "20% off everything",
      endDateTime: "2026-06-02T12:00:00Z",
    });
    assert.deepEqual(
      toActiveStoreWideSale({ ...activeSale, endDateTime: null }, now),
      { title: "Summer Sale", description: "20% off everything" },
    );

    for (let invalid of [
      { ...activeSale, __typename: "Product" },
      { ...activeSale, title: { value: " " } },
      { ...activeSale, description: { value: "" } },
      { ...activeSale, endDateTime: { value: "not-a-date" } },
      { ...activeSale, endDateTime: { value: "2026-06-01T12:00:00Z" } },
      { ...activeSale, endDateTime: { value: "2026-05-01T12:00:00Z" } },
    ]) {
      assert.equal(toActiveStoreWideSale(invalid, now), null);
    }
  });

  it("normalizes the dedicated product sidebar menu", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({
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

    let result = await loadProductNavigationOrEmpty(client);

    assert.deepEqual(result.items, [
      { id: "all", title: "All products", url: "/collections/all" },
    ]);
  });

  it("hides an expired sale without dropping live menus", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({
        menu: {
          items: [
            {
              id: "all",
              title: "All Products",
              url: "https://shop.example.com/collections/all",
            },
          ],
        },
        footerMenu: { items: [] },
        shop: {
          primaryDomain: { url: "https://shop.example.com" },
          storeWideSale: {
            reference: {
              __typename: "Metaobject",
              title: { value: "Expired Sale" },
              description: { value: "No longer active" },
              endDateTime: { value: "2000-01-01T00:00:00Z" },
            },
          },
        },
      }),
    );

    let result = await loadShellMenusOrFallback(client);

    assert.deepEqual(result.navigationMenu.items, [
      { id: "all", title: "All Products", url: "/collections/all" },
    ]);
    assert.equal(result.storeWideSale, null);
  });

  it("falls back to the built-in menus during a Storefront outage", async () => {
    let client = createTestStorefrontClient(async () => {
      throw new TypeError("connection lost");
    });

    let shell = await loadShellMenusOrFallback(client);
    let productMenu = await loadProductNavigationOrEmpty(client);

    assert.deepEqual(shell.navigationMenu, FALLBACK_NAVIGATION_MENU);
    assert.equal(shell.storeWideSale, null);
    assert.deepEqual(productMenu, { items: [] });
  });

  it("propagates request aborts instead of rendering a fallback", async () => {
    let abort = new DOMException("The request was aborted", "AbortError");
    let client = createTestStorefrontClient(async () => {
      throw abort;
    });

    await assert.rejects(loadShellMenusOrFallback(client), (error: unknown) => {
      assert.equal(error, abort);
      assert.ok(!(error instanceof StorefrontApiError));
      return true;
    });
    await assert.rejects(
      loadProductNavigationOrEmpty(client),
      (error: unknown) => {
        assert.equal(error, abort);
        return true;
      },
    );
  });
});
