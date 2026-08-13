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
let backingCartStore: CartStore | undefined;
let backingUnsubscribe: (() => void) | undefined;
let browserCartConnected = false;
let browserCartPathPrefix: MarketPathPrefix | undefined;
let browserCartListeners = new Set<
  (state: ReturnType<CartStore["getState"]>) => void
>();

/**
 * Returns the single cart store for this browser page.
 *
 * Never create this store at module scope: the same module is evaluated while
 * server-rendering client entries, where a singleton would leak across requests.
 */
export function resetBrowserCartStore() {
  backingUnsubscribe?.();
  backingUnsubscribe = undefined;
  backingCartStore?.destroy();
  backingCartStore = undefined;
  browserCartStore = undefined;
  browserCartConnected = false;
  browserCartPathPrefix = undefined;
  browserCartListeners.clear();
}

export function getBrowserCartStore(
  initialData?: CartInitialData,
  pathPrefix: MarketPathPrefix = "",
): CartStore | undefined {
  if (typeof document === "undefined") return undefined;

  configureCartEndpoint(getCartApiPath(pathPrefix));

  if (browserCartStore && browserCartPathPrefix !== pathPrefix) {
    browserCartPathPrefix = pathPrefix;
    replaceCartSnapshot(initialData ?? { cart: null });
  }

  if (!browserCartStore) {
    backingCartStore = createCartStore({
      initialData: initialData as CreateCartStoreOptions["initialData"],
    });
    browserCartStore = createBrowserCartFacade();
    browserCartPathPrefix = pathPrefix;
    subscribeToBackingStore();
  } else if (initialData !== undefined) {
    browserCartPathPrefix = pathPrefix;
    reconcileServerSnapshot(initialData);
  }

  browserCartStore.connect();
  return browserCartStore;
}

function createBrowserCartFacade(): CartStore {
  return {
    connect() {
      if (browserCartConnected) return;
      browserCartConnected = true;
      if (!backingUnsubscribe) subscribeToBackingStore();
      backingCartStore?.connect();
    },
    destroy() {
      browserCartConnected = false;
      backingUnsubscribe?.();
      backingUnsubscribe = undefined;
      backingCartStore?.destroy();
    },
    hydrate(data) {
      backingCartStore?.hydrate(data);
    },
    getState() {
      if (!backingCartStore) {
        throw new Error("Browser cart store is not initialized");
      }
      return backingCartStore.getState();
    },
    subscribe(listener) {
      browserCartListeners.add(listener);
      return () => browserCartListeners.delete(listener);
    },
    fetch() {
      if (!backingCartStore) return Promise.resolve();
      return backingCartStore.fetch();
    },
    reset() {
      backingCartStore?.reset();
    },
    handleFormSubmit(event, eventDetail) {
      if (!backingCartStore) return Promise.resolve();
      return backingCartStore.handleFormSubmit(event, eventDetail);
    },
  };
}

function subscribeToBackingStore(): void {
  backingUnsubscribe?.();
  backingUnsubscribe = backingCartStore?.subscribe((state) => {
    for (let listener of browserCartListeners) listener(state);
  });
}

function reconcileServerSnapshot(initialData: CartInitialData): void {
  if (!backingCartStore) return;
  let state = backingCartStore.getState();
  if (
    state.pending.lines.size > 0 ||
    state.pending.note ||
    state.pending.discountCodes.size > 0
  ) {
    return;
  }

  let serverCart = initialData.cart as CartData | null;
  if (serverCart === null) {
    if (state.data.id === null && !state.loading) return;
    replaceCartSnapshot(initialData);
    return;
  }

  let isDifferentCart = state.data.id !== serverCart.id;
  let isNewerSameCart =
    state.data.id === serverCart.id &&
    isNewerUpdatedAt(serverCart.updatedAt, state.data.updatedAt);
  if (isDifferentCart || isNewerSameCart) replaceCartSnapshot(initialData);
}

function replaceCartSnapshot(initialData: CartInitialData): void {
  let wasConnected = browserCartConnected;
  backingUnsubscribe?.();
  backingCartStore?.destroy();
  backingCartStore = createCartStore({
    initialData: initialData as CreateCartStoreOptions["initialData"],
  });
  subscribeToBackingStore();
  if (wasConnected) backingCartStore.connect();

  let state = backingCartStore.getState();
  for (let listener of browserCartListeners) listener(state);
}

function isNewerUpdatedAt(
  serverValue: unknown,
  browserValue: unknown,
): boolean {
  if (typeof serverValue !== "string") return false;
  let serverTime = Date.parse(serverValue);
  if (!Number.isFinite(serverTime)) return false;
  if (typeof browserValue !== "string") return true;
  let browserTime = Date.parse(browserValue);
  return !Number.isFinite(browserTime) || serverTime > browserTime;
}
