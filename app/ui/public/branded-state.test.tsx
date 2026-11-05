import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderToString } from "remix/component/server";

import { BrandedState } from "./branded-state.tsx";

describe("BrandedState", () => {
  it("renders a branded state with fallback art and one semantic heading", async () => {
    let html = await renderToString(
      <BrandedState
        kind="empty"
        heading="Your cart is empty"
        copy="Add something soft."
        href="/collections/all"
        icon="cart"
        linkLabel="Shop all"
      />,
    );

    assert.match(html, /<h1[^>]*>Your cart is empty<\/h1>/);
    assert.doesNotMatch(html, /src="\/brand\/matrix\/empty.png"/);
    assert.match(html, /href="\/collections\/all"/);
    assert.match(html, /href="#cart"/);
    assert.match(html, /Shop all/);
  });
});
