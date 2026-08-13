import type { ShopifyGlobal } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import {
  BLUE_VARIANT_ID,
  RED_VARIANT_ID,
  createProduct,
} from "../../test/product-fixtures.ts";
import { CA_MARKET } from "../lib/public/market.ts";
import { resetBrowserCartStore } from "./public/cart-store.ts";
import { ProductDetails, variantHref } from "./public/product-details.tsx";

type UpdateCartConfig = {
  eventTarget(meta: { type: string; action?: string }): EventTarget | null;
  handler(
    defaultHandler: () => Promise<unknown>,
    payload: unknown,
  ): Promise<unknown>;
};

const shopPayStoreUrl = "https://example.myshopify.com";

let updateCartConfig: UpdateCartConfig | undefined;

async function updateCart(payload: unknown): Promise<unknown> {
  if (!updateCartConfig) throw new Error("updateCart was not configured");
  return updateCartConfig.handler(async () => ({ cart: null }), payload);
}

Object.assign(updateCart, {
  configure(config: UpdateCartConfig) {
    updateCartConfig = config;
    return true;
  },
  isDefault() {
    return false;
  },
});

Object.defineProperty(window, "Shopify", {
  configurable: true,
  value: {
    actions: {
      getCart: async () => ({ cart: null }),
      updateCart,
    },
  } as unknown as ShopifyGlobal,
});

