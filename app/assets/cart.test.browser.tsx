import {
  AnalyticsEvent,
  type ShopifyGlobal,
  type StorefrontAnalytics,
} from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import type { Handle } from "remix/ui";
import { render } from "remix/ui/test";

import type { SerializedCartData } from "../data/cart.ts";
import {
  createCart,
  createCartInitialData,
  VARIANT_ID,
} from "../../test/cart-fixtures.ts";
import { trackConfirmedCartChanges } from "./public/analytics.tsx";
import {
  getBrowserCartStore,
  resetBrowserCartStore,
} from "./public/cart-store.ts";
import {
  CartPageContent,
  CartShell,
  configureOpenCartAction,
} from "./public/cart.tsx";
import { ProductAddToCart } from "./public/product-add-to-cart.tsx";

type CartUpdatePayload = {
  discountCodes?: string[];
  lines?: Array<{
    id?: string;
    merchandiseId?: string;
    quantity: number;
  }>;
  note?: string;
};

type CartEndpointResult = {
  cart: SerializedCartData | null;
  userErrors?: Array<{ code?: string; field?: string[]; message: string }>;
  warnings?: Array<{ code?: string; message: string; target?: string }>;
};

type UpdateCartOptions = {
  signal?: AbortSignal;
  event?: {
    context?: "product" | "cart" | "dialog" | "standard-action";
    detail?: Record<string, unknown>;
  };
};

type UpdateCartConfig = {
  eventTarget(meta: {
    type:
      | "shopify:cart:lines-update"
      | "shopify:cart:discount-update"
      | "shopify:cart:note-update"
      | "shopify:cart:error";
    action?: "add" | "remove" | "update";
  }): EventTarget | null;
  handler(
    defaultHandler: () => Promise<CartEndpointResult>,
    payload: CartUpdatePayload,
    options?: UpdateCartOptions,
  ): Promise<CartEndpointResult>;
};

type OpenCartConfig = {
  handler?(defaultHandler: () => Promise<void>): Promise<void>;
};

let updateCartConfig: UpdateCartConfig | undefined;
let openCartConfig: OpenCartConfig | undefined;

async function updateCart(
  payload: CartUpdatePayload,
  options?: UpdateCartOptions,
): Promise<CartEndpointResult> {
  if (!updateCartConfig) throw new Error("updateCart was not configured");

  let resultPromise = updateCartConfig.handler(
    async () => {
      throw new Error("The test Standard Action requires an app cart handler");
    },
    payload,
    options,
  );

  let line = payload.lines?.[0];
  if (line) {
    let action: "add" | "remove" | "update" = line.merchandiseId
      ? "add"
      : line.quantity === 0
        ? "remove"
        : "update";
    let eventPromise = resultPromise.then((result) => ({
      ...result,
      cart: result.cart ? toStandardCart(result.cart) : null,
    }));
    let event = new Event("shopify:cart:lines-update");
    Object.assign(event, {
      action,
      context: options?.event?.context ?? "standard-action",
      detail: options?.event?.detail,
      lines: payload.lines,
      promise: eventPromise,
    });
    updateCartConfig
      .eventTarget({ type: "shopify:cart:lines-update", action })
      ?.dispatchEvent(event);
  }

  return resultPromise;
}

Object.assign(updateCart, {
  configure(config: UpdateCartConfig) {
    updateCartConfig = config;
    return true;
  },
  isDefault() {
    return false;
  },
});

async function openCart(): Promise<void> {
  if (openCartConfig?.handler) return openCartConfig.handler(async () => {});
}

Object.assign(openCart, {
  configure(config: OpenCartConfig) {
    openCartConfig = config;
    return true;
  },
  isDefault() {
    return false;
  },
});

Object.defineProperty(window, "Shopify", {
  configurable: true,
  value: {
    actions: {
      getCart: async () => ({ cart: null }),
      openCart,
      updateCart,
    },
  } as unknown as ShopifyGlobal,
});

