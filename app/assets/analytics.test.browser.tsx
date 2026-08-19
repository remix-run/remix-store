import {
  AnalyticsEvent,
  type AnalyticsEventName,
  type CartData,
  type CartState,
  type CartStore,
  type EventPayloads,
  type StorefrontAnalytics,
} from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";

import {
  CollectionViewed,
  ProductViewed,
  createPageViewPublisher,
  publishCartViewed,
  publishCartViewedWhenSettled,
} from "./public/analytics.tsx";
import { createCart } from "../../test/cart-fixtures.ts";
import {
  createTestComponent,
  renderTestComponent,
} from "../../test/component-fixtures.ts";

interface PublishedEvent {
  event: AnalyticsEventName;
  payload: EventPayloads;
}

describe("storefront analytics", () => {
  it("publishes page views once per completed URL", (t) => {
    let events = installAnalytics(t);
    let url = "https://storefront.example/";
    let publishPageViewed = createPageViewPublisher(() => url);

    publishPageViewed();
    publishPageViewed();
    url = "https://storefront.example/collections/all";
    publishPageViewed();

    assert.deepEqual(events, [
      {
        event: AnalyticsEvent.PAGE_VIEWED,
        payload: { url: "https://storefront.example/" },
      },
      {
        event: AnalyticsEvent.PAGE_VIEWED,
        payload: { url },
      },
    ]);
  });

  it("publishes product views once per product id", (t) => {
    let events = installAnalytics(t);
    let product = analyticsProduct("1", "1");
    let component = createTestComponent(ProductViewed);

    renderTestComponent(component, { product });
    renderTestComponent(component, {
      product: { ...product, title: "Renamed" },
    });
    let nextVariant = analyticsProduct("1", "2");
    renderTestComponent(component, { product: nextVariant });
    let nextProduct = analyticsProduct("2", "3");
    renderTestComponent(component, { product: nextProduct });

    assert.deepEqual(events, [
      {
        event: AnalyticsEvent.PRODUCT_VIEWED,
        payload: { products: [product] },
      },
      {
        event: AnalyticsEvent.PRODUCT_VIEWED,
        payload: { products: [nextProduct] },
      },
    ]);
  });

  it("publishes collection views once per collection identity", (t) => {
    let events = installAnalytics(t);
    let collection = analyticsCollection("1", "all");
    let component = createTestComponent(CollectionViewed);

    renderTestComponent(component, { collection });
    renderTestComponent(component, {
      collection: { ...collection, handle: "featured" },
    });
    let nextCollection = analyticsCollection("2", "featured");
    renderTestComponent(component, { collection: nextCollection });

    assert.deepEqual(events, [
      {
        event: AnalyticsEvent.COLLECTION_VIEWED,
        payload: { collection },
      },
      {
        event: AnalyticsEvent.COLLECTION_VIEWED,
        payload: { collection: nextCollection },
      },
    ]);
  });

  it("publishes a cart view from confirmed store state", (t) => {
    let events = installAnalytics(t);
    let cart = createCart();
    let store = testCartStore(() => cartState(cart));

    publishCartViewed(store);

    assert.equal(events[0]?.event, AnalyticsEvent.CART_VIEWED);
    let payload = events[0]?.payload;
    assert.ok(payload && "cart" in payload);
    assert.equal(payload.cart?.updatedAt, cart.updatedAt);
  });

  it("defers a cart view until pending cart work settles", (t) => {
    let events = installAnalytics(t);
    let currentCart = createCart();
    let currentState = pendingCartState(currentCart);
    let listener: ((state: CartState) => void) | undefined;
    let store = testCartStore(
      () => currentState,
      (next: (state: CartState) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    );

    publishCartViewedWhenSettled(store);
    assert.equal(events.length, 0);
    assert.notEqual(listener, undefined);

    currentCart = createCart(2);
    currentCart.updatedAt = "2026-01-01T00:00:01.000Z";
    currentState = pendingCartState(currentCart);
    listener?.(currentState);
    assert.equal(events.length, 0);

    currentState = { ...cartState(currentCart), revalidating: true };
    listener?.(currentState);
    assert.equal(events.length, 0);

    currentState = cartState(currentCart);
    listener?.(currentState);

    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, AnalyticsEvent.CART_VIEWED);
    let payload = events[0]?.payload;
    assert.ok(payload && "cart" in payload);
    assert.equal(payload.cart?.updatedAt, currentCart.updatedAt);
    assert.equal(listener, undefined);
  });

  it("keeps only the latest deferred cart view", (t) => {
    let events = installAnalytics(t);
    let currentState = pendingCartState(createCart());
    let listeners = new Set<(state: CartState) => void>();
    let store = testCartStore(
      () => currentState,
      (next: (state: CartState) => void) => {
        listeners.add(next);
        return () => listeners.delete(next);
      },
    );

    publishCartViewedWhenSettled(store);
    publishCartViewedWhenSettled(store);
    assert.equal(listeners.size, 1);

    currentState = cartState(createCart());
    for (let listener of listeners) listener(currentState);

    assert.deepEqual(
      events.map(({ event }) => event),
      [AnalyticsEvent.CART_VIEWED],
    );
  });
});