describe("product form", () => {
  it("updates variant media and price immediately while preserving URL state", async (t) => {
    let product = createProduct();
    let navigatedTo = "";
    t.after(resetBrowserCartStore);
    t.mock.method(window.navigation, "navigate", (url: string | URL) => {
      navigatedTo = String(url);
      return { committed: Promise.resolve(), finished: Promise.resolve() };
    });

    let { $, act, cleanup } = render(
      <ProductDetails
        product={product}
        search="?ref=campaign&Color=Red"
        shopPayStoreUrl={shopPayStoreUrl}
      />,
    );
    t.after(cleanup);
    await flushAsync(act);

    let red = $('a[href*="Color=Red"]');
    let blue = $('a[href*="Color=Blue"]');
    let missing = $("button:disabled");
    assert.ok(red instanceof HTMLAnchorElement);
    assert.ok(blue instanceof HTMLAnchorElement);
    assert.ok(missing instanceof HTMLButtonElement);
    let redButton = red as HTMLAnchorElement;
    let blueButton = blue as HTMLAnchorElement;
    let missingButton = missing as HTMLButtonElement;
    assert.equal(redButton.getAttribute("aria-current"), "true");
    let shopPay = $("shop-pay-button");
    assert.ok(shopPay instanceof HTMLElement);
    assert.equal(shopPay.getAttribute("variants"), "111:1");
    assert.equal(shopPay.getAttribute("source"), "hydrogen");
    assert.equal(shopPay.getAttribute("channel"), "hydrogen");
    assert.equal(shopPay.getAttribute("store-url"), shopPayStoreUrl);
    assert.equal(shopPay.hasAttribute("disabled"), false);
    assert.match(blueButton.textContent ?? "", /Sold out/);
    assert.equal(missingButton.disabled, true);

    let optionMenu = $("details");
    let optionSummary = $("summary");
    assert.ok(optionMenu instanceof HTMLDetailsElement);
    assert.ok(optionSummary instanceof HTMLElement);
    await act(() => optionSummary.click());
    assert.equal(optionMenu.open, true);
    await act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    assert.equal(optionMenu.open, false);
    assert.equal(document.activeElement, optionSummary);

    await act(() => blueButton.click());
    red = $('a[href*="Color=Red"]');
    blue = $('a[href*="Color=Blue"]');
    assert.ok(red instanceof HTMLAnchorElement);
    assert.ok(blue instanceof HTMLAnchorElement);
    redButton = red as HTMLAnchorElement;
    blueButton = blue as HTMLAnchorElement;

    assert.equal(blueButton.getAttribute("aria-current"), "true");
    assert.equal(redButton.getAttribute("aria-current"), null);
    assert.equal(
      $('input[name="merchandiseId"]')?.getAttribute("value"),
      BLUE_VARIANT_ID,
    );
    assert.match(
      $('img[alt="Blue product"]')?.getAttribute("src") ?? "",
      /blue\.jpg\?width=1200/,
    );
    assert.match($("h1")?.closest("section")?.textContent ?? "", /\$15\.00/);
    assert.equal($('button[name="add-to-cart"]')?.textContent, "Sold out");
    assert.equal($("shop-pay-button"), null);
    assert.equal(navigatedTo, "/products/test-product?ref=campaign&Color=Blue");

    let combinedListing = $('a[href*="related-product"]');
    assert.ok(combinedListing instanceof HTMLAnchorElement);
    assert.equal(
      combinedListing.getAttribute("href"),
      "/products/related-product?ref=campaign&Color=Green",
    );

    await act(() => redButton.click());
    assert.equal(
      $('input[name="merchandiseId"]')?.getAttribute("value"),
      RED_VARIANT_ID,
    );
    assert.equal($("shop-pay-button")?.hasAttribute("disabled"), false);
  });

  it("hydrates and submits only verified identifiers for the selected sold-out variant", async (t) => {
    let product = createProduct();
    let requestBody: URLSearchParams | undefined;
    t.after(resetBrowserCartStore);
    t.mock.method(window.navigation, "navigate", () => ({
      committed: Promise.resolve(),
      finished: Promise.resolve(),
    }));
    t.mock.method(
      globalThis,
      "fetch",
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = init?.body as URLSearchParams;
        return Response.json({ message: "Notification saved", success: true });
      },
    );

    let { $, act, cleanup } = render(
      <ProductDetails
        product={product}
        search="?Color=Red"
        shopPayStoreUrl={shopPayStoreUrl}
      />,
    );
    t.after(cleanup);
    await flushAsync(act);
    assert.equal($("#back-in-stock-email"), null);

    let blue = $('a[href*="Color=Blue"]');
    assert.ok(blue instanceof HTMLAnchorElement);
    await act(() => blue.click());
    assert.equal(
      $('input[name="product-handle"]')?.getAttribute("value"),
      "test-product",
    );
    assert.equal(
      $('input[name="variant-id"]')?.getAttribute("value"),
      "gid://shopify/ProductVariant/222",
    );
    assert.equal($('input[name="variant-title"]'), null);

    let email = $("#back-in-stock-email");
    let form = email?.closest("form");
    assert.ok(email instanceof HTMLInputElement);
    assert.ok(form instanceof HTMLFormElement);
    email.value = "member@example.com";
    await act(() =>
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      ),
    );
    await waitFor(() => $('[role="status"]') !== null, act);

    assert.deepEqual([...requestBody!.keys()].sort(), [
      "consent",
      "email",
      "product-handle",
      "variant-id",
    ]);
    assert.equal(requestBody?.get("product-handle"), "test-product");
    assert.equal(
      requestBody?.get("variant-id"),
      "gid://shopify/ProductVariant/222",
    );
    assert.equal($('[role="status"]')?.textContent, "Notification saved");
  });

  it("hides Shopify’s default-only variant selector", async (t) => {
    let product = createDefaultVariantProduct();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <ProductDetails
        product={product}
        search=""
        shopPayStoreUrl={shopPayStoreUrl}
      />,
    );
    t.after(cleanup);
    await flushAsync(act);

    assert.equal($("details"), null);
    assert.equal($('button[name="Title"]'), null);
    assert.equal(
      $('input[name="merchandiseId"]')?.getAttribute("value"),
      RED_VARIANT_ID,
    );
    let addButton = $('button[name="add-to-cart"]');
    assert.ok(addButton instanceof HTMLButtonElement);
    assert.equal(addButton.disabled, false);
    assert.equal(addButton.textContent, "Add to cart");
    assert.equal($("shop-pay-button")?.getAttribute("variants"), "111:1");
  });

  it("disables add-to-cart until a variant is resolved", async (t) => {
    let product = createProduct();
    product.selectedOrFirstAvailableVariant = null;
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <ProductDetails
        product={product}
        search=""
        shopPayStoreUrl={shopPayStoreUrl}
      />,
    );
    t.after(cleanup);
    await flushAsync(act);

    let addButton = $('button[name="add-to-cart"]');
    assert.ok(addButton instanceof HTMLButtonElement);
    assert.equal((addButton as HTMLButtonElement).disabled, true);
    assert.equal(addButton?.textContent, "Select options");
    assert.equal($('input[name="merchandiseId"]')?.getAttribute("value"), "");
    assert.equal($('a[aria-current="true"]'), null);
    assert.equal($("shop-pay-button"), null);
  });

  it("retains the Canadian prefix in variant and form navigation", async (t) => {
    let product = createProduct();
    t.after(resetBrowserCartStore);
    let { $, act, cleanup } = render(
      <ProductDetails
        market={CA_MARKET}
        product={product}
        search="?ref=campaign&Color=Red"
        shopPayStoreUrl={shopPayStoreUrl}
      />,
    );
    t.after(cleanup);
    await flushAsync(act);

    assert.match(
      $('a[href*="Color=Blue"]')?.getAttribute("href") ?? "",
      /^\/en-ca\/products\/test-product\?/,
    );
    assert.equal($("form")?.getAttribute("action"), "/en-ca/api/cart");
    assert.equal(
      variantHref(
        "test-product",
        [{ name: "Color", value: "Blue" }],
        [{ name: "Color" }],
        "",
        "/en-ca",
      ),
      "/en-ca/products/test-product?Color=Blue",
    );
  });

  it("builds variant URLs by replacing only product option parameters", () => {
    assert.equal(
      variantHref(
        "other-product",
        [
          { name: "Size", value: "Large" },
          { name: "Color", value: "Green" },
        ],
        [{ name: "Color" }, { name: "Size" }],
        "?Color=Red&ref=campaign&Size=Small",
      ),
      "/products/other-product?ref=campaign&Size=Large&Color=Green",
    );
  });
});

function createDefaultVariantProduct() {
  let product = createProduct();
  let variant = product.selectedOrFirstAvailableVariant!;
  variant.title = "Default Title";
  variant.selectedOptions = [{ name: "Title", value: "Default Title" }];
  product.options = [
    {
      name: "Title",
      optionValues: [
        { name: "Default Title", firstSelectableVariant: variant },
      ],
    },
  ];
  product.adjacentVariants = [variant];
  product.encodedVariantExistence = "v1_0";
  product.encodedVariantAvailability = "v1_0";
  return product;
}

type Act = ReturnType<typeof render>["act"];

async function flushAsync(act: Act) {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitFor(predicate: () => boolean, act: Act) {
  let deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for product form");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(() => {});
  }
}
