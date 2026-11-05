import {
  configureCartEndpoint,
  createCartStore,
  type CartData,
  type CartStore,
  type MoneyV2,
} from "@shopify/hydrogen";

import type {
  CartInitialData,
  SerializedCartData,
} from "../../data/public/cart.ts";
import { cartApiPath } from "../../lib/public/cart-routes.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";

type StoreCartLine = CartData["lines"]["nodes"][number];

/**
 * A store cart line with the fields the app reads beyond Hydrogen's open
 * `CartData` type. CART_FRAGMENT selects `discountAllocations`; Hydrogen's
 * standard fragment selects the merchandise analytics fields. Optimistic lines
 * can lack server-selected fields until the cart reconciles, so all are
 * optional.
 */
export type AppCartLine = Omit<StoreCartLine, "merchandise"> & {
  discountAllocations?: Array<{
    __typename?: string;
    discountedAmount: MoneyV2;
  }>;
  merchandise?: {
    id: string;
    title?: string;
    sku?: string | null;
    product?: {
      id?: string;
      title: string;
      vendor?: string;
      productType?: string | null;
      handle?: string;
    };
  };
};

/** The app fragment's view of a store cart; see {@link AppCartLine}. */
export type AppCartData = {
  updatedAt?: string;
  lines: { nodes: AppCartLine[] };
};

/**
 * Views store cart data through the app's cart fragment. CartStore keeps only
 * Hydrogen's open `CartData` type, which drops custom fragment fields.
 */
export function appCartData(cart: CartData): AppCartData {
  // SAFETY: The one store is created from SerializedCartData (CART_FRAGMENT
  // plus Hydrogen's standard fragment), and every field it adds is optional.
  return cart as AppCartData;
}

let browserCartStore: CartStore | undefined;
let endpointPathPrefix: MarketPathPrefix | undefined;

/**
 * Creates (once) and connects the one live cart store for this browser
 * document, pointing Hydrogen's cart endpoint at the given market.
 *
 * `initialData` only bootstraps that store. Once connected, Hydrogen owns the
 * cart state and publishes every optimistic and confirmed change to subscribers.
 * Returns `undefined` during SSR, where modules are shared by requests.
 */
export function connectBrowserCartStore(
  initialData?: CartInitialData,
  pathPrefix: MarketPathPrefix = "",
): CartStore | undefined {
  if (!globalThis.document) return undefined;

  if (endpointPathPrefix !== pathPrefix) {
    configureCartEndpoint(cartApiPath(pathPrefix));
    endpointPathPrefix = pathPrefix;
  }

  if (!browserCartStore) {
    browserCartStore = createCartStore<SerializedCartData>({ initialData });
  } else if (
    initialData?.cart &&
    browserCartStore.getState().data.id === null
  ) {
    // Another island may have created the singleton before the cart shell.
    // Seed it once when server cart data arrives, then trust the live store.
    browserCartStore.hydrate(initialData.cart);
  }

  browserCartStore.connect();
  return browserCartStore;
}

export function resetBrowserCartStore(): void {
  browserCartStore?.destroy();
  browserCartStore = undefined;
  endpointPathPrefix = undefined;
}
