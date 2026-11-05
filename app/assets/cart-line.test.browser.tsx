import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/component/test";

import { CA_MARKET, US_MARKET } from "../lib/public/market.ts";
import { CART_LINE_ID, createCart } from "../testing/cart-fixtures.ts";
import { CartLine, type CartLineData } from "./public/cart-line.tsx";

describe("CartLine", () => {
  it("shows the compare-at price only when it exceeds the paid price", (t) => {
    let line = createLine();
    line.cost.compareAtAmountPerQuantity = {
      amount: "15",
      currencyCode: "USD",
    };
    let discounted = renderLine(t, line);
    assert.equal(
      discounted.$("[data-line-price] s")?.textContent,
      "$15.00 each",
    );
    discounted.cleanup();

    line.cost.compareAtAmountPerQuantity = {
      amount: "10",
      currencyCode: "USD",
    };
    let fullPrice = renderLine(t, line);
    assert.equal(fullPrice.$("[data-line-price] s"), null);
  });

  it("names variants by title and omits Shopify's default title", (t) => {
    let line = createLine();
    assert.ok(line.merchandise);
    line.merchandise.title = "Medium";
    line.merchandise.selectedOptions = [{ name: "Size", value: "Medium" }];
    let sized = renderLine(t, line);
    assert.match(sized.container.textContent, /Test ProductMedium/);
    assert.doesNotMatch(sized.container.textContent, /Size:/);
    sized.cleanup();

    let plain = renderLine(t, createLine());
    assert.doesNotMatch(plain.container.textContent, /Default Title|Title:/);
  });

  it("removes a single item instead of decreasing it to zero", (t) => {
    let single = renderLine(t, createLine(1));
    assert.ok(single.$('button[aria-label="Remove item"]'));
    assert.equal(single.$('button[aria-label="Decrease quantity"]'), null);
    single.cleanup();

    let several = renderLine(t, createLine(2));
    assert.ok(several.$('button[aria-label="Decrease quantity"]'));
    assert.equal(several.$('button[aria-label="Remove item"]'), null);
  });

  it("posts quantity changes to the active market's cart API", (t) => {
    let { $ } = renderLine(t, createLine(), { market: CA_MARKET });

    assert.ok($('form[action="/en-ca/api/cart"]'));
    assert.ok($('h2 a[href="/en-ca/products/test-product"]'));
  });

  it("ties line errors to the quantity input", (t) => {
    let { $ } = renderLine(t, createLine(), {
      messages: ["Only 1 left in stock"],
    });
    let quantity = $('input[aria-label="Quantity"]');
    let alert = $('[role="alert"]');

    assert.equal(quantity?.getAttribute("aria-invalid"), "true");
    assert.ok(alert?.id);
    assert.equal(quantity?.getAttribute("aria-describedby"), alert.id);
    assert.equal(alert.textContent, "Only 1 left in stock");
  });

  it("reports product link clicks so the drawer can close", (t) => {
    let clicks = 0;
    let { $, container } = renderLine(t, createLine(), {
      onLinkClick: () => clicks++,
    });
    // Keep the test page from navigating.
    container.addEventListener("click", (event) => event.preventDefault());

    let link = $('h2 a[href="/products/test-product"]');
    assert.ok(link instanceof HTMLAnchorElement);
    link.click();
    assert.equal(clicks, 1);
  });
});

function createLine(quantity = 1): CartLineData {
  let line = createCart(quantity).lines.nodes[0];
  assert.ok(line);
  assert.equal(line.id, CART_LINE_ID);
  return line;
}

function renderLine(
  t: TestContext,
  line: CartLineData,
  options: {
    market?: typeof US_MARKET;
    messages?: string[];
    onLinkClick?: () => void;
  } = {},
) {
  let view = render(
    <ul>
      <CartLine
        drawer={false}
        line={line}
        market={options.market ?? US_MARKET}
        messages={options.messages ?? []}
        onLinkClick={options.onLinkClick}
        pending={false}
      />
    </ul>,
  );
  t.after(view.cleanup);
  return view;
}
