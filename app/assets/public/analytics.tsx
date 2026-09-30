import {
  AnalyticsEvent,
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
  if (!globalThis.window) return null;
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
  let pendingCost =
    state.pending.cost ??
    (state.pending.lines.size > 0 || state.pending.discountCodes.size > 0);
  return (
    state.revalidating === true ||
    pendingCost ||
    state.pending.note ||
    state.pending.attributes
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
type AnalyticsCartContract = {
  id: string;
  updatedAt?: string;
  cost: CartData["cost"];
  lines: {
    nodes: Array<{
      id: string;
      quantity: number;
      cost: CartData["lines"]["nodes"][number]["cost"];
      merchandise?: {
        id: string;
        title?: string;
        sku?: string | null;
        product: {
          id: string;
          title: string;
          vendor: string;
          productType?: string | null;
          handle?: string;
        };
      };
    }>;
  };
};

function toAnalyticsCart(cart: CartData | null): AnalyticsCart | null {
  if (!cart?.id) return null;
  // SAFETY: The app cart fragment selects `updatedAt`, and Hydrogen's standard
  // cart fragment selects the product analytics fields modeled above.
  let analyticsCart = cart as AnalyticsCartContract;
  if (!analyticsCart.updatedAt) return null;

  return {
    id: analyticsCart.id,
    updatedAt: analyticsCart.updatedAt,
    cost: cart.cost,
    lines: {
      nodes: analyticsCart.lines.nodes.flatMap((line) => {
        let merchandise = line.merchandise;
        if (!merchandise) return [];
        let productId = merchandise.product.id;
        let vendor = merchandise.product.vendor;

        return [
          {
            id: line.id,
            quantity: line.quantity,
            merchandise: {
              id: merchandise.id,
              title: merchandise.title ?? merchandise.product.title,
              price: line.cost.amountPerQuantity,
              sku: merchandise.sku ?? null,
              product: {
                id: productId,
                title: merchandise.product.title,
                vendor,
                productType: merchandise.product.productType ?? undefined,
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
