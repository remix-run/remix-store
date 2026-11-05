import {
  createCartServerHandlers,
  getCartId,
  gql,
  type CartDataFromHandlers,
  type CartGetData,
  type CartUserError,
  type CartWarning,
} from "@shopify/hydrogen";
import type {
  SerializableObject,
  SerializablePrimitive,
} from "remix/component";

import { isRequestAbort } from "../runtime.ts";
import { isStorefrontFailure, type AppStorefrontClient } from "./storefront.ts";

const CART_FRAGMENT = gql(`
  fragment CartFragment on Cart {
    updatedAt
    lines(first: 250) {
      nodes {
        discountAllocations {
          __typename
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

type SerializableCartValue<Value> = Value extends SerializablePrimitive
  ? Value
  : Value extends readonly (infer Item)[]
    ? SerializableCartValue<Item>[]
    : Value extends object
      ? SerializableObject & {
          [
            Key in keyof Value as string extends Key
              ? never
              : number extends Key
                ? never
                : Key
          ]: SerializableCartValue<Value[Key]>;
        }
      : never;

type HydrogenCartData = CartDataFromHandlers<typeof cartHandlers>;

export type SerializedCartData = SerializableCartValue<HydrogenCartData>;
export type CartInitialData = SerializableCartValue<
  CartGetData<HydrogenCartData>
>;

/** Response data of the Hydrogen cart operations the app runs, by operation name. */
export interface CartOperations {
  Cart: { cart: SerializedCartData | null };
  CartCreate: {
    cartCreate: {
      cart: SerializedCartData | null;
      userErrors: CartUserError[];
      warnings: CartWarning[];
    };
  };
}

/**
 * Loads the current cart for SSR. A missing or malformed cart cookie renders
 * an empty cart, and so does a Storefront failure, so a cart query outage
 * never takes down the rest of the page. Aborts and bugs still throw.
 */
export async function loadCartDataOrEmpty(
  storefrontClient: AppStorefrontClient,
  request: Request,
): Promise<CartInitialData> {
  let cartId = getCartId(request);
  if (!cartId) return { cart: null };

  try {
    let result = await cartHandlers.get({ request, storefrontClient });
    // SAFETY: Hydrogen produced this nested, JSON-serializable GraphQL result
    // from CART_FRAGMENT; only its open extension fields block inference.
    return result.data as CartInitialData;
  } catch (error) {
    if (isRequestAbort(request, error) || !isStorefrontFailure(error)) {
      throw error;
    }
    console.error(
      "[hydrogen] Cart query failed; rendering without cart data",
      error,
    );
    return { cart: null };
  }
}
