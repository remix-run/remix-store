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

import type { CartInitialData } from "../../data/cart.ts";
import { getBrowserCartStore } from "./cart-store.ts";

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

/**
 * Starts Hydrogen's confirmed-cart diff tracker for the shared cart store.
 *
 * TODO(hydrogen-preview): The facade and restart logic below exist because
 * the pinned tracker dedupes by `updatedAt` before cart ID, so a cart switch
 * with equal timestamps or unrelated line IDs could emit cross-cart deltas.
 * Delete this wrapper and subscribe the store directly once the preview
 * tracker keys its baseline by cart ID.
 */
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

let cancelDeferredCartView: (() => void) | undefined;

/**
 * Publishes a cart view, waiting for in-flight cart work to settle first.
 * A cart drawer opened mid-mutation reports the confirmed cart instead of
 * `cart: null`, matching the full cart page's settled-only behavior. Only
 * the most recent deferred view is kept, so rapid re-opens publish once.
 */
export function publishCartViewedWhenSettled(store?: CartStore): void {
  cancelDeferredCartView?.();
  cancelDeferredCartView = undefined;
  if (!getAnalytics()) return;

  if (store && hasPendingCartWork(store.getState())) {
    let unsubscribe = store.subscribe((nextState) => {
      if (hasPendingCartWork(nextState)) return;
      unsubscribe();
      cancelDeferredCartView = undefined;
      publishCartViewed(store);
    });
    cancelDeferredCartView = unsubscribe;
    return;
  }

  publishCartViewed(store);
}

/** Publishes a cart view from settled cart state, never optimistic state. */
export function publishCartViewed(store?: CartStore): boolean {
  let bus = getAnalytics();
  if (!bus) return false;

  bus.publish(AnalyticsEvent.CART_VIEWED, {
    cart: toAnalyticsCart(store ? settledCart(store.getState()) : null),
  });
  return true;
}

/**
 * Returns `true` when the cart store (or a raw state) has in-flight optimistic
 * work that has not yet been confirmed by the server.
 *
 * Accepts either a `CartStore` or a `CartState` so every call site can use one
 * helper instead of re-deriving the same pending check.
 */
export function hasPendingCartWork(
  source: CartState | CartStore | undefined,
): boolean {
  let state: CartState | undefined;
  if (source === undefined) {
    state = undefined;
  } else if ("getState" in source) {
    state = source.getState();
  } else {
    state = source;
  }
  if (!state) return false;
  return (
    state.pending.lines.size > 0 ||
    Boolean(state.pending.note) ||
    state.pending.discountCodes.size > 0
  );
}

function settledCart(state: CartState): CartData | null {
  if (hasPendingCartWork(state)) return null;
  return state.data.id ? state.data : null;
}

/**
 * Normalizes the app cart into the pinned analytics cart contract.
 *
 * Mirrors Hydrogen's unexported normalizer in
 * `@shopify/hydrogen/dist/core/analytics/cart-tracker.mjs` with two
 * intentional differences: a missing `updatedAt` returns null instead of a
 * fabricated timestamp, and lines missing product ID or vendor are dropped
 * instead of coerced to empty strings. Re-diff against the upstream source
 * on every Hydrogen preview bump, and delete this once Hydrogen exports it.
 */
function toAnalyticsCart(cart: CartData | null): AnalyticsCart | null {
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

/**
 * Publishes one product view per product, keyed by the Product GID. Variant
 * changes on the same product (same `product.id`) do not republish. Pair with
 * `key={product.id}` in the route so a product switch remounts this tracker
 * and setup re-runs; the identity guard below is the safety net for prop
 * updates that do not remount.
 */
export const ProductViewed = clientEntry(
  import.meta.url,
  function ProductViewed(handle: Handle<{ product: AnalyticsProduct }>) {
    let lastPublishedId: string | undefined;

    return () => {
      let productId = handle.props.product.id;
      if (productId === lastPublishedId) return null;
      lastPublishedId = productId;

      handle.queueTask((signal) => {
        if (signal.aborted) return;
        if (handle.props.product.id !== productId) return;
        let bus = getAnalytics();
        if (!bus) return;
        bus.publish(AnalyticsEvent.PRODUCT_VIEWED, {
          products: [handle.props.product],
        });
      });
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
    let lastPublishedId: string | undefined;

    return () => {
      let collection = handle.props.collection;
      if (collection.id === lastPublishedId) return null;
      lastPublishedId = collection.id;

      handle.queueTask((signal) => {
        if (signal.aborted) return;
        if (handle.props.collection.id !== collection.id) return;
        let bus = getAnalytics();
        if (!bus) return;
        bus.publish(AnalyticsEvent.COLLECTION_VIEWED, { collection });
      });
      return null;
    };
  },
);

/**
 * Computes a stable identity for a server-provided cart snapshot so the UI
 * can skip re-applying the same snapshot and defer newer ones until pending
 * cart work settles.
 */
export function cartInitialDataIdentity(initialData?: CartInitialData): string {
  if (initialData === undefined) return "omitted";
  return initialData.cart === null
    ? "null"
    : `${initialData.cart.id}\u0000${initialData.cart.updatedAt}`;
}

/**
 * Returns a function the cart UI calls on every render with the current
 * `initialData` prop. When the snapshot identity changes, the apply is
 * deferred to `handle.queueTask` so it lands only after pending cart work
 * settles and the latest prop is still the one we queued for. `onApplied`
 * runs after the store absorbs the snapshot (e.g. to publish a cart view).
 */
export function createSnapshotApplier(
  handle: Handle<{ initialData?: CartInitialData }>,
  store: CartStore | undefined,
  onApplied: () => void,
): (initialData?: CartInitialData) => void {
  let appliedIdentity = cartInitialDataIdentity(handle.props.initialData);
  let queuedIdentity: string | undefined;

  return (initialData?: CartInitialData) => {
    let nextIdentity = cartInitialDataIdentity(initialData);
    if (nextIdentity === appliedIdentity || nextIdentity === queuedIdentity) {
      return;
    }
    queuedIdentity = nextIdentity;
    handle.queueTask((signal) => {
      if (queuedIdentity === nextIdentity) queuedIdentity = undefined;
      if (
        signal.aborted ||
        cartInitialDataIdentity(handle.props.initialData) !== nextIdentity ||
        hasPendingCartWork(store)
      ) {
        return;
      }
      getBrowserCartStore(handle.props.initialData);
      appliedIdentity = nextIdentity;
      onApplied();
    });
  };
}
