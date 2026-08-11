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

describe("product routes", () => {
  it("resolves URL options and renders safe, no-JS variant links", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = createTestApp(async (_input, init) => {
      let body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      if (body.query.includes("RemixNavigation")) return navigationResponse();
      variables = body.variables;
      return graphqlResponse({ product: productData() });
    });
    let href = `${routes.products.show.href({ handle: "test-product" })}?Color=Red&ref=campaign`;

    let response = await app.fetch(new Request(`https://example.com${href}`));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(variables?.selectedOptions, [
      { name: "Color", value: "Red" },
      { name: "ref", value: "campaign" },
    ]);
    assert.match(html, /<title>Test Product<\/title>/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/example\.com\/products\/test-product"/,
    );
    assert.match(html, /<h1[^>]*>Test Product<\/h1>/);
    assert.match(
      html,
      /href="\/products\/test-product\?ref=campaign&amp;Color=Blue"/,
    );
    assert.match(html, /Blue — Sold out/);
    assert.match(html, /Technical Description/);
    assert.match(html, /Technical detail/);
    assert.doesNotMatch(html, /javascript:alert/);
  });

  it("renders the branded 404 when a product is missing", async () => {
    let app = createTestApp(async (_input, init) => {
      let body = JSON.parse(String(init?.body)) as { query: string };
      return body.query.includes("RemixNavigation")
        ? navigationResponse()
        : graphqlResponse({ product: null });
    });

    let response = await app.fetch(
      new Request("https://example.com/products/not-a-product"),
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Page not found/);
  });
});

function navigationResponse() {
  return graphqlResponse({
    footerMenu: { items: [] },
    menu: { items: [] },
    shop: { primaryDomain: { url: "https://example.myshopify.com" } },
  });
}

function graphqlResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}

function productData() {
  let red = variant({
    availableForSale: true,
    id: "gid://shopify/ProductVariant/red",
    image: image("red"),
    selectedOptions: [{ name: "Color", value: "Red" }],
  });
  let blue = variant({
    availableForSale: false,
    id: "gid://shopify/ProductVariant/blue",
    image: image("blue"),
    selectedOptions: [{ name: "Color", value: "Blue" }],
  });

  return {
    adjacentVariants: [blue],
    category: { name: "Test category" },
    customDescription: {
      value: JSON.stringify({
        children: [
          {
            children: [{ type: "text", value: "A structured test product." }],
            type: "paragraph",
          },
          {
            children: [{ type: "text", value: "Unsafe link" }],
            type: "link",
            url: "javascript:alert('nope')",
          },
        ],
      }),
    },
    description: "Fallback description",
    encodedVariantAvailability: "v1_0",
    encodedVariantExistence: "v1_0",
    handle: "test-product",
    id: "gid://shopify/Product/test",
    images: { nodes: [image("red"), image("blue")] },
    options: [
      {
        name: "Color",
        optionValues: [
          { firstSelectableVariant: red, name: "Red" },
          { firstSelectableVariant: blue, name: "Blue" },
        ],
      },
    ],
    priceRange: { minVariantPrice: red.price },
    requiresSellingPlan: false,
    selectedOrFirstAvailableVariant: red,
    seo: { description: "A test product", title: "Test Product" },
    technicalDescription: {
      value: JSON.stringify({
        children: [
          {
            children: [{ type: "text", value: "Technical detail" }],
            type: "paragraph",
          },
        ],
      }),
    },
    title: "Test Product",
  };
}

type ProductImageFixture = {
  altText: string;
  height: number;
  id: string;
  url: string;
  width: number;
};

function image(name: string): ProductImageFixture {
  return {
    altText: `${name} product image`,
    height: 800,
    id: `gid://shopify/Image/${name}`,
    url: `https://cdn.shopify.com/${name}.jpg`,
    width: 800,
  };
}

function variant({
  availableForSale,
  id,
  image,
  selectedOptions,
}: {
  availableForSale: boolean;
  id: string;
  image: ProductImageFixture;
  selectedOptions: Array<{ name: string; value: string }>;
}) {
  return {
    availableForSale,
    compareAtPrice: null,
    id,
    image,
    price: { amount: "20.00", currencyCode: "USD" },
    product: { handle: "test-product", title: "Test Product" },
    selectedOptions,
    title: selectedOptions[0]?.value ?? "Default Title",
  };
}
