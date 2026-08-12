import {
  createCartServerHandlers,
  getCartId,
  gql,
  type StorefrontClient,
} from "@shopify/hydrogen";

import type { CartInitialData } from "./cart.ts";

// Extend the default Hydrogen cart fragment with per-line discount amounts.
// Labels remain app-owned so merchant discount codes are not exposed in cart UI.
// The Storefront API `gql check` validates this against the pinned schema.
const CART_FRAGMENT = gql(`
  fragment CartFragment on Cart {
    lines(first: 250) {
      nodes {
        discountAllocations {
          discountedAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
`);

export const cartHandlers = createCartServerHandlers({
  fragment: CART_FRAGMENT,
});

/**
 * Loads the current cart for SSR. A missing or malformed cart cookie renders
 * an empty cart; transport failures are caught so a cart query outage never
 * takes down the rest of the page.
 */
export async function getCartData(
  request: Request,
  storefrontClient: StorefrontClient,
): Promise<CartInitialData> {
  let cartId = getCartId(request);
  if (!cartId) return { cart: null };

  try {
    let result = await cartHandlers.get({ request, storefrontClient });
    return result.data as CartInitialData;
  } catch (error) {
    if (request.signal.aborted && error === request.signal.reason) throw error;
    console.error(
      "[hydrogen] Cart query failed; rendering without cart data",
      error,
    );
    return { cart: null };
  }
}
