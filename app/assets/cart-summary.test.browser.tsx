import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/component/test";

import type { SerializedCartData } from "../data/public/cart.ts";
import {
  CA_MARKET,
  US_MARKET,
  type ActiveMarket,
} from "../lib/public/market.ts";
import { createCart } from "../testing/cart-fixtures.ts";
import { money } from "./public/cart-format.ts";
import { CartSummary } from "./public/cart-summary.tsx";

describe("money", () => {
  it("formats amounts for the market's locale", () => {
    let usd = { amount: "10", currencyCode: "USD" };
    assert.equal(money(usd, US_MARKET.locale), "$10.00");
    assert.equal(money(usd, CA_MARKET.locale), "US$10.00");
  });
});

describe("CartSummary", () => {
  it("tracks progress toward the US$75 free shipping minimum", (t) => {
    for (let [subtotal, percentage, message] of [
      ["0", "0", /Add \$75\.00 more for free shipping/],
      ["50", "66", /Add \$25\.00 more for free shipping/],
      ["74.99", "99", /Add \$0\.01 more for free shipping/],
      ["75", "100", /You've reached the US\$75 free shipping minimum/],
      ["150", "100", /You've reached the US\$75 free shipping minimum/],
    ] as const) {
      let view = renderSummary(t, cartWithSubtotal(subtotal));
      let progress = view.$('[role="progressbar"]');

      assert.equal(progress?.getAttribute("aria-valuenow"), percentage);
      assert.match(view.container.textContent, message);
      // The minimum makes shipping eligible; checkout confirms the options.
      assert.doesNotMatch(view.container.textContent, /Your shipping is free/);
      assert.match(
        view.container.textContent,
        /Shipping options confirmed at checkout/,
      );
      view.cleanup();
    }
  });

  it("explains the USD minimum without progress outside the US", (t) => {
    let cart = cartWithSubtotal("50");
    let usdView = renderSummary(t, cart, { market: CA_MARKET });
    assert.match(usdView.container.textContent, /Add US\$25\.00 more/);
    assert.match(
      usdView.container.textContent,
      /Free shipping with a US\$75 minimum/,
    );
    assert.doesNotMatch(usdView.container.textContent, /options confirmed/);
    usdView.cleanup();

    // A CAD subtotal can't be compared with the USD minimum.
    cart.cost.subtotalAmount = { amount: "106", currencyCode: "CAD" };
    let cadView = renderSummary(t, cart, { market: CA_MARKET });
    assert.equal(cadView.$('[role="progressbar"]'), null);
    assert.doesNotMatch(
      cadView.container.textContent,
      /more for free shipping|You've reached/,
    );
    assert.match(
      cadView.container.textContent,
      /Free shipping with a US\$75 minimum\. See your shipping options/,
    );
  });

  it("totals automatic discounts under the sale label", (t) => {
    let cart = createCart();
    cart.cost.subtotalAmount.amount = "15";
    cart.cost.totalAmount.amount = "10";
    cart.lines.nodes[0]?.discountAllocations.push({
      __typename: "CartAutomaticDiscountAllocation",
      discountedAmount: { amount: "5", currencyCode: "USD" },
    });

    let defaultLabel = renderSummary(t, cart);
    assert.match(
      defaultLabel.container.textContent,
      /Automatic discount-\$5\.00/,
    );
    assert.match(defaultLabel.container.textContent, /Total\$10\.00/);
    defaultLabel.cleanup();

    let saleLabel = renderSummary(t, cart, {
      automaticDiscountLabel: "Summer Sale",
    });
    assert.match(saleLabel.container.textContent, /Summer Sale-\$5\.00/);
    assert.doesNotMatch(saleLabel.container.textContent, /Automatic discount/);
  });

  it("does not label code discounts as the store-wide sale", (t) => {
    let cart = createCart();
    cart.cost.totalAmount.amount = "7";
    cart.lines.nodes[0]?.discountAllocations.push({
      __typename: "CartCodeDiscountAllocation",
      discountedAmount: { amount: "3", currencyCode: "USD" },
    });

    let { container } = renderSummary(t, cart, {
      automaticDiscountLabel: "Summer Sale",
    });

    assert.match(container.textContent, /Total\$7\.00/);
    assert.doesNotMatch(container.textContent, /Summer Sale/);
    assert.doesNotMatch(container.textContent, /Automatic discount/);
  });

  it("only shows a separate total when discounts change it", (t) => {
    let { container } = renderSummary(t, createCart());

    assert.match(container.textContent, /Subtotal\$10\.00/);
    assert.doesNotMatch(container.textContent, /Total\$/);
  });

  it("keeps the tax note on the page and out of the compact drawer", (t) => {
    let page = renderSummary(t, createCart());
    assert.match(page.container.textContent, /Taxes & Shipping details/);
    page.cleanup();

    let drawer = renderSummary(t, createCart(), { drawer: true });
    assert.doesNotMatch(drawer.container.textContent, /Taxes & Shipping/);
  });

  it("keeps checkout available but labelled while the cart updates", (t) => {
    let { $ } = renderSummary(t, createCart(), { pending: true });
    let checkout = $('a[href="https://checkout.example.test/cart"]');

    assert.equal(checkout?.textContent, "Updating cart…");
  });
});

function cartWithSubtotal(amount: string): SerializedCartData {
  let cart = createCart();
  cart.cost.subtotalAmount.amount = amount;
  cart.cost.totalAmount.amount = amount;
  return cart;
}

function renderSummary(
  t: TestContext,
  cart: SerializedCartData,
  options: {
    automaticDiscountLabel?: string;
    drawer?: boolean;
    market?: ActiveMarket;
    pending?: boolean;
  } = {},
) {
  let view = render(
    <CartSummary
      automaticDiscountLabel={
        options.automaticDiscountLabel ?? "Automatic discount"
      }
      cart={cart}
      drawer={options.drawer ?? false}
      market={options.market ?? US_MARKET}
      pending={options.pending ?? false}
    />,
  );
  t.after(view.cleanup);
  return view;
}
