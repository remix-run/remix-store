import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRoot } from "remix/component";

import { RichText } from "./rich-text.tsx";

function paragraph(value: string): string {
  return JSON.stringify({
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value }] }],
  });
}

describe("RichText in the browser", () => {
  it("renders the new value when props change on the same instance", (t) => {
    let container = document.createElement("div");
    let root = createRoot(container);
    t.after(root.dispose);

    root.render(<RichText value={paragraph("First product")} />);
    root.flush();
    assert.equal(container.textContent, "First product");

    root.render(<RichText value={paragraph("Second product")} />);
    root.flush();
    assert.equal(container.textContent, "Second product");
  });
});
