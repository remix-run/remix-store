import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderToString } from "remix/component/server";

import { PillLink } from "./pill-link.tsx";

describe("PillLink", () => {
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
    assert.match(html, /href="#fast-forward"/);
    assert.match(html, /data-icon-always-visible/);
    assert.match(html, /data-expanded-text="All"/);
  });
});