function analyticsProduct(productId: string, variantId: string) {
  return {
    id: `gid://shopify/Product/${productId}`,
    title: `Test product ${productId}`,
    price: "20.00",
    vendor: "Test vendor",
    variantId: `gid://shopify/ProductVariant/${variantId}`,
    variantTitle: `Variant ${variantId}`,
    quantity: 1,
    sku: `SKU-${variantId}`,
  };
}

function analyticsCollection(id: string, handle: string) {
  return { id: `gid://shopify/Collection/${id}`, handle };
}

function pendingCartState(cart: CartData): CartState {
  let state = cartState(cart);
  return {
    ...state,
    pending: {
      ...state.pending,
      lines: new Set([cart.lines.nodes[0]?.id ?? "pending-line"]),
    },
  };
}

function cartState(cart: CartData): CartState {
  return {
    data: cart,
    loading: false,
    pending: {
      lines: new Set(),
      note: false,
      attributes: false,
      discountCodes: new Set(),
    },
    errors: {
      cart: { userErrors: [], warnings: [] },
      lines: new Map(),
      note: { userErrors: [], warnings: [] },
      attributes: new Map(),
      discountCodes: new Map(),
      network: [],
      lastUpdatedAt: 0,
      cartUpdatedAt: 0,
      linesUpdatedAt: 0,
      noteUpdatedAt: 0,
      attributesUpdatedAt: 0,
      discountCodesUpdatedAt: 0,
      networkUpdatedAt: 0,
    },
  };
}

function testCartStore(
  getState: () => CartState,
  subscribe: CartStore["subscribe"] = () => () => {},
): CartStore {
  return {
    connect() {},
    destroy() {},
    hydrate() {},
    getState,
    subscribe,
    fetch: () => Promise.resolve(),
    reset() {},
    handleFormSubmit: () => Promise.resolve(),
  };
}

function installAnalytics(t: TestContext): PublishedEvent[] {
  let events: PublishedEvent[] = [];
  let originalShopify = window.Shopify;
  let analytics: StorefrontAnalytics = {
    publish(event, ...[payload = {}]) {
      events.push({ event, payload });
    },
    subscribe() {
      return () => {};
    },
    addDestination() {
      return () => {};
    },
    destroy() {},
    getConfig() {
      return {
        shop: {
          channel: "hydrogen" as const,
          shopId: "gid://shopify/Shop/1",
          storefrontId: "1",
        },
        consent: { mode: "default-banner" as const },
      };
    },
  };

  Object.defineProperty(window, "Shopify", {
    configurable: true,
    value: { ...originalShopify, analytics },
  });
  t.after(() => {
    Object.defineProperty(window, "Shopify", {
      configurable: true,
      value: originalShopify,
    });
  });
  return events;
}
