import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../../testing/storefront.ts";

describe("product routes", () => {
  it("resolves URL options and renders safe, no-JS variant and cart controls", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        RemixProductNavigation: () => ({
          menu: {
            items: [
              {
                id: "all-products",
                title: "All products",
                url: "https://example.com/collections/all",
              },
            ],
          },
          shop: { primaryDomain: { url: "https://example.com" } },
        }),
        RemixProduct(body) {
          variables = body.variables;
          return { product: productData() };
        },
      }),
    );
    let href = `${routes.products.show.href({ handle: "test-product" })}?Color=Red&ref=campaign`;

    let response = await app.fetch(new Request(`https://example.com${href}`));
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(variables?.selectedOptions, [
      { name: "Color", value: "Red" },
      { name: "ref", value: "campaign" },
    ]);
    assert.match(html, /<title>Test Product<\/title>/);
    assert.match(html, /<meta property="og:type" content="product"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/example\.com\/products\/test-product"/,
    );
    assert.match(html, /<h1[^>]*>Test Product<\/h1>/);
    assert.match(html, /aria-label="Product collections"/);
    assert.match(html, /href="\/collections\/all">All products<\/a>/);
    assert.match(html, /<shop-pay-button[^>]*variants="111:1"/);
    assert.match(
      html,
      /href="\/products\/test-product\?ref=campaign&amp;Color=Blue"/,
    );
    assert.match(html, /Blue — Sold out/);
    assert.match(html, /Technical Description/);
    assert.match(html, /Technical detail/);
    assert.match(
      html,
      /\[data-product-image\] \+ \[data-product-image\] \{\s*opacity: 0\.2;/,
    );
    assert.match(html, /action="\/api\/cart" method="post"/);
    assert.match(html, /name="merchandiseId"/);
    assert.match(html, /name="quantity" value="1"/);
    assert.match(html, />Add to cart<\/button>/);
    assert.doesNotMatch(html, /aria-label="Previous image"/);
    assert.doesNotMatch(html, /aria-label="Next image"/);
    assert.doesNotMatch(html, /href="javascript:/);
  });

  it("renders the branded 404 when a product is missing", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        RemixProductNavigation: () => ({ menu: null, shop: null }),
        RemixProduct: () => ({ product: null }),
      }),
    );

    let response = await app.fetch(
      new Request("https://example.com/products/not-a-product"),
    );

    assert.equal(response.status, 404);
    assert.match(await response.text(), /Page not found/);
  });
});

function productData() {
  let red = variant({
    availableForSale: true,
    id: "gid://shopify/ProductVariant/111",
    image: image("red"),
    selectedOptions: [{ name: "Color", value: "Red" }],
  });
  let blue = variant({
    availableForSale: false,
    id: "gid://shopify/ProductVariant/222",
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
    vendor: "Test Vendor",
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
    sku: `SKU-${id.split("/").at(-1)}`,
    selectedOptions,
    title: selectedOptions[0]?.value ?? "Default Title",
  };
}