describe("cart interactions", () => {
  it("publishes a cart view for each actual drawer opening", async (t) => {
    useDesktopCartViewport(t);
    let events = useAnalyticsSpy(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(<CartShell initialData={initialData} />);
    t.after(cleanup);
    await flushAsync(act);

    let trigger = $('button[aria-controls="cart-drawer"]');
    let drawer = $("#cart-drawer");
    assert.ok(trigger instanceof HTMLButtonElement);
    assert.ok(drawer instanceof HTMLDialogElement);

    await act(() => trigger.click());
    await act(() => drawer.close());
    await act(() => trigger.click());

    assert.deepEqual(
      events.map(({ event }) => event),
      [AnalyticsEvent.CART_VIEWED, AnalyticsEvent.CART_VIEWED],
    );
    assert.equal(
      (events[0]?.payload.cart as { updatedAt?: string })?.updatedAt,
      initialData.cart?.updatedAt,
    );
  });

  it("publishes a full cart page view with its confirmed cart", async (t) => {
    let events = useAnalyticsSpy(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { act, cleanup } = render(
      <CartPageContent initialData={initialData} />,
    );
    t.after(cleanup);
    await flushAsync(act);

    assert.equal(events[0]?.event, AnalyticsEvent.CART_VIEWED);
    assert.equal(
      (events[0]?.payload.cart as { updatedAt?: string })?.updatedAt,
      initialData.cart?.updatedAt,
    );
  });

  it("publishes an empty full cart page view as a null cart", async (t) => {
    let events = useAnalyticsSpy(t);
    t.after(resetBrowserCartStore);

    let { act, cleanup } = render(
      <CartPageContent initialData={{ cart: null }} />,
    );
    t.after(cleanup);
    await flushAsync(act);

    assert.deepEqual(events, [
      {
        event: AnalyticsEvent.CART_VIEWED,
        payload: { cart: null, prevCart: null },
      },
    ]);
  });

  it("reconciles repeated cart page props and views each snapshot once", async (t) => {
    let events = useAnalyticsSpy(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let component = createTestComponent(CartPageContent);
    renderTestComponent(component, { initialData });

    renderTestComponent(component, { initialData });
    let newerCart = createCart(2);
    newerCart.updatedAt = "2026-01-01T00:00:01.000Z";
    renderTestComponent(component, { initialData: { cart: newerCart } });

    let differentCart = createCart(3);
    differentCart.id = "gid://shopify/Cart/different";
    renderTestComponent(component, { initialData: { cart: differentCart } });

    renderTestComponent(component, { initialData: { cart: null } });

    let store = getBrowserCartStore();
    assert.equal(store?.getState().data.id, null);
    assert.equal(store?.getState().loading, false);
    let cartViews = events
      .filter(({ event }) => event === AnalyticsEvent.CART_VIEWED)
      .map(({ payload }) => {
        let cart = payload.cart as { id?: string; updatedAt?: string } | null;
        return cart ? `${cart.id}:${cart.updatedAt}` : null;
      });
    assert.deepEqual(cartViews, [
      `${initialData.cart?.id}:${initialData.cart?.updatedAt}`,
      `${newerCart.id}:${newerCart.updatedAt}`,
      `${differentCart.id}:${differentCart.updatedAt}`,
      null,
    ]);
  });

  it("defers changing frame snapshots until optimistic work settles", async (t) => {
    let api = createCartApiMock(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let view = render(<CartPageContent initialData={initialData} />);
    t.after(view.cleanup);
    await flushAsync(view.act);

    let component = createTestComponent(CartPageContent);
    renderTestComponent(component, { initialData });
    let mutation = api.enqueue();
    let increase = view.$('button[aria-label="Increase quantity"]');
    assert.ok(increase instanceof HTMLButtonElement);
    await view.act(() => increase.click());
    await waitFor(() => api.requests.length === 1, view.act);

    let nullInitialData = { cart: null };
    renderTestComponent(component, { initialData: nullInitialData });
    assert.equal(getBrowserCartStore()?.getState().data.totalQuantity, 2);
    assert.notEqual(getBrowserCartStore()?.getState().data.id, null);

    mutation.resolve({ cart: createCart(2), userErrors: [], warnings: [] });
    await waitFor(
      () => getBrowserCartStore()?.getState().pending.lines.size === 0,
      view.act,
    );
    renderTestComponent(component, { initialData: nullInitialData });
    assert.equal(getBrowserCartStore()?.getState().data.id, null);
    assert.equal(getBrowserCartStore()?.getState().loading, false);
  });

  it("tracks a newer confirmed same-cart snapshot from frame data", (t) => {
    let events = useAnalyticsSpy(t);
    localStorage.removeItem("cartLastUpdatedAt");
    t.after(() => localStorage.removeItem("cartLastUpdatedAt"));
    t.after(resetBrowserCartStore);

    let initialCart = createCart();
    let store = getBrowserCartStore({ cart: initialCart });
    assert.ok(store);
    let stopTracking = trackConfirmedCartChanges(store);
    t.after(stopTracking);

    let updatedCart = createCart(2);
    updatedCart.updatedAt = "2026-01-01T00:00:01.000Z";
    assert.equal(getBrowserCartStore({ cart: updatedCart }), store);

    assert.deepEqual(
      events.map(({ event }) => event),
      [AnalyticsEvent.CART_UPDATED, AnalyticsEvent.PRODUCT_ADD_TO_CART],
    );
    assert.equal(store.getState().data.updatedAt, updatedCart.updatedAt);
    assert.equal(store.getState().data.totalQuantity, 2);
  });

  it("reveals the cart trigger label by width without fading it", (t) => {
    useDesktopCartViewport(t);
    t.after(resetBrowserCartStore);

    let { $, cleanup } = render(
      <CartShell initialData={createCartInitialData()} />,
    );
    t.after(cleanup);

    let trigger = $('button[aria-controls="cart-drawer"]');
    assert.ok(trigger instanceof HTMLButtonElement);
    let expandedLabel = trigger.querySelector("[data-expanded-label]");
    assert.ok(expandedLabel instanceof HTMLSpanElement);
    assert.equal(getComputedStyle(expandedLabel).opacity, "1");
    assert.equal(
      getComputedStyle(expandedLabel).transitionProperty,
      "max-width",
    );
  });

  it("uses server data without fetching and supports every dialog trigger", async (t) => {
    useDesktopCartViewport(t);
    let api = createCartApiMock(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <>
        <CartShell initialData={initialData} />
        <CartPageContent initialData={initialData} />
      </>,
    );
    t.after(cleanup);

    let mobileTrigger = $('a[href="/cart"]');
    let initialTrigger = $('button[aria-controls="cart-drawer"]');
    assert.ok(mobileTrigger instanceof HTMLAnchorElement);
    assert.equal(mobileTrigger.getAttribute("aria-haspopup"), null);
    assert.ok(initialTrigger instanceof HTMLButtonElement);
    assert.match(initialTrigger.textContent ?? "", /1Item in cart/);
    assert.equal(initialTrigger.getAttribute("aria-expanded"), "false");

    await flushAsync(act);
    assert.equal(api.requests.length, 0);

    let drawer = $("#cart-drawer");
    let trigger = $('button[aria-controls="cart-drawer"]');
    assert.ok(drawer instanceof HTMLDialogElement);
    assert.ok(trigger instanceof HTMLButtonElement);

    await act(() => trigger.click());
    assert.equal(drawer.open, true);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.equal(getComputedStyle(drawer).transitionDuration, "0s");
    assert.equal(getComputedStyle(drawer).animationName, "none");
    assert.match(drawer.textContent ?? "", /1 item\(s\) in cart/i);
    assert.match(drawer.textContent ?? "", /Subtotal\$10\.00/);
    assert.match(
      drawer.textContent ?? "",
      /Add \$65\.00 more for free shipping/,
    );
    assert.match(drawer.textContent ?? "", /Check out/);

    drawer.requestClose();
    assert.equal(drawer.open, false);
    await waitFor(() => trigger.getAttribute("aria-expanded") === "false", act);

    assert.equal(configureOpenCartAction(), true);
    await window.Shopify!.actions.openCart();
    assert.equal(drawer.open, true);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");

    let closeButton = drawer.querySelector('button[aria-label="Close cart"]');
    assert.ok(closeButton instanceof HTMLButtonElement);
    await act(() => closeButton.click());
    assert.equal(drawer.open, false);
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
  });

  it("closes after removing the final line without rendering an empty dialog", async (t) => {
    useDesktopCartViewport(t);
    let api = createCartApiMock(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(<CartShell initialData={initialData} />);
    t.after(cleanup);
    await flushAsync(act);

    let drawer = $("#cart-drawer");
    let trigger = $('button[aria-controls="cart-drawer"]');
    assert.ok(drawer instanceof HTMLDialogElement);
    assert.ok(trigger instanceof HTMLButtonElement);

    await act(() => trigger.click());
    let mutation = api.enqueue();
    let remove = drawer.querySelector('button[aria-label="Remove item"]');
    assert.ok(remove instanceof HTMLButtonElement);
    await act(() => remove.click());
    await waitFor(() => api.requests.length === 1, act);

    assert.equal(drawer.open, false);
    assert.doesNotMatch(drawer.textContent ?? "", /empty/i);
    assert.match(drawer.textContent ?? "", /Test Product/);
    assert.equal(api.requests[0]?.body.lines?.[0]?.quantity, 0);

    mutation.resolve({ cart: createCart(0), userErrors: [], warnings: [] });
    await flushAsync(act);
    assert.match($('a[href="/collections/all"]')?.textContent ?? "", /ShopAll/);
    assert.doesNotMatch(drawer.textContent ?? "", /empty/i);

    assert.equal(configureOpenCartAction(), true);
    await window.Shopify!.actions.openCart();
    assert.equal(drawer.open, false);
  });

  it("renders compare-at pricing and server-provided automatic discounts", (t) => {
    let cart = createCart();
    cart.lines.nodes[0]!.cost.compareAtAmountPerQuantity = {
      amount: "15",
      currencyCode: "USD",
    };
    cart.lines.nodes[0]!.discountAllocations = [
      {
        discountedAmount: { amount: "5", currencyCode: "USD" },
      },
    ];
    cart.cost.subtotalAmount.amount = "15";
    cart.cost.totalAmount.amount = "10";
    t.after(resetBrowserCartStore);

    let { container, cleanup } = render(
      <CartPageContent initialData={{ cart }} />,
    );
    t.after(cleanup);

    assert.equal(
      container.querySelector("[data-line-price] s")?.textContent,
      "$15.00 each",
    );
    assert.match(container.textContent, /Automatic discount-\$5\.00/);
    assert.match(container.textContent, /Total\$10\.00/);
    assert.match(container.textContent, /Taxes & shipping details at checkout/);
  });

  it("updates the cart without opening the dialog after add-to-cart succeeds", async (t) => {
    let api = createCartApiMock(t);
    let initialData = createCartInitialData(0);
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <>
        <CartShell initialData={initialData} />
        <ProductAddToCart
          available
          label="Add to cart"
          merchandiseId={VARIANT_ID}
        />
      </>,
    );
    t.after(cleanup);
    await flushAsync(act);

    let drawer = $("#cart-drawer");
    let add = $('button[type="submit"]');
    assert.ok(drawer instanceof HTMLDialogElement);
    assert.ok(add instanceof HTMLButtonElement);

    let mutation = api.enqueue();
    await act(() => add.click());
    await waitFor(() => api.requests.length === 1, act);
    assert.equal(drawer.open, false);
    assert.equal(add.textContent, "Adding…");
    assert.equal(api.requests[0]?.body.lines?.[0]?.merchandiseId, VARIANT_ID);

    mutation.resolve({ cart: createCart(), userErrors: [], warnings: [] });
    await waitFor(() => add.textContent === "Add to cart", act);
    assert.equal(drawer.open, false);
    assert.equal(add.textContent, "Add to cart");
    assert.match(
      $('button[aria-controls="cart-drawer"]')?.textContent ?? "",
      /1Item in cart/,
    );
  });

  it("keeps the dialog closed and reports rejected add-to-cart errors inline", async (t) => {
    let api = createCartApiMock(t);
    let initialData = createCartInitialData(0);
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <>
        <CartShell initialData={initialData} />
        <ProductAddToCart
          available
          label="Add to cart"
          merchandiseId={VARIANT_ID}
        />
      </>,
    );
    t.after(cleanup);
    await flushAsync(act);

    let drawer = $("#cart-drawer");
    let add = $('button[type="submit"]');
    assert.ok(drawer instanceof HTMLDialogElement);
    assert.ok(add instanceof HTMLButtonElement);

    let mutation = api.enqueue();
    await act(() => add.click());
    await waitFor(() => api.requests.length === 1, act);
    mutation.resolve({
      cart: null,
      userErrors: [{ message: "This variant is sold out." }],
      warnings: [],
    });
    await waitFor(() => add.textContent === "Add to cart", act);

    assert.equal(drawer.open, false);
    assert.match(
      add.closest("form")?.querySelector('[role="alert"]')?.textContent ?? "",
      /This variant is sold out\./,
    );
  });

  it("keeps rapid controls and checkout interactive while values are pending", async (t) => {
    let api = createCartApiMock(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <CartPageContent initialData={initialData} />,
    );
    t.after(cleanup);
    await flushAsync(act);

    let firstMutation = api.enqueue();
    let secondMutation = api.enqueue();
    let increase = $('button[aria-label="Increase quantity"]');
    let quantity = $('input[name="quantity"]');
    assert.ok(increase instanceof HTMLButtonElement);
    assert.ok(quantity instanceof HTMLInputElement);

    await act(() => increase.click());
    await waitFor(() => api.requests.length === 1, act);
    assert.equal(quantity.value, "2");
    assert.equal(getComputedStyle(quantity).transitionDuration, "0s");
    assert.equal(
      increase.closest("li")?.querySelector("[data-line-price] p")?.textContent,
      "$10.00",
    );
    assert.equal(increase.disabled, false);
    assert.equal(increase.closest("li")?.getAttribute("aria-busy"), "true");
    assert.equal(quantity.hasAttribute("data-pending"), true);
    let checkout = $('a[href="https://checkout.example.test/cart"]');
    assert.ok(checkout instanceof HTMLAnchorElement);
    assert.equal(checkout.getAttribute("aria-disabled"), null);
    assert.equal(checkout.textContent, "Updating cart…");
    assert.equal(checkout.querySelector("svg"), null);

    await act(() => increase.click());
    await waitFor(() => api.requests.length === 2, act);
    assert.equal(quantity.value, "3");
    assert.equal(firstMutation.aborted, true);

    let settledCart = createCart(3);
    settledCart.lines.nodes[0]!.cost.totalAmount.amount = "25";
    settledCart.cost.subtotalAmount.amount = "25";
    settledCart.cost.totalAmount.amount = "25";
    secondMutation.resolve({ cart: settledCart, userErrors: [], warnings: [] });
    await waitFor(
      () => increase.closest("li")?.hasAttribute("aria-busy") === false,
      act,
    );

    assert.equal(quantity.value, "3");
    assert.equal(
      increase.closest("li")?.querySelector("[data-line-price] p")?.textContent,
      "$25.00",
    );
    assert.equal(quantity.hasAttribute("data-pending"), false);
    assert.equal(checkout.textContent, "Check out");
    assert.ok(checkout.querySelector("svg") instanceof SVGElement);
  });

  it("rolls back a rejected quantity and renders its error beside the line", async (t) => {
    let api = createCartApiMock(t);
    let initialData = createCartInitialData();
    t.after(resetBrowserCartStore);

    let { $, act, cleanup } = render(
      <CartPageContent initialData={initialData} />,
    );
    t.after(cleanup);
    await flushAsync(act);

    let mutation = api.enqueue();
    let increase = $('button[aria-label="Increase quantity"]');
    let quantity = $('input[name="quantity"]');
    assert.ok(increase instanceof HTMLButtonElement);
    assert.ok(quantity instanceof HTMLInputElement);

    await act(() => increase.click());
    await waitFor(() => api.requests.length === 1, act);
    assert.equal(quantity.value, "2");

    mutation.resolve({
      cart: null,
      userErrors: [
        {
          code: "INVALID",
          field: ["lines", "0", "quantity"],
          message: "Only one item is available.",
        },
      ],
      warnings: [],
    });
    await waitFor(() => quantity.value === "1", act);

    assert.equal(quantity.getAttribute("aria-invalid"), "true");
    let errorId = quantity.getAttribute("aria-describedby");
    assert.ok(errorId);
    assert.match(
      document.getElementById(errorId)?.textContent ?? "",
      /Only one item is available\./,
    );
    assert.equal(
      document.getElementById(errorId)?.getAttribute("role"),
      "alert",
    );
  });
});

function createTestComponent<Props extends Record<string, unknown>>(
  type: (handle: Handle<Props>) => () => unknown,
) {
  let props = {} as Props;
  let tasks: Array<(signal: AbortSignal) => void> = [];
  let updateRequested = false;
  let handle = {
    props,
    signal: new AbortController().signal,
    update: async () => {
      updateRequested = true;
      return new AbortController().signal;
    },
    queueTask(task: (signal: AbortSignal) => void) {
      tasks.push(task);
    },
  } as Handle<Props>;
  let renderComponent: (() => unknown) | undefined;
  return {
    render(nextProps: Props) {
      Object.assign(props, nextProps);
      renderComponent ??= type(handle);
      renderComponent();
      do {
        updateRequested = false;
        let pendingTasks = tasks.splice(0);
        for (let task of pendingTasks) task(new AbortController().signal);
        if (updateRequested) renderComponent();
      } while (updateRequested || tasks.length > 0);
    },
  };
}

function renderTestComponent<Props extends Record<string, unknown>>(
  component: { render(props: Props): void },
  props: Props,
): void {
  component.render(props);
}

function useAnalyticsSpy(
  t: TestContext,
): Array<{ event: string; payload: Record<string, unknown> }> {
  let events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  let shopify = window.Shopify!;
  let analytics = {
    publish(event: string, payload: Record<string, unknown> = {}) {
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
          shopId: "gid://shopify/Shop/test",
          storefrontId: "0",
        },
        consent: { mode: "default-banner" as const },
      };
    },
  } as StorefrontAnalytics;
  shopify.analytics = analytics;
  t.after(() => {
    if (shopify.analytics === analytics) delete shopify.analytics;
  });
  return events;
}

function useDesktopCartViewport(t: TestContext): void {
  let matchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      let result = matchMedia.call(window, query);
      if (query !== "(max-width: 809px)") return result;
      return new Proxy(result, {
        get(target, property, receiver) {
          if (property === "matches") return false;
          return Reflect.get(target, property, receiver);
        },
      });
    },
  });
  t.after(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMedia,
    });
  });
}

