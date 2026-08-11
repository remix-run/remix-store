import { createCartCookie } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MemoryStorefrontCache } from "../app/data/storefront-cache.ts";
import { render } from "../app/middleware/render.tsx";
import { createApp } from "../app/router.ts";
import { CART_API_PATH, routes } from "../app/routes.ts";
import { CART_ID, createCart } from "../test/cart-fixtures.ts";

const testEnv = {
  PUBLIC_STORE_DOMAIN: "example.myshopify.com",
  ["PUBLIC_" + "STOREFRONT_API_TOKEN"]: "test-token",
};

function shellMenuResponse() {
  return new Response(
    JSON.stringify({
      data: {
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
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function analyticsShopResponse() {
  return new Response(
    JSON.stringify({
      data: {
        shop: { id: "gid://shopify/Shop/test" },
        localization: {
          country: { currency: { isoCode: "USD" } },
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function createTestApp(fetch: typeof globalThis.fetch) {
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

const origin = "https://storefront.example";

describe("cart routes", () => {
  it("serves an empty cart API response before app routing", async (t) => {
    let mockFetch = (async () => {
      throw new Error("The empty cart API must not query Shopify");
    }) as typeof globalThis.fetch;
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);

    let response = await app.fetch(new Request(new URL(CART_API_PATH, origin)));

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("Content-Type") ?? "",
      /application\/json/,
    );
    assert.deepEqual(await response.json(), { cart: null });
  });

  it("server-renders an existing cart with progressive line forms", async (t) => {
    let cart = createCart();
    let mockFetch = (async (_input, init) => {
      let query = JSON.parse(String(init?.body)).query as string;
      if (query.includes("RemixNavigation")) return shellMenuResponse();
      if (query.includes("query Cart")) {
        return new Response(JSON.stringify({ data: { cart } }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (query.includes("RemixAnalyticsShop")) {
        return analyticsShopResponse();
      }
      throw new Error(`Unexpected storefront query: ${query.slice(0, 60)}`);
    }) as typeof globalThis.fetch;
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];

    let response = await app.fetch(
      new Request(new URL(routes.cart.href(), origin), {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(html, /Test Product/);
    assert.match(html, /name="lineId"/);
    assert.match(html, /name="quantity"/);
    assert.match(html, /name="intent" value="set"/);
    assert.match(html, /href="https:\/\/checkout\.example\.test\/cart"/);
  });

  it("renders /cart with an empty branded state and a private cache policy", async (t) => {
    let mockFetch = (async (_input, init) => {
      let query = JSON.parse(String(init?.body)).query as string;
      if (query.includes("RemixNavigation")) return shellMenuResponse();
      if (query.includes("RemixAnalyticsShop")) {
        return analyticsShopResponse();
      }
      // A cart query should not be made when there is no cart cookie.
      throw new Error(`Unexpected storefront query: ${query.slice(0, 60)}`);
    }) as typeof globalThis.fetch;
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);

    let response = await app.fetch(
      new Request(new URL(routes.cart.href(), origin)),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(html, /No items in cart/);
    assert.match(
      html,
      /Please browse our catalog and add items before checking out\./,
    );
    assert.match(html, /Shop All/);
    assert.match(html, /CartPageContent/);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/storefront\.example\/cart"/,
    );
  });

  it("accepts a no-JavaScript add-to-cart POST and redirects with a cart cookie", async (t) => {
    let cart = createCart();
    let storefrontBody:
      | { query: string; variables: Record<string, unknown> }
      | undefined;

    let mockFetch = (async (_input, init) => {
      let body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      storefrontBody = body;
      if (body.query.includes("RemixNavigation")) return shellMenuResponse();
      if (body.query.includes("CartCreate")) {
        return new Response(
          JSON.stringify({
            data: {
              cartCreate: { cart, userErrors: [], warnings: [] },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(
        `Unexpected storefront query: ${body.query.slice(0, 60)}`,
      );
    }) as typeof globalThis.fetch;
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);

    let formData = new FormData();
    formData.set("merchandiseId", "gid://shopify/ProductVariant/test-variant");
    formData.set("quantity", "1");
    let referer = new URL(
      routes.products.show.href({ handle: "test-product" }),
      origin,
    );

    let response = await app.fetch(
      new Request(new URL(CART_API_PATH, origin), {
        method: "POST",
        headers: { Referer: referer.href },
        body: formData,
      }),
    );

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), referer.href);
    assert.match(response.headers.get("Set-Cookie") ?? "", /cart=/);
    assert.match(storefrontBody?.query ?? "", /mutation CartCreate/);
    assert.match(storefrontBody?.query ?? "", /fragment CartFragment on Cart/);
    assert.match(storefrontBody?.query ?? "", /discountAllocations/);
    assert.deepEqual(storefrontBody?.variables.input, {
      lines: [
        {
          merchandiseId: "gid://shopify/ProductVariant/test-variant",
          quantity: 1,
        },
      ],
    });
  });
});
