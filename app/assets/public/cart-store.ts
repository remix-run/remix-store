import {
  configureCartEndpoint,
  createCartStore,
  type CartData,
  type CartStore,
  type CreateCartStoreOptions,
} from "@shopify/hydrogen";

import type { CartInitialData } from "../../data/cart.ts";
import { getCartApiPath } from "../../lib/public/cart-routes.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";

export type { CartInitialData } from "../../data/cart.ts";
export { CART_API_PATH, getCartApiPath } from "../../lib/public/cart-routes.ts";

let browserCartStore: CartStore | undefined;

/**
 * Returns the one live cart store for this browser document.
 *
 * `initialData` only bootstraps that store. Once connected, Hydrogen owns the
 * cart state and publishes every optimistic and confirmed change to subscribers.
 * Never create the singleton during SSR, where modules are shared by requests.
 */
export function getBrowserCartStore(
  initialData?: CartInitialData,
  pathPrefix: MarketPathPrefix = "",
): CartStore | undefined {
  if (typeof document === "undefined") return undefined;

  if (!browserCartStore) {
    configureCartEndpoint(getCartApiPath(pathPrefix));
    browserCartStore = createCartStore({
      initialData: initialData as CreateCartStoreOptions["initialData"],
    });
  } else if (
    initialData?.cart &&
    browserCartStore.getState().data.id === null
  ) {
    // Another island may have created the singleton before the cart shell.
    // Seed it once when server cart data arrives, then trust the live store.
    browserCartStore.hydrate(initialData.cart as CartData);
  }

  browserCartStore.connect();
  return browserCartStore;
}

export function resetBrowserCartStore(): void {
  browserCartStore?.destroy();
  browserCartStore = undefined;
}
