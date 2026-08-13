import { createCartCookie } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { CART_API_PATH, routes } from "./routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
  type StorefrontRequestBody,
} from "./testing/storefront.ts";
import { CART_ID, createCart } from "../test/cart-fixtures.ts";

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
    let cartRequest: StorefrontRequestBody | undefined;
    let mockFetch = createStorefrontFetch({
      Cart(body) {
        cartRequest = body;
        return { cart };
      },
      RemixAnalyticsShop: analyticsShopData,
      RemixNavigation: navigationData,
    });
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
    assert.match(html, /<title>Cart \(1\) \| The Remix Store<\/title>/);
    assert.match(html, /Test Product/);
    assert.match(html, /name="lineId"/);
    assert.match(html, /name="quantity"/);
    assert.match(html, /name="intent" value="set"/);
    assert.match(html, /href="https:\/\/checkout\.example\.test\/cart"/);
    assert.match(
      cartRequest?.query ?? "",
      /fragment CartFragment on Cart\s*\{\s*updatedAt/,
    );
  });

  it("server-renders a localized Canadian cart with contextual queries", async (t) => {
    let cart = createCart();
    let cartRequest: StorefrontRequestBody | undefined;
    cart.cost.subtotalAmount.currencyCode = "CAD";
    cart.cost.totalAmount.currencyCode = "CAD";
    cart.lines.nodes[0]!.cost.amountPerQuantity.currencyCode = "CAD";
    cart.lines.nodes[0]!.cost.totalAmount.currencyCode = "CAD";
    let mockFetch = createStorefrontFetch({
      Cart(body) {
        cartRequest = body;
        return { cart };
      },
      RemixAnalyticsShop: () => ({
        shop: { id: "gid://shopify/Shop/test" },
        localization: { country: { currency: { isoCode: "CAD" } } },
      }),
      RemixNavigation: navigationData,
    });
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];

    let response = await app.fetch(
      new Request(`${origin}/en-ca/cart`, {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(cartRequest?.variables.country, "CA");
    assert.equal(cartRequest?.variables.language, "EN");
    assert.match(html, /action="\/en-ca\/api\/cart"/);
    assert.match(html, /href="\/en-ca\/products\/test-product"/);
    assert.match(html, /currencyCode.{0,20}CAD/);
  });

  it("labels automatic line allocations with the active sale title", async (t) => {
    let cart = createCart();
    cart.cost.totalAmount.amount = "8";
    cart.lines.nodes[0]!.discountAllocations = [
      {
        __typename: "CartAutomaticDiscountAllocation",
        discountedAmount: { amount: "2", currencyCode: "USD" },
      },
    ];
    let mockFetch = createStorefrontFetch({
      Cart: () => ({ cart }),
      RemixAnalyticsShop: analyticsShopData,
      RemixNavigation: saleNavigationData,
    });
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);
    let cookie = createCartCookie(CART_ID).split(";", 1)[0];

    let response = await app.fetch(
      new Request(new URL(routes.cart.href(), origin), {
        headers: { Cookie: cookie ?? "" },
      }),
    );
    let html = await response.text();

    assert.match(html, /Summer Sale/);
    assert.match(html, /-\$2\.00/);
    assert.doesNotMatch(html, /Automatic discount/);
  });

  it("renders /cart with an empty branded state and a private cache policy", async (t) => {
    let mockFetch = createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixNavigation: navigationData,
    });
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);

    let response = await app.fetch(
      new Request(new URL(routes.cart.href(), origin)),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(html, /<title>Cart \| The Remix Store<\/title>/);
    assert.match(html, /No items in cart/);
    assert.match(
      html,
      /Please browse our catalog and add items before checking out\./,
    );
    assert.match(html, /Shop All/);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/storefront\.example\/cart"/,
    );
  });

  it("accepts a no-JavaScript add-to-cart POST and redirects with a cart cookie", async (t) => {
    let cart = createCart();
    let storefrontBody: StorefrontRequestBody | undefined;
    let mockFetch = createStorefrontFetch({
      CartCreate(body) {
        storefrontBody = body;
        return { cartCreate: { cart, userErrors: [], warnings: [] } };
      },
    });
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
    assert.match(
      storefrontBody?.query ?? "",
      /fragment CartFragment on Cart\s*\{\s*updatedAt/,
    );
    assert.deepEqual(storefrontBody?.variables.input, {
      lines: [
        {
          merchandiseId: "gid://shopify/ProductVariant/test-variant",
          quantity: 1,
        },
      ],
    });
  });

  it("accepts a localized no-JavaScript cart POST and keeps its Canadian referer", async (t) => {
    let cart = createCart();
    let storefrontBody: StorefrontRequestBody | undefined;
    let mockFetch = createStorefrontFetch({
      CartCreate(body) {
        storefrontBody = body;
        return { cartCreate: { cart, userErrors: [], warnings: [] } };
      },
    });
    t.mock.method(globalThis, "fetch", mockFetch);
    let app = createTestApp(mockFetch);
    let formData = new FormData();
    formData.set("merchandiseId", "gid://shopify/ProductVariant/test-variant");
    formData.set("quantity", "1");
    let referer = `${origin}/en-ca/products/test-product`;

    let response = await app.fetch(
      new Request(`${origin}/en-ca/api/cart`, {
        method: "POST",
        headers: { Referer: referer },
        body: formData,
      }),
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/en-ca/products/test-product",
    );
    assert.equal(storefrontBody?.variables.country, "CA");
    assert.equal(storefrontBody?.variables.language, "EN");
  });
});

function saleNavigationData() {
  let data = navigationData();
  return {
    ...data,
    shop: {
      ...data.shop,
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
