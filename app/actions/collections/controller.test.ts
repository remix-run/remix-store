import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MemoryStorefrontCache } from "../../data/storefront-cache.ts";
import { render } from "../../middleware/render.tsx";
import { createApp } from "../../router.ts";
import { routes } from "../../routes.ts";

const testEnv = {
  PUBLIC_STORE_DOMAIN: "example.myshopify.com",
  ["PUBLIC_" + "STOREFRONT_API_TOKEN"]: "test-token",
};

function createTestApp(fetch: typeof globalThis.fetch) {
  return createApp({
    renderer: render({
      documentAssets: { css: [], entry: "/assets/entry.js", js: [] },
      resolveClientEntry(_entryId, component) {
        return { href: "/assets/component.js", exportName: component.name };
      },
    }),
    storefront: { cache: new MemoryStorefrontCache(), env: testEnv, fetch },
  });
}

describe("collection routes", () => {
  it("renders catalog cards and keeps load more as a GET fallback", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = createTestApp(
      storefrontFetch((body) => {
        variables = body.variables;
        return collectionData({ hasNextPage: true, endCursor: "next-page" });
      }),
    );

    let response = await app.fetch(
      new Request(
        "https://example.com" +
          routes.collections.show.href({ handle: "racing" }),
      ),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(variables?.first, 15);
    assert.equal(variables?.after, undefined);
    assert.match(html, /<h1>Racing collection<\/h1>/);
    assert.match(html, /href="\/products\/racing-shirt"/);
    assert.match(html, /srcset="[^"]+320w/);
    assert.match(html, /<form action="\/collections\/racing" method="get"/);
    assert.match(html, /name="cursor" value="next-page"/);
  });

  it("returns only a page of JSON for enhanced load more", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = createTestApp(
      storefrontFetch((body) => {
        variables = body.variables;
        return collectionData({ hasNextPage: false, endCursor: null });
      }),
    );
    let url = new URL(
      `${routes.collections.show.href({ handle: "racing" })}?cursor=current-page`,
      "https://example.com",
    );

    let response = await app.fetch(
      new Request(url, { headers: { Accept: "application/json" } }),
    );
    let data = (await response.json()) as {
      pageInfo: { hasNextPage: boolean };
      products: Array<{ id: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.equal(variables?.first, 8);
    assert.equal(variables?.after, "current-page");
    assert.equal(data.products[0]?.id, "gid://shopify/Product/1");
    assert.equal(data.pageInfo.hasNextPage, false);
  });

  it("renders a branded 404 when the collection is missing", async () => {
    let app = createTestApp(storefrontFetch(() => ({ collection: null })));

    let response = await app.fetch(
      new Request(
        "https://example.com" +
          routes.collections.show.href({ handle: "not-a-collection" }),
      ),
    );
    let html = await response.text();

    assert.equal(response.status, 404);
    assert.match(html, /Page not found/);
  });

  it("rejects oversized cursors before querying the catalog", async () => {
    let calls = 0;
    let app = createTestApp(async () => {
      calls++;
      return response({
        menu: null,
        footerMenu: null,
        shop: { primaryDomain: null },
      });
    });
    let url = new URL(
      routes.collections.show.href({ handle: "racing" }),
      "https://example.com",
    );
    url.searchParams.set("cursor", "x".repeat(2_049));

    let result = await app.fetch(new Request(url));

    assert.equal(result.status, 400);
    assert.equal(calls, 1);
  });
});

function storefrontFetch(
  collection: (body: { variables: Record<string, unknown> }) => unknown,
): typeof globalThis.fetch {
  return (async (_input, init) => {
    let body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    if (body.query.includes("RemixNavigation")) {
      return response({
        menu: null,
        footerMenu: null,
        shop: { primaryDomain: null },
      });
    }
    return response(collection(body));
  }) as typeof globalThis.fetch;
}

function collectionData(pageInfo: {
  hasNextPage: boolean;
  endCursor: string | null;
}) {
  return {
    collection: {
      id: "gid://shopify/Collection/1",
      handle: "racing",
      title: "Racing collection",
      description: "Racing apparel",
      products: {
        nodes: [
          {
            id: "gid://shopify/Product/1",
            handle: "racing-shirt",
            title: "Racing shirt",
            images: {
              nodes: [
                {
                  id: "gid://shopify/ProductImage/1",
                  url: "https://cdn.shopify.com/racing-shirt.jpg",
                  altText: "Racing shirt",
                  width: 1200,
                  height: 1200,
                },
              ],
            },
            selectedOrFirstAvailableVariant: {
              price: { amount: "20.00", currencyCode: "USD" },
              compareAtPrice: null,
            },
            priceRange: {
              minVariantPrice: { amount: "20.00", currencyCode: "USD" },
              maxVariantPrice: { amount: "20.00", currencyCode: "USD" },
            },
          },
        ],
        pageInfo,
      },
    },
  };
}

function response(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
