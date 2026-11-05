import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderToString } from "remix/component/server";

import type { MarketPathPrefix } from "../lib/public/market.ts";
import { RichText } from "./public/rich-text.tsx";

function render(children: unknown[], pathPrefix?: MarketPathPrefix) {
  return renderToString(
    <RichText
      pathPrefix={pathPrefix}
      value={JSON.stringify({ type: "root", children })}
    />,
  );
}

function text(value: string, marks: Record<string, boolean> = {}) {
  return { type: "text", value, ...marks };
}

function link(url: string, label = "Link") {
  return { type: "link", url, children: [text(label)] };
}

describe("RichText", () => {
  it("renders Shopify ordered and unordered lists as their list elements", async () => {
    let item = (value: string) => ({
      type: "list-item",
      children: [text(value)],
    });
    let html = await render([
      { type: "list", listType: "ordered", children: [item("First")] },
      { type: "list", listType: "unordered", children: [item("Bullet")] },
    ]);

    assert.match(html, /<ol><li><span>First<\/span><\/li><\/ol>/);
    assert.match(html, /<ul><li><span>Bullet<\/span><\/li><\/ul>/);
  });

  it("renders text marks and heading levels", async () => {
    let html = await render([
      { type: "heading", level: 3, children: [text("Care")] },
      { type: "heading", level: 1, children: [text("Overview")] },
      {
        type: "paragraph",
        children: [text("Soft", { bold: true, italic: true, underline: true })],
      },
      { type: "paragraph", children: [] },
    ]);

    assert.match(html, /<h3><span>Care<\/span><\/h3>/);
    assert.match(html, /<h2><span>Overview<\/span><\/h2>/);
    assert.match(html, /<u><em><strong>Soft<\/strong><\/em><\/u>/);
    assert.match(html, /<p><br\s*\/?><\/p>/);
  });

  it("links to web, fragment, and market-localized internal URLs", async () => {
    let html = await render(
      [
        {
          type: "paragraph",
          children: [
            link("https://remix.run/docs", "Docs"),
            link("#care", "Care"),
            link("/pages/contact", "Contact"),
          ],
        },
      ],
      "/en-ca",
    );

    assert.match(
      html,
      /<a href="https:\/\/remix\.run\/docs" rel="noreferrer"><span>Docs<\/span><\/a>/,
    );
    assert.match(html, /<a href="#care"><span>Care<\/span><\/a>/);
    assert.match(
      html,
      /<a href="\/en-ca\/pages\/contact"><span>Contact<\/span><\/a>/,
    );
  });

  it("renders unsafe or malformed link URLs as plain text", async () => {
    let html = await render([
      {
        type: "paragraph",
        children: [
          link("javascript:alert(1)", "Script"),
          link("data:text/html,hi", "Data"),
          link("not a url", "Broken"),
          { type: "link", children: [text("Missing")] },
        ],
      },
    ]);

    assert.doesNotMatch(html, /<a\b/);
    for (let label of ["Script", "Data", "Broken", "Missing"]) {
      assert.match(html, new RegExp(`<span><span>${label}</span></span>`));
    }
  });

  it("shows a non-JSON value as escaped plain text", async () => {
    let html = await renderToString(
      <RichText value="Plain <b>description</b>" />,
    );

    assert.match(
      html,
      /<p><span>Plain &lt;b&gt;description&lt;\/b&gt;<\/span><\/p>/,
    );
  });

  it("ignores node fields with unexpected types", async () => {
    let html = await render([
      {
        type: "paragraph",
        children: [
          { type: "text", value: 42, bold: "yes" },
          "stray",
          { type: "heading", level: "3", children: [text("Level")] },
        ],
      },
    ]);

    assert.match(html, /<p><span><\/span><h2><span>Level<\/span><\/h2><\/p>/);
  });
});
