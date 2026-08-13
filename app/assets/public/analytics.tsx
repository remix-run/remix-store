import {
  AnalyticsEvent,
  trackCartAnalytics,
  type AnalyticsCart,
  type CartData,
  type CartState,
  type CartStore,
  type ProductPayload,
  type StorefrontAnalytics,
} from "@shopify/hydrogen";
import { clientEntry, type Handle, type SerializableObject } from "remix/ui";

let analytics: StorefrontAnalytics | null = null;

/** Returns the single consent-aware analytics bus created by ShopifyScripts. */
export function getAnalytics(): StorefrontAnalytics | null {
  if (typeof window === "undefined") return null;
  let globalAnalytics = window.Shopify?.analytics ?? null;
  if (globalAnalytics !== analytics) analytics = globalAnalytics;
  return analytics;
}

/**
 * Creates the page-lifetime publisher used by the Remix top-frame lifecycle.
 * Identical URLs are ignored so initial hydration and development reloads do
 * not double count a page view.
 */
export function createPageViewPublisher(
  getUrl: () => string = () => window.location.href,
): () => void {
  let lastPublishedUrl: string | undefined;

  return () => {
    let url = getUrl();
    if (url === lastPublishedUrl) return;

    let bus = getAnalytics();
    if (!bus) return;
    bus.publish(AnalyticsEvent.PAGE_VIEWED, { url });
    lastPublishedUrl = url;
  };
}

/** Starts Hydrogen's confirmed-cart diff tracker for the shared cart store. */
export function trackConfirmedCartChanges(store?: CartStore): () => void {
  if (!store || !getAnalytics()) return () => {};

  let stopped = false;
  let currentState = store.getState();
  let activeCartId = settledCart(currentState)?.id ?? null;
  let trackerListener: ((state: CartState) => void) | undefined;
  let stopTracker = () => {};
  let nullSnapshotVersion = 0;
  let trackerStore = {
    ...store,
    getState: () => currentState,
    subscribe(listener: (state: CartState) => void) {
      trackerListener = listener;
      return () => {
        if (trackerListener === listener) trackerListener = undefined;
      };
    },
  } satisfies CartStore;

  function restartTracker() {
    stopTracker();
    stopTracker = trackCartAnalytics(trackerStore);
  }

  restartTracker();
  let stopStore = store.subscribe((nextState) => {
    currentState = nextState;
    if (hasPendingCartWork(nextState)) {
      trackerListener?.(nextState);
      return;
    }

    let nextCartId = nextState.data.id;
    if (nextCartId === null) {
      // Same-ID snapshot replacement emits a synchronous empty state between
      // reset and hydrate. Delay treating null as a new baseline so that
      // transition still produces a line delta from the prior cart.
      trackerListener?.(nextState);
      let version = ++nullSnapshotVersion;
      queueMicrotask(() => {
        if (
          stopped ||
          version !== nullSnapshotVersion ||
          hasPendingCartWork(currentState) ||
          currentState.data.id !== null
        ) {
          return;
        }
        activeCartId = null;
        restartTracker();
      });
      return;
    }

    nullSnapshotVersion += 1;
    if (activeCartId !== null && activeCartId !== nextCartId) {
      // Hydrogen's pinned tracker dedupes by updatedAt before cart ID. Start a
      // fresh baseline when the shopper switches carts so equal timestamps and
      // unrelated line IDs cannot create cross-cart deltas.
      activeCartId = nextCartId;
      restartTracker();
      return;
    }

    trackerListener?.(nextState);
    activeCartId = nextCartId;
  });

  return () => {
    stopped = true;
    nullSnapshotVersion += 1;
    stopStore();
    stopTracker();
  };
}

/** Publishes a cart view from settled cart state, never optimistic state. */
export function publishCartViewed(store?: CartStore): boolean {
  let bus = getAnalytics();
  if (!bus) return false;

  let payload = {
    cart: toAnalyticsCart(store ? settledCart(store.getState()) : null),
    prevCart: null,
  };
  bus.publish(AnalyticsEvent.CART_VIEWED, payload);
  return true;
}

function hasPendingCartWork(state: CartState): boolean {
  return (
    state.pending.lines.size > 0 ||
    state.pending.note ||
    state.pending.discountCodes.size > 0
  );
}

function settledCart(state: CartState): CartData | null {
  if (hasPendingCartWork(state)) return null;
  return state.data.id ? state.data : null;
}

/** Normalizes the app cart into the pinned analytics cart contract. */
export function toAnalyticsCart(cart: CartData | null): AnalyticsCart | null {
  if (!cart?.id || typeof cart.updatedAt !== "string" || !cart.updatedAt) {
    return null;
  }

  return {
    id: cart.id,
    updatedAt: cart.updatedAt,
    cost: cart.cost,
    lines: {
      nodes: cart.lines.nodes.flatMap((line) => {
        let merchandise = line.merchandise;
        if (!merchandise) return [];
        let productId = merchandise.product.id;
        let vendor = merchandise.product.vendor;
        if (typeof productId !== "string" || typeof vendor !== "string") {
          return [];
        }

        return [
          {
            id: line.id,
            quantity: line.quantity,
            merchandise: {
              id: merchandise.id,
              title: merchandise.title ?? merchandise.product.title,
              price: line.cost.amountPerQuantity,
              sku: typeof merchandise.sku === "string" ? merchandise.sku : null,
              product: {
                id: productId,
                title: merchandise.product.title,
                vendor,
                productType:
                  typeof merchandise.product.productType === "string"
                    ? merchandise.product.productType
                    : undefined,
                handle: merchandise.product.handle,
              },
            },
          },
        ];
      }),
    },
  };
}

type AnalyticsProduct = SerializableObject & ProductPayload;

export const ProductViewed = clientEntry(
  import.meta.url,
  function ProductViewed(handle: Handle<{ product: AnalyticsProduct }>) {
    let lastPublishedIdentity: string | undefined;

    return () => {
      let product = handle.props.product;
      let identity = `${product.id}\u0000${product.variantId}`;
      if (identity === lastPublishedIdentity) return null;

      let bus = getAnalytics();
      if (!bus) return null;
      bus.publish(AnalyticsEvent.PRODUCT_VIEWED, { products: [product] });
      lastPublishedIdentity = identity;
      return null;
    };
  },
);

export const CollectionViewed = clientEntry(
  import.meta.url,
  function CollectionViewed(
    handle: Handle<{
      collection: SerializableObject & { handle: string; id: string };
    }>,
  ) {
    let lastPublishedIdentity: string | undefined;

    return () => {
      let collection = handle.props.collection;
      if (collection.id === lastPublishedIdentity) return null;

      let bus = getAnalytics();
      if (!bus) return null;
      bus.publish(AnalyticsEvent.COLLECTION_VIEWED, { collection });
      lastPublishedIdentity = collection.id;
      return null;
    };
  },
);
