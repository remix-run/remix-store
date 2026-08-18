import { createCartCookie } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
  type StorefrontRequestBody,
} from "./testing/storefront.ts";
import { CART_ID, createCart } from "../test/cart-fixtures.ts";

const origin = "https://storefront.example";

describe("Shopify compatibility routes", () => {
  it("sends cart permalinks to Shopify with discounts intact", async () => {
    let app = createTestApp(unexpectedStorefrontFetch());
    let response = await app.fetch(
      new Request(
        `${origin}/cart/41007289663544:1,41007289696312:2?discount=LAUNCH`,
      ),
    );
    let location = new URL(response.headers.get("Location")!);

    assert.equal(response.status, 302);
    assert.equal(
      location.origin + location.pathname,
      "https://example.myshopify.com/cart/41007289663544:1,41007289696312:2",
    );
    assert.equal(location.searchParams.get("discount"), "LAUNCH");
    assert.equal(location.searchParams.get("payment"), "shop_pay");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("redirects checkout from the authoritative cart checkout URL", async () => {
    let cart = createCart();
    cart.checkoutUrl = "https://checkout.example.test/cart/c/test";
    let app = createTestApp(createStorefrontFetch({ Cart: () => ({ cart }) }));
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];
    let response = await app.fetch(
      new Request(`${origin}/checkout?locale=en-US`, {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    let location = new URL(response.headers.get("Location")!);

    assert.equal(response.status, 302);
    assert.equal(
      location.origin + location.pathname,
      "https://checkout.example.test/cart/c/test",
    );
    assert.equal(location.searchParams.get("locale"), "en-US");
    assert.equal(location.searchParams.get("payment"), "shop_pay");
  });

  it("handles localized cart API, checkout, permalink, and AJAX paths", async (t) => {
    let upstreamUrl: string | undefined;
    t.mock.method(globalThis, "fetch", (async (input) => {
      upstreamUrl = String(input);
      return new Response(JSON.stringify({ item_count: 2 }), {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch);

    let cart = createCart();
    cart.checkoutUrl = "https://checkout.example.test/cart/c/ca";
    let app = createTestApp(createStorefrontFetch({ Cart: () => ({ cart }) }));
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];

    let api = await app.fetch(
      new Request(`${origin}/en-ca/api/cart`, {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    assert.equal(api.status, 200);

    let checkout = await app.fetch(
      new Request(`${origin}/en-ca/checkout`, {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    assert.equal(checkout.status, 302);
    assert.equal(
      new URL(checkout.headers.get("Location")!).origin,
      "https://checkout.example.test",
    );

    let permalink = await app.fetch(
      new Request(`${origin}/en-ca/cart/111:1?discount=CA`),
    );
    assert.equal(permalink.status, 302);
    assert.equal(
      new URL(permalink.headers.get("Location")!).pathname,
      "/cart/111:1",
    );

    let ajax = await app.fetch(
      new Request(`${origin}/en-ca/cart.js?sections=cart-drawer`),
    );
    assert.equal(ajax.status, 200);
    assert.equal(
      upstreamUrl,
      "https://example.myshopify.com/cart.json?sections=cart-drawer",
    );
  });

  it("proxies Shopify AJAX cart requests before app routing", async (t) => {
    let upstreamUrl: string | undefined;
    let upstreamFetch = (async (input) => {
      upstreamUrl = String(input);
      return new Response(JSON.stringify({ item_count: 2 }), {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
    t.mock.method(globalThis, "fetch", upstreamFetch);
    let app = createTestApp(unexpectedStorefrontFetch());

    let response = await app.fetch(
      new Request(`${origin}/cart.js?sections=cart-drawer`),
    );

    assert.equal(response.status, 200);
    assert.equal(
      upstreamUrl,
      "https://example.myshopify.com/cart.json?sections=cart-drawer",
    );
    assert.deepEqual(await response.json(), { item_count: 2 });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("handles admin, standard resource, and merchant URL redirects after 404", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        redirects: () => ({
          urlRedirects: {
            edges: [{ node: { target: "/collections/all" } }],
          },
        }),
      }),
    );

    let admin = await app.fetch(new Request(`${origin}/admin`));
    assert.equal(admin.status, 301);
    assert.equal(
      admin.headers.get("Location"),
      "https://example.myshopify.com/admin",
    );

    let scopedProduct = await app.fetch(
      new Request(
        `${origin}/collections/racing/products/remix-cap?color=black`,
      ),
    );
    assert.equal(scopedProduct.status, 301);
    assert.equal(
      scopedProduct.headers.get("Location"),
      "/products/remix-cap?color=black",
    );

    let merchantRedirect = await app.fetch(
      new Request(`${origin}/old-catalog?campaign=launch`),
    );
    assert.equal(merchantRedirect.status, 301);
    assert.equal(
      merchantRedirect.headers.get("Location"),
      "/collections/all?campaign=launch",
    );
  });

  it("allows same-origin fallback targets and rejects external targets", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        redirects: () => ({ urlRedirects: { edges: [] } }),
      }),
    );

    let sameOrigin = await app.fetch(
      new Request(`${origin}/missing?redirect=%2Fcollections%2Fall`),
    );
    assert.equal(sameOrigin.status, 301);
    assert.equal(sameOrigin.headers.get("Location"), "/collections/all");

    let external = await app.fetch(
      new Request(
        `${origin}/missing?redirect=${encodeURIComponent("https://phishing.example")}`,
      ),
    );
    assert.equal(external.status, 404);
    assert.equal(external.headers.get("Location"), null);
  });
});

describe("discount compatibility links", () => {
  it("keeps Canadian discount redirects and context localized", async () => {
    let requestBody: StorefrontRequestBody | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixDiscountCartCreate(body) {
          requestBody = body;
          return {
            cartCreate: {
              cart: { id: CART_ID },
              userErrors: [],
              warnings: [],
            },
          };
        },
      }),
    );

    let response = await app.fetch(
      new Request(
        `${origin}/en-ca/discount/CA20?redirect=${encodeURIComponent("/products/remix-cap?size=M")}`,
      ),
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/en-ca/products/remix-cap?size=M",
    );
    assert.deepEqual(requestBody?.variables, {
      country: "CA",
      discountCodes: ["CA20"],
      language: "EN",
    });
  });
  it("creates a cart for a discount query and removes the control parameter", async () => {
    let requestBody: StorefrontRequestBody | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixDiscountCartCreate(body) {
          requestBody = body;
          return {
            cartCreate: {
              cart: { id: CART_ID },
              userErrors: [],
              warnings: [],
            },
          };
        },
      }),
    );

    let response = await app.fetch(
      new Request(
        `${origin}/collections/all?discount=LAUNCH&sort_by=best-selling`,
      ),
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/collections/all?sort_by=best-selling",
    );
    assert.match(response.headers.get("Set-Cookie") ?? "", /cart=/);
    assert.deepEqual(requestBody?.variables, {
      country: "US",
      discountCodes: ["LAUNCH"],
      language: "EN",
    });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("honors same-origin discount targets and strips control parameters", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixDiscountCartCreate: () => ({
          cartCreate: {
            cart: { id: CART_ID },
            userErrors: [],
            warnings: [],
          },
        }),
      }),
    );

    let redirected = await app.fetch(
      new Request(
        `${origin}/discount/LAUNCH?redirect=${encodeURIComponent("/products/remix-cap?size=M")}&return_to=${encodeURIComponent("/collections/all")}&utm_source=shopify`,
      ),
    );
    assert.equal(
      redirected.headers.get("Location"),
      "/products/remix-cap?size=M&utm_source=shopify",
    );

    let returned = await app.fetch(
      new Request(
        `${origin}/discount/LAUNCH?return_to=${encodeURIComponent("/collections/all")}`,
      ),
    );
    assert.equal(returned.headers.get("Location"), "/collections/all");
  });

  it("appends to an existing cart's discounts and prevents external redirects", async () => {
    let requestBody: StorefrontRequestBody | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixDiscountCart: () => ({
          cart: { discountCodes: [{ code: "WELCOME" }] },
        }),
        RemixCartDiscountCodesUpdate(body) {
          requestBody = body;
          return {
            cartDiscountCodesUpdate: {
              cart: { id: CART_ID },
              userErrors: [],
              warnings: [],
            },
          };
        },
      }),
    );
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];

    let response = await app.fetch(
      new Request(
        `${origin}/discount/LAUNCH?redirect=${encodeURIComponent("//phishing.example")}&utm_source=shopify`,
        { headers: { Cookie: cookie ?? "" } },
      ),
    );

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/?utm_source=shopify");
    assert.deepEqual(requestBody?.variables, {
      cartId: CART_ID,
      country: "US",
      discountCodes: ["WELCOME", "LAUNCH"],
      language: "EN",
    });
    assert.equal(response.headers.get("Set-Cookie"), null);
  });

  it("still removes a discount query when Shopify is unavailable", async (t) => {
    let app = createTestApp(async () => {
      throw new TypeError("connection lost");
    });
    t.mock.method(console, "error", () => {});

    let response = await app.fetch(
      new Request(`${origin}/products/remix-cap?discount=LAUNCH&size=M`),
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/products/remix-cap?size=M",
    );
    assert.equal(response.headers.get("Set-Cookie"), null);
  });
});

function unexpectedStorefrontFetch(): typeof globalThis.fetch {
  return async () => {
    throw new Error(
      "This compatibility route must not query the Storefront API",
    );
  };
}
