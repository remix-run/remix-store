import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { render } from "../middleware/render.tsx";
import { createAppRouter } from "../router.ts";
import { routes } from "../routes.ts";

const testEnv = {
  PUBLIC_STORE_DOMAIN: "example.myshopify.com",
  ["PUBLIC_" + "STOREFRONT_API_TOKEN"]: "test-token",
};

function createTestRouter(fetch?: typeof globalThis.fetch) {
  return createAppRouter({
    renderer: render({
      documentAssets: { css: [], entry: "/assets/entry.js", js: [] },
      resolveClientEntry(_entryId, component) {
        return { href: "/assets/component.js", exportName: component.name };
      },
    }),
    storefront: { env: testEnv, fetch },
  });
}

describe("platform skeleton", () => {
  it("server-renders live Storefront API data and a hydration entry", async () => {
    let calls = 0;
    let mockFetch = (async () => {
      calls++;
      return new Response(
        JSON.stringify({
          data: {
            shop: {
              name: "Test Remix Store",
              description: "A test storefront",
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;
    let router = createTestRouter(mockFetch);

    let response = await router.fetch(
      new Request("https://example.com" + routes.home.href()),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.match(html, /Test Remix Store/);
    assert.match(html, /Hydration check: 0/);
    assert.match(html, /"exportName":"Counter"/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("renders a branded 500 when the Storefront API returns errors", async () => {
    let mockFetch = (async () =>
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "Upstream failure" }],
        }),
        { headers: { "Content-Type": "application/json" } },
      )) as typeof globalThis.fetch;
    let router = createTestRouter(mockFetch);
    let originalConsoleError = console.error;
    console.error = () => {};

    try {
      let response = await router.fetch(
        new Request("https://example.com" + routes.home.href()),
      );
      let html = await response.text();

      assert.equal(response.status, 500);
      assert.match(html, /Storefront unavailable/);
      assert.doesNotMatch(html, /Upstream failure/);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("returns a server-rendered 404 for unknown routes", async () => {
    let router = createTestRouter();

    let response = await router.fetch(
      new Request("https://example.com/missing"),
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Page not found/);
  });
});
