import type {
  CartInitialData,
  SerializedCartData,
} from "../data/public/cart.ts";

export const CART_ID = "gid://shopify/Cart/test-cart";
export const CART_LINE_ID = "gid://shopify/CartLine/test-line";
export const VARIANT_ID = "gid://shopify/ProductVariant/444";
export const CART_UPDATED_AT = "2026-01-01T00:00:00.000Z";

const USD = "USD";

function moneyV2(amount: string): SerializedCartData["cost"]["totalAmount"] {
  return { amount, currencyCode: USD };
}

export function createCart(quantity = 1): SerializedCartData {
  let amount = String(quantity * 10);

  return {
    id: CART_ID,
    checkoutUrl: "https://checkout.example.test/cart",
    totalQuantity: quantity,
    updatedAt: CART_UPDATED_AT,
    note: null,
    attributes: [],
    cost: {
      checkoutChargeAmount: moneyV2(amount),
      subtotalAmount: moneyV2(amount),
      totalAmount: moneyV2(amount),
    },
    lines: {
      nodes: quantity
        ? [
            {
              discountAllocations: [],
              id: CART_LINE_ID,
              quantity,
              attributes: [],
              cost: {
                amountPerQuantity: moneyV2("10"),
                compareAtAmountPerQuantity: null,
                subtotalAmount: moneyV2(amount),
                totalAmount: moneyV2(amount),
              },
              merchandise: {
                id: VARIANT_ID,
                title: "Default Title",
                selectedOptions: [{ name: "Title", value: "Default Title" }],
                product: {
                  handle: "test-product",
                  id: "gid://shopify/Product/test-product",
                  productType: "Test",
                  title: "Test Product",
                  vendor: "Test Vendor",
                },
                image: null,
                sku: "TEST-SKU",
              },
              sellingPlanAllocation: null,
            },
          ]
        : [],
    },
    discountCodes: [],
  };
}

export function createCartInitialData(quantity = 1): CartInitialData {
  return { cart: createCart(quantity) };
}
