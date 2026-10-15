import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/component/test";

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
    assert.equal(
      decorativeTrack.querySelectorAll('[data-marquee-group="true"]').length,
      2,
    );
    assert.match(decorativeTrack.textContent ?? "", /Now thru Jun\.2/);
  });

  it("renders the mobile menu as a native popover", (t) => {
    let { $, cleanup } = render(<MobileMenu menu={menu} />);
    t.after(cleanup);

    let button = $("button");
    let nav = $("nav");
    assert.ok(button instanceof HTMLButtonElement);
    assert.ok(nav instanceof HTMLElement);
    assert.equal(button.getAttribute("aria-label"), "Navigation menu");
    assert.equal(button.getAttribute("popovertarget"), nav.id);
    assert.equal(nav.getAttribute("popover"), "auto");
    assert.equal(nav.getAttribute("aria-label"), "Mobile navigation");
  });

  it("returns focus to the toggle when the menu closes with focus inside", async (t) => {
    let { $, act, cleanup } = render(<MobileMenu menu={menu} />);
    t.after(cleanup);

    let button = $("button");
    let nav = $("nav");
    let link = $("nav a");
    assert.ok(button instanceof HTMLButtonElement);
    assert.ok(nav instanceof HTMLElement);
    assert.ok(link instanceof HTMLAnchorElement);

    // Safari leaves focus here: it does not focus a clicked button, so the
    // popover has no earlier focus to restore.
    nav.showPopover();
    link.focus();
    await act(() =>
      nav.dispatchEvent(
        new ToggleEvent("toggle", { newState: "closed", oldState: "open" }),
      ),
    );

    assert.equal(document.activeElement, button);
  });

  it("swallows only the click that dismisses the open menu", async (t) => {
    let { $, cleanup } = render(
      <>
        <MobileMenu menu={menu} />
        <a id="outside" href="/products/outside">
          Outside
        </a>
      </>,
    );
    t.after(cleanup);

    let nav = $("nav");
    let outside = $("#outside");
    assert.ok(nav instanceof HTMLElement);
    assert.ok(outside instanceof HTMLAnchorElement);

    let reached = 0;
    outside.addEventListener("click", (event) => {
      reached++;
      // Keep the test page in place when the click goes through.
      event.preventDefault();
    });
    let click = () =>
      outside.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    let nextTask = () => new Promise((resolve) => setTimeout(resolve));

    // Light dismiss hides the popover, then delivers the click in the same
    // task. hidePopover() fires the same synchronous beforetoggle.
    nav.showPopover();
    nav.hidePopover();
    click();
    assert.equal(reached, 0);
    // Only that one click is swallowed.
    click();
    assert.equal(reached, 1);

    // A new press disarms, so a close without a click (Escape, the toggle)
    // cannot swallow the next one.
    nav.showPopover();
    nav.hidePopover();
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    click();
    assert.equal(reached, 2);

    // So does the next task.
    nav.showPopover();
    nav.hidePopover();
    await nextTask();
    click();
    assert.equal(reached, 3);
  });

  it("closes the mobile menu when focus leaves or a link is followed", async (t) => {
    let { $, act, cleanup } = render(
      <>
        <MobileMenu menu={menu} />
        <button id="outside">Outside</button>
      </>,
    );
    t.after(cleanup);

    let nav = $("nav");
    let link = $("nav a");
    let outside = $("#outside");
    assert.ok(nav instanceof HTMLElement);
    assert.ok(link instanceof HTMLAnchorElement);
    assert.ok(outside instanceof HTMLButtonElement);

    nav.showPopover();
    await act(() => link.focus());
    await act(() => outside.focus());
    assert.equal(nav.matches(":popover-open"), false);
    // Separate interactions run in separate tasks.
    await new Promise((resolve) => setTimeout(resolve));

    nav.showPopover();
    // Keep the test page in place; the menu closes for any followed link.
    link.addEventListener("click", (event) => event.preventDefault());
    await act(() => link.click());
    assert.equal(nav.matches(":popover-open"), false);
  });
});
