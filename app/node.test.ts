import * as assert from "remix/assert";
import { after, describe, it } from "remix/test";

import { app, browserEntryHref, closeNodeApp } from "./node.ts";

after(closeNodeApp);

describe("node platform", () => {
  it("compiles the shared browser entry with Remix Assets", async () => {
    let response = await app.fetch(
      new Request(`http://localhost${browserEntryHref}`),
    );
    let source = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /javascript/);
    assert.match(source, /remix\/dist\/ui\.js/);
  });

  it("does not expose non-browser files through the asset mount", async () => {
    let response = await app.fetch(
      new Request("http://localhost/assets/node_modules/remix/package.json"),
    );

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not Found");
  });

  it("serves public files before application routes", async () => {
    let response = await app.fetch(
      new Request("http://localhost/remix-favicon.svg"),
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /image\/svg\+xml/);
  });
});
