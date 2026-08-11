import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderToString } from "remix/ui/server";

import { BrandedState } from "./branded-state.tsx";
import { PillLink } from "./public/pill-link.tsx";

describe("shared storefront primitives", () => {
  it("renders an accessible pill link backed by the icon sprite", async () => {
    let html = await renderToString(
      <PillLink
        href="/collections/all"
        icon="fast-forward"
        iconAlwaysVisible
        expandedText="All"
      >
        Shop
      </PillLink>,
    );

    assert.match(html, /href="\/collections\/all"/);
    assert.match(html, /Shop/);
    assert.match(html, /All/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /href="\/sprites.svg#fast-forward"/);
    assert.match(html, /data-icon-always-visible/);
    assert.match(html, /data-expanded-text="All"/);
  });

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
    assert.match(html, /href="\/sprites.svg#cart"/);
    assert.match(html, /Shop all/);
  });
});
