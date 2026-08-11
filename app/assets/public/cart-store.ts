import {
  configureCartEndpoint,
  createCartStore,
  type CartData,
  type CartStore,
  type CreateCartStoreOptions,
} from "@shopify/hydrogen";

import type { CartInitialData } from "../../data/cart.ts";
import { CART_API_PATH } from "../../lib/public/cart-routes.ts";

export type { CartInitialData } from "../../data/cart.ts";
export { CART_API_PATH } from "../../lib/public/cart-routes.ts";

let browserCartStore: CartStore | undefined;

/**
 * Returns the single cart store for this browser page.
 *
 * Never create this store at module scope: the same module is evaluated while
 * server-rendering client entries, where a singleton would leak across requests.
 */
export function resetBrowserCartStore() {
  browserCartStore?.destroy();
  browserCartStore = undefined;
}

export function getBrowserCartStore(
  initialData?: CartInitialData,
): CartStore | undefined {
  if (typeof document === "undefined") return undefined;

  configureCartEndpoint(CART_API_PATH);

  if (!browserCartStore) {
    browserCartStore = createCartStore({
      initialData: initialData as CreateCartStoreOptions["initialData"],
    });
  } else if (
    initialData?.cart &&
    browserCartStore.getState().data.id === null
  ) {
    // A server-rendered cart surface may hydrate after the global cart dialog.
    // Prefer that server snapshot while the browser store is still empty.
    browserCartStore.hydrate(initialData.cart as CartData);
  }

  browserCartStore.connect();
  return browserCartStore;
}
