import type { ProductData } from "../app/data/storefront.ts";

export const RED_VARIANT_ID = "gid://shopify/ProductVariant/111";
export const BLUE_VARIANT_ID = "gid://shopify/ProductVariant/222";

type ProductVariant = NonNullable<
  ProductData["selectedOrFirstAvailableVariant"]
>;

export function createProduct(redVariantId = RED_VARIANT_ID): ProductData {
  let redVariant: ProductVariant = {
    id: redVariantId,
    title: "Red",
    availableForSale: true,
    selectedOptions: [{ name: "Color", value: "Red" }],
    price: { amount: "10.00", currencyCode: "USD" },
    compareAtPrice: null,
    image: image("red", "Red product"),
    product: { title: "Test Product", handle: "test-product" },
    sku: "RED-SKU",
  };
  let blueVariant: ProductVariant = {
    id: BLUE_VARIANT_ID,
    title: "Blue",
    availableForSale: false,
    selectedOptions: [{ name: "Color", value: "Blue" }],
    price: { amount: "15.00", currencyCode: "USD" },
    compareAtPrice: { amount: "20.00", currencyCode: "USD" },
    image: image("blue", "Blue product"),
    product: { title: "Test Product", handle: "test-product" },
    sku: "BLUE-SKU",
  };
  let greenVariant: ProductVariant = {
    id: "gid://shopify/ProductVariant/333",
    title: "Green",
    availableForSale: true,
    selectedOptions: [{ name: "Color", value: "Green" }],
    price: { amount: "12.00", currencyCode: "USD" },
    compareAtPrice: null,
    image: image("green", "Green product"),
    product: { title: "Related Product", handle: "related-product" },
    sku: "GREEN-SKU",
  };

  return {
    id: "gid://shopify/Product/test",
    handle: "test-product",
    title: "Test Product",
    vendor: "Test Vendor",
    category: { name: "Test category" },
    customDescription: null,
    description: "A test product.",
    requiresSellingPlan: false,
    seo: { title: "Test Product", description: "A test product." },
    technicalDescription: null,
    subscribeIfBackInStock: { value: "true" },
    priceRange: {
      minVariantPrice: { amount: "10.00", currencyCode: "USD" },
    },
    encodedVariantExistence: "v1_0 2 3",
    encodedVariantAvailability: "v1_0 3",
    options: [
      {
        name: "Color",
        optionValues: [
          { name: "Red", firstSelectableVariant: redVariant },
          { name: "Missing", firstSelectableVariant: null },
          { name: "Blue", firstSelectableVariant: blueVariant },
          { name: "Green", firstSelectableVariant: greenVariant },
        ],
      },
    ],
    selectedOrFirstAvailableVariant: redVariant,
    adjacentVariants: [redVariant, blueVariant, greenVariant],
    images: { nodes: [image("product", "Test product")] },
  };
}

function image(name: string, altText: string) {
  return {
    id: `gid://shopify/ProductImage/${name}`,
    url: `https://cdn.shopify.com/${name}.jpg`,
    altText,
    width: 1200,
    height: 1200,
  };
}
