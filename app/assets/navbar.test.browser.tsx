import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import type { NavigationMenuData } from "../data/storefront.ts";
import { StoreWideSaleMarquee } from "../ui/store-wide-sale.tsx";
import { MobileMenu } from "./public/navbar.tsx";

const menu: NavigationMenuData = {
  items: [
    { id: "all", title: "All Products", url: "/collections/all" },
    { id: "apparel", title: "Apparel", url: "/collections/apparel" },
  ],
};

describe("navbar interactions", () => {
  it("renders one concise sale announcement and hides repeated marquee copy", (t) => {
    let { $, container, cleanup } = render(
      <StoreWideSaleMarquee
        sale={{
          title: "Summer Sale",
          description: "20% off everything",
          endDateTime: "2099-06-02T12:00:00Z",
        }}
      />,
    );
    t.after(cleanup);

    let marquee = $("[data-store-wide-sale]");
    let decorativeTrack = marquee?.querySelector('[aria-hidden="true"]');
    assert.ok(marquee instanceof HTMLElement);
    assert.ok(decorativeTrack instanceof HTMLElement);
    assert.equal(getComputedStyle(marquee).height, "48px");
    assert.equal(
      marquee.querySelector("p")?.textContent,
      "Summer Sale. 20% off everything. Ends Jun.2.",
    );
    assert.equal(container.querySelectorAll('[aria-hidden="true"]').length, 1);
    let groups = decorativeTrack.querySelectorAll(
      '[data-marquee-group="true"]',
    );
    assert.equal(groups.length, 2);
    assert.equal(
      groups[0]?.querySelectorAll("span > span:first-child").length,
      32,
    );
    assert.equal(
      groups[1]?.querySelectorAll("span > span:first-child").length,
      32,
    );
    assert.match(decorativeTrack.textContent ?? "", /Now thru Jun\.2/);
  });

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
