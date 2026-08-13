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
