import * as assert from "remix/assert";
import { after, describe, it } from "remix/test";

import {
  app,
  browserEntryHref,
  browserEntryImportMap,
  closeNodeApp,
  productDetailsEntryHref,
  snowFieldEntryHref,
} from "./node.ts";

after(closeNodeApp);

describe("node platform", () => {
  it("serves a cheap health check before Storefront middleware", async () => {
    let response = await app.fetch(
      new Request("http://localhost/health", {
        headers: { "Accept-Encoding": "gzip" },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Content-Encoding"), null);
    assert.equal(await response.text(), "OK");
  });

  it("compiles the shared browser entry with Remix Assets", async () => {
    let response = await app.fetch(
      new Request(`http://localhost${browserEntryHref}`),
    );
    let source = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /javascript/);
    assert.match(source, /from["']remix\/ui["']/);
    assert.match(
      findImportMapAddress("remix/ui") ?? "",
      /\/remix\/dist\/ui\.js$/,
    );
    assert.match(
      findImportMapAddress("remix/multiple-import-maps-polyfill") ?? "",
      /\/remix\/dist\/multiple-import-maps-polyfill\.js$/,
    );
  });

  it("compiles the product hydration graph from allowed public modules", async () => {
    let response = await app.fetch(
      new Request(`http://localhost${productDetailsEntryHref}`),
    );
    let source = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /javascript/);
    assert.match(source, /productSubscriptionsEnabled/);
    assert.doesNotMatch(source, /data\/subscription/);
  });

  it("compiles the seasonal snow public client entry", async () => {
    let response = await app.fetch(
      new Request(`http://localhost${snowFieldEntryHref}`),
    );
    let source = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /javascript/);
    assert.match(source, /data-seasonal-snow/);
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

function findImportMapAddress(specifier: string): string | null | undefined {
  let maps = [
    browserEntryImportMap.imports,
    ...Object.values(browserEntryImportMap.scopes ?? {}),
  ];
  return maps.find((imports) => specifier in (imports ?? {}))?.[specifier];
}
