import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  graphqlResponse,
  navigationData,
  type StorefrontRequestBody,
} from "../../testing/storefront.ts";

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
    assert.match(html, /Racing shirt/);
    assert.match(html, /\$30\.00/);
    assert.match(html, /\$20\.00/);
    assert.match(html, /<form action="\/collections\/racing" method="get"/);
    assert.match(html, /name="cursor" value="next-page"/);
  });

  it("renders collection metadata", async () => {
    let app = createTestApp(
      storefrontFetch(() =>
        collectionData({ hasNextPage: false, endCursor: null }),
      ),
    );

    let response = await app.fetch(
      new Request("https://example.com/collections/racing"),
    );
    let html = await response.text();

    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/example\.com\/collections\/racing"/,
    );
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/example\.com\/social-collections\.jpg"/,
    );
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
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(variables?.first, 8);
    assert.equal(variables?.after, "current-page");
    assert.equal(data.products[0]?.id, "gid://shopify/Product/1");
    assert.equal(data.pageInfo.hasNextPage, false);
  });

  it("honors an Accept header that explicitly rejects JSON", async () => {
    let app = createTestApp(
      storefrontFetch(() =>
        collectionData({ hasNextPage: false, endCursor: null }),
      ),
    );
    let url = new URL(
      `${routes.collections.show.href({ handle: "racing" })}?cursor=current-page`,
      "https://example.com",
    );

    let response = await app.fetch(
      new Request(url, { headers: { Accept: "application/json;q=0" } }),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<h1>Racing collection<\/h1>/);
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
      return graphqlResponse({
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
    assert.equal(calls, 2);
  });
});

function storefrontFetch(
  collection: (body: StorefrontRequestBody) => unknown,
): typeof globalThis.fetch {
  return createStorefrontFetch({
    RemixAnalyticsShop: analyticsShopData,
    RemixCollection: collection,
    RemixNavigation: navigationData,
  });
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
              compareAtPrice: { amount: "30.00", currencyCode: "USD" },
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
