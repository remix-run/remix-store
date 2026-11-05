import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/component/test";

import { StoreWideSaleMarquee } from "./store-wide-sale.tsx";

describe("StoreWideSaleMarquee", () => {
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
});