type Act = ReturnType<typeof render>["act"];

type DeferredMutation = {
  readonly aborted: boolean;
  resolve(result: CartEndpointResult): void;
};

function createCartApiMock(t: TestContext) {
  let requests: Array<{ body: CartUpdatePayload; signal?: AbortSignal }> = [];
  let queued: Array<
    ReturnType<typeof createDeferred<CartEndpointResult>> & {
      signal?: AbortSignal;
    }
  > = [];

  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      let deferred = queued.shift();
      if (!deferred) throw new Error("Unexpected cart API request");

      let body = JSON.parse(String(init?.body)) as CartUpdatePayload;
      let signal = init?.signal ?? undefined;
      deferred.signal = signal;
      requests.push({ body, signal });

      let result = await withAbort(deferred.promise, signal);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  return {
    requests,
    enqueue(): DeferredMutation {
      let deferred: ReturnType<typeof createDeferred<CartEndpointResult>> & {
        signal?: AbortSignal;
      } = createDeferred<CartEndpointResult>();
      queued.push(deferred);
      return {
        get aborted() {
          return deferred.signal?.aborted ?? false;
        },
        resolve: deferred.resolve,
      };
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  let promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function toStandardCart(cart: SerializedCartData) {
  return { ...cart, lines: cart.lines.nodes };
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    let abort = () =>
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

async function flushAsync(act: Act) {
  for (let index = 0; index < 5; index++) {
    await Promise.resolve();
    await act(() => {});
  }
}

async function waitFor(predicate: () => boolean, act: Act) {
  let deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for cart interaction");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(() => {});
  }
}
