import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import type { NavigationMenuData } from "../data/storefront.ts";
import { MobileMenu } from "./public/navbar.tsx";

const menu: NavigationMenuData = {
  items: [
    { id: "all", title: "All Products", url: "/collections/all" },
    { id: "apparel", title: "Apparel", url: "/collections/apparel" },
  ],
};

describe("navbar interactions", () => {
  it("closes the mobile menu on outside interaction and Escape", async (t) => {
    let { $, act, cleanup } = render(
      <>
        <MobileMenu menu={menu} />
        <button id="outside">Outside</button>
      </>,
    );
    t.after(cleanup);

    let details = $("details");
    let summary = $("summary");
    let outside = $("#outside");
    assert.ok(details instanceof HTMLDetailsElement);
    assert.ok(summary instanceof HTMLElement);
    assert.ok(outside instanceof HTMLButtonElement);
    assert.equal($("form"), null);
    assert.doesNotMatch(details.textContent ?? "", /search/i);

    await act(() => summary.click());
    assert.equal(details.open, true);

    await act(() =>
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
    );
    assert.equal(details.open, false);

    await act(() => summary.click());
    assert.equal(details.open, true);

    await act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    assert.equal(details.open, false);
    assert.equal(document.activeElement, summary);
  });
});
