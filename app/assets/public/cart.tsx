import {
  type CartData,
  type CartErrorGroup,
  type CartErrorState,
  type CartState,
  type CartStore,
} from "@shopify/hydrogen";
import { clientEntry, css, navigate, on, type Handle } from "remix/component";

import {
  documentMarketPathPrefix,
  marketPath,
  US_MARKET,
  type ActiveMarket,
  type MarketPathPrefix,
} from "../../lib/public/market.ts";
import { BrandedState } from "./branded-state.tsx";
import {
  hasPendingCartWork,
  publishCartViewedWhenSettled,
} from "./analytics.tsx";
import { CartLine } from "./cart-line.tsx";
import { CartSummary } from "./cart-summary.tsx";
import { PageTitle } from "./page-title.tsx";
import { connectBrowserCartStore } from "./cart-store.ts";
import type { CartInitialData } from "../../data/public/cart.ts";
import { Icon } from "../../ui/public/icon.tsx";
import { visuallyHiddenStyle } from "../../ui/public/visually-hidden.ts";

const CART_DRAWER_ID = "cart-drawer";

let openCartActionConfigured = false;
let openCartActionRetryQueued = false;

// Browser entries cannot import the server-side route contract (app/routes.ts
// is outside the public asset boundary), so this mirrors the collection route
// declared there. Keep it in sync with app/routes.ts.
function collectionHref(
  handle: string,
  pathPrefix: MarketPathPrefix = "",
): string {
  return marketPath(`/collections/${encodeURIComponent(handle)}`, pathPrefix);
}
function openCartDrawer() {
  if (!globalThis.document) return;
  if (window.matchMedia("(max-width: 809px)").matches) {
    let prefix = documentMarketPathPrefix();
    navigate(marketPath("/cart", prefix));
    return;
  }
  let drawer = document.getElementById(CART_DRAWER_ID);
  if (drawer instanceof HTMLDialogElement && !drawer.open) {
    if (drawer.dataset.cartEmpty === "true") return;
    drawer.showModal();
    setCartTriggerExpanded(true);
    let prefix = documentMarketPathPrefix();
    publishCartViewedWhenSettled(connectBrowserCartStore(undefined, prefix));
  }
}

function closeCartDrawer() {
  if (!globalThis.document) return;
  let drawer = document.getElementById(CART_DRAWER_ID);
  if (drawer instanceof HTMLDialogElement) {
    drawer.close();
    setCartTriggerExpanded(false);
  }
}

function setCartTriggerExpanded(expanded: boolean) {
  document
    .querySelector(`button[aria-controls="${CART_DRAWER_ID}"]`)
    ?.setAttribute("aria-expanded", String(expanded));
}

/**
 * Wires `window.Shopify.actions.openCart` (the ShopifyScripts Standard Action)
 * to the app’s cart dialog. The browser entry calls this at startup. The
 * Standard Actions module is deferred at the end of the body and can finish
 * after the entry, so an early call retries once the document has parsed,
 * by which point every deferred module has run.
 *
 * The handler is page-lifetime configuration, so it delegates to the stable
 * DOM helper instead of closing over component state.
 */
export function configureOpenCartAction(): boolean {
  if (openCartActionConfigured) return true;
  if (!globalThis.document) return false;

  let openCart = window.Shopify?.actions?.openCart;
  if (openCart) {
    openCartActionConfigured = openCart.configure({
      handler: async () => openCartDrawer(),
    });
    return openCartActionConfigured;
  }

  if (!openCartActionRetryQueued && document.readyState === "loading") {
    openCartActionRetryQueued = true;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        openCartActionRetryQueued = false;
        configureOpenCartAction();
      },
      { once: true },
    );
  }
  return false;
}

export const CartShell = clientEntry(
  import.meta.url,
  function CartShell(
    handle: Handle<{
      automaticDiscountLabel?: string;
      initialData?: CartInitialData;
      market?: ActiveMarket;
    }>,
  ) {
    let market = handle.props.market ?? US_MARKET;
    let store = connectBrowserCartStore(
      handle.props.initialData,
      market.pathPrefix,
    );
    let state: CartState | undefined;
    let drawerState: CartState | undefined;
    let cartHadItems = false;
    // Frame responses skip the cart query, so the server renders the loading
    // state. A shell hydrated from one renders that state first to match the
    // server HTML, then switches to the live store.
    let matchServerHtml = handle.props.initialData === undefined;
    if (matchServerHtml) {
      handle.queueTask((signal) => {
        if (signal.aborted) return;
        matchServerHtml = false;
        handle.update();
      });
    }

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        let cartHasItems = nextState.data.lines.nodes.length > 0;
        let removedFinalLine = cartHadItems && !cartHasItems;
        cartHadItems = cartHasItems;
        state = nextState;
        if (cartHasItems) drawerState = nextState;
        if (removedFinalLine) closeCartDrawer();
        handle.update();
      });
      handle.signal.addEventListener("abort", unsubscribe, { once: true });
      // Subscribe before reading so no connected-store update can be missed.
      state = store.getState();
      drawerState = state;
      cartHadItems = state.data.lines.nodes.length > 0;
    }

    return () => {
      market = handle.props.market ?? US_MARKET;

      let viewState = resolveCartViewState(
        matchServerHtml ? undefined : state,
        handle.props.initialData,
      );
      let drawerViewState = resolveCartViewState(
        matchServerHtml ? undefined : drawerState,
        handle.props.initialData,
      );
      let cartIsEmpty =
        !viewState.loading && !viewState.cart?.lines.nodes.length;

      return (
        <>
          <CartTrigger viewState={viewState} pathPrefix={market.pathPrefix} />
          <dialog
            id={CART_DRAWER_ID}
            aria-labelledby="cart-drawer-title"
            closedby="any"
            data-cart-empty={cartIsEmpty ? "true" : undefined}
            mix={[
              drawerStyle,
              on("toggle", (event) => {
                if (event.currentTarget instanceof HTMLDialogElement) {
                  setCartTriggerExpanded(event.currentTarget.open);
                }
              }),
            ]}
          >
            <header mix={drawerHeaderStyle}>
              <h2 id="cart-drawer-title">{cartDialogTitle(drawerViewState)}</h2>
              <button
                type="button"
                aria-label="Close cart"
                mix={on("click", closeCartDrawer)}
              >
                <Icon name="x" />
              </button>
            </header>
            <div mix={drawerBodyStyle}>
              <CartView
                {...drawerViewState}
                automaticDiscountLabel={handle.props.automaticDiscountLabel}
                drawer
                market={market}
                store={store}
              />
            </div>
          </dialog>
        </>
      );
    };
  },
);

export const CartPageContent = clientEntry(
  import.meta.url,
  function CartPageContent(
    handle: Handle<{
      automaticDiscountLabel?: string;
      initialData: CartInitialData;
      market?: ActiveMarket;
    }>,
  ) {
    let market = handle.props.market ?? US_MARKET;
    let store = connectBrowserCartStore(
      handle.props.initialData,
      market.pathPrefix,
    );
    let state: CartState | undefined;

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        state = nextState;
        handle.update();
      });
      handle.signal.addEventListener("abort", unsubscribe, { once: true });
      // Subscribe before reading so no connected-store update can be missed.
      state = store.getState();
      handle.queueTask((signal) => {
        if (!signal.aborted) publishCartViewedWhenSettled(store);
      });
    }

    return () => {
      market = handle.props.market ?? US_MARKET;

      return (
        <CartView
          {...resolveCartViewState(state, handle.props.initialData)}
          automaticDiscountLabel={handle.props.automaticDiscountLabel}
          market={market}
          store={store}
        />
      );
    };
  },
);

function CartTrigger(
  handle: Handle<{
    pathPrefix: MarketPathPrefix;
    viewState: CartViewState;
  }>,
) {
  return () => {
    let { cart, loading } = handle.props.viewState;
    let quantity = cart?.totalQuantity ?? 0;

    if (loading || !cart || quantity === 0) {
      return (
        <a
          href={collectionHref("all", handle.props.pathPrefix)}
          data-rmx-prefetch="intent"
          mix={[triggerBaseStyle, shopTriggerStyle]}
        >
          <CartIcon />
          <span>Shop</span>
          <span aria-hidden="true" data-expanded-label="true">
            All
          </span>
        </a>
      );
    }

    let label = (
      <>
        <CartIcon />
        <span>{quantity}</span>
        <span data-expanded-label="true">
          Item{quantity === 1 ? "" : "s"}
          <span mix={visuallyHiddenStyle}> in cart</span>
        </span>
      </>
    );

    return (
      <>
        <a
          href={marketPath("/cart", handle.props.pathPrefix)}
          mix={[triggerBaseStyle, cartTriggerStyle, mobileCartTriggerStyle]}
        >
          {label}
        </a>
        <button
          type="button"
          aria-controls={CART_DRAWER_ID}
          aria-expanded="false"
          aria-haspopup="dialog"
          mix={[
            triggerBaseStyle,
            cartTriggerStyle,
            desktopCartTriggerStyle,
            on("click", openCartDrawer),
          ]}
        >
          {label}
        </button>
      </>
    );
  };
}

function CartIcon() {
  return () => <Icon name="cart" />;
}

function cartDialogTitle(viewState: CartViewState): string {
  let quantity = viewState.cart?.totalQuantity;
  if (!quantity) return viewState.loading ? "Loading cart" : "Your cart";
  return cartCountLabel(quantity);
}

function cartCountLabel(quantity: number): string {
  return `${quantity} item(s) in cart`;
}

type CartViewState = {
  cart: CartData | null;
  errors?: CartErrorState;
  loading: boolean;
  state?: CartState;
};

type CartViewProps = CartViewState & {
  automaticDiscountLabel?: string;
  drawer?: boolean;
  market: ActiveMarket;
  store?: CartStore;
};

function resolveCartViewState(
  state?: CartState,
  initialData?: CartInitialData,
): CartViewState {
  if (state && (!state.loading || initialData === undefined)) {
    return {
      cart: state.data.id === null ? null : state.data,
      errors: state.errors,
      loading: state.loading,
      state,
    };
  }

  if (initialData !== undefined) {
    return {
      cart: initialData.cart,
      loading: false,
      state,
    };
  }

  // No store yet and no server data: the cart is still loading.
  return { cart: null, loading: true };
}

function CartView(handle: Handle<CartViewProps>) {
  let dismissedAt = 0;

  return () => {
    let {
      cart,
      drawer = false,
      errors,
      loading,
      market,
      state,
      store,
    } = handle.props;
    let lines = cart?.lines.nodes ?? [];
    let bannerMessages = getBannerMessages(
      errors,
      lines.map((line) => line.id),
    );
    let banner =
      errors &&
      bannerMessages.length > 0 &&
      errors.lastUpdatedAt > dismissedAt ? (
        <CartErrorBanner
          messages={bannerMessages}
          onDismiss={() => {
            dismissedAt = errors.lastUpdatedAt;
            handle.update();
          }}
        />
      ) : null;

    if (loading) {
      return (
        <section
          aria-busy="true"
          aria-label="Loading cart"
          mix={drawerLoadingStyle}
        >
          <p>Loading cart…</p>
        </section>
      );
    }

    if (!cart || lines.length === 0) {
      if (drawer) return null;

      return (
        <section>
          {banner}
          <BrandedState
            kind="empty"
            heading="No items in cart"
            copy="Please browse our catalog and add items before checking out."
            href={collectionHref("all", market.pathPrefix)}
            linkLabel="Shop All"
            icon="cart"
          />
        </section>
      );
    }

    return (
      <section
        mix={[
          drawer ? drawerContentStyle : pageCartContentStyle,
          on("submit", (event) => {
            event.preventDefault();
            if (store) submitCartForm(store, event);
          }),
        ]}
      >
        {!drawer ? (
          <CartPageHeading totalQuantity={cart.totalQuantity} />
        ) : null}
        {banner}

        <ul
          mix={[
            lineListStyle,
            drawer ? drawerLineListStyle : pageLineListStyle,
          ]}
        >
          {lines.map((line) => (
            <CartLine
              key={line.id}
              drawer={drawer}
              line={line}
              market={market}
              messages={
                errors ? getErrorGroupMessages(errors.lines.get(line.id)) : []
              }
              onLinkClick={drawer ? closeCartDrawer : undefined}
              pending={state?.pending.lines.has(line.id) ?? false}
            />
          ))}
        </ul>

        <CartSummary
          automaticDiscountLabel={
            handle.props.automaticDiscountLabel?.trim() || "Automatic discount"
          }
          cart={cart}
          drawer={drawer}
          market={market}
          pending={state ? hasPendingCartWork(state) : false}
        />
      </section>
    );
  };
}

// Failed updates surface in the cart error state; the log keeps the cause.
function submitCartForm(store: CartStore, event: SubmitEvent): void {
  void store.handleFormSubmit(event).catch((error) => {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("[hydrogen] cart update failed", error);
    }
  });
}

function CartPageHeading(handle: Handle<{ totalQuantity: number }>) {
  return () => (
    <>
      <div mix={pageTitleStyle}>
        <PageTitle title="Cart" />
      </div>
      <div aria-hidden="true" mix={mobileCartSpacerStyle} />
      <h1 mix={[visuallyHiddenStyle, mobileCartTitleStyle]}>Cart</h1>
      <h2 mix={cartCountStyle}>{cartCountLabel(handle.props.totalQuantity)}</h2>
    </>
  );
}

function CartErrorBanner(
  handle: Handle<{ messages: string[]; onDismiss: () => void }>,
) {
  return () => (
    <div role="alert" mix={errorBannerStyle}>
      <div>
        {handle.props.messages.map((message, index) => (
          <p key={`${message}-${index}`}>{message}</p>
        ))}
      </div>
      <button type="button" mix={on("click", handle.props.onDismiss)}>
        Dismiss
      </button>
    </div>
  );
}

function getErrorGroupMessages(group?: CartErrorGroup): string[] {
  if (!group) return [];
  return [
    ...group.userErrors.map((error) => error.message),
    ...group.warnings.map((warning) => warning.message),
  ];
}

function getBannerMessages(
  errors: CartErrorState | undefined,
  visibleLineIds: string[],
): string[] {
  if (!errors) return [];
  let lineIds = new Set(visibleLineIds);
  let messages = [
    ...errors.network.map((error) => error.message),
    ...getErrorGroupMessages(errors.cart),
    ...getErrorGroupMessages(errors.note),
  ];

  for (let [lineId, group] of errors.lines) {
    if (!lineIds.has(lineId)) messages.push(...getErrorGroupMessages(group));
  }
  for (let group of errors.discountCodes.values()) {
    messages.push(...getErrorGroupMessages(group));
  }

  return Array.from(new Set(messages));
}

const triggerBaseStyle = css({
  alignItems: "center",
  borderRadius: "54px",
  display: "flex",
  fontSize: ".875rem",
  fontWeight: 600,
  gap: "6px",
  height: "40px",
  justifyContent: "center",
  padding: "8px 12px",
  textAlign: "center",
  textDecoration: "none",
  whiteSpace: "nowrap",
  "& svg": { fill: "currentColor", height: "20px", width: "20px" },
  "& [data-expanded-label]": {
    maxWidth: 0,
    overflow: "hidden",
    transition: "max-width 300ms ease-in-out",
  },
  "&:focus-visible [data-expanded-label], &[aria-expanded='true'] [data-expanded-label]":
    {
      maxWidth: "10ch",
    },
  "@media (hover: hover)": {
    "&:hover [data-expanded-label]": { maxWidth: "10ch" },
  },
  "@media (min-width: 810px)": {
    fontSize: "1.25rem",
    gap: "10px",
    height: "64px",
    padding: "16px 20px 16px 24px",
    "& svg": { height: "32px", width: "32px" },
  },
});

const shopTriggerStyle = css({
  background: "var(--color-white)",
  color: "var(--color-black)",
  "&:hover": { color: "var(--color-black)" },
  "@media (max-width: 809px)": {
    "& [data-expanded-label]": { display: "none" },
  },
});

const cartTriggerStyle = css({
  background: "var(--color-blue-brand)",
  border: 0,
  color: "var(--color-white)",
  "&:hover": { color: "var(--color-white)" },
});

const mobileCartTriggerStyle = css({
  "@media (min-width: 810px)": { display: "none" },
});

const desktopCartTriggerStyle = css({
  cursor: "pointer",
  display: "none",
  "@media (min-width: 810px)": { display: "flex" },
});

const drawerStyle = css({
  background: "var(--color-blue-brand)",
  border: 0,
  borderRadius: "32px 32px 42px 42px",
  boxShadow: "0 20px 60px rgba(0,0,0,.28)",
  color: "var(--color-white)",
  inset: "calc(108px + var(--store-wide-sale-height)) 36px auto auto",
  margin: 0,
  maxHeight: "calc(100dvh - 124px - var(--store-wide-sale-height))",
  overflow: "hidden",
  padding: 0,
  position: "fixed",
  width: "380px",
  "&[open]": {
    display: "flex",
    flexDirection: "column",
  },
  "&::backdrop": { background: "transparent" },
});
const drawerHeaderStyle = css({
  alignItems: "center",
  display: "flex",
  height: "64px",
  justifyContent: "space-between",
  padding: "12px 20px",
  "& h2": {
    fontFamily: "var(--font-title)",
    fontSize: "1rem",
    fontWeight: 900,
    lineHeight: 1.4,
    margin: 0,
    textTransform: "uppercase",
  },
  "& button": {
    background: "transparent",
    border: 0,
    alignItems: "center",
    borderRadius: "999px",
    color: "white",
    display: "flex",
    height: "40px",
    justifyContent: "center",
    padding: "4px",
    width: "40px",
  },
  "@media (hover: hover)": {
    "& button:hover": { background: "rgba(255,255,255,.2)" },
  },
  "& svg": { height: "32px", width: "32px" },
});
const drawerBodyStyle = css({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
  "& > section": { flex: "1 1 auto", minHeight: 0 },
});
const drawerLoadingStyle = css({ padding: "20px" });
const drawerContentStyle = css({
  display: "flex",
  flexDirection: "column",
  maxHeight: "100%",
});
const pageCartContentStyle = css({
  display: "flex",
  flexDirection: "column",
  margin: "0 auto",
  maxWidth: "800px",
  padding: "0 16px",
  width: "100%",
  "@media (min-width: 810px)": { paddingLeft: "36px", paddingRight: "36px" },
});
const pageTitleStyle = css({
  display: "none",
  marginLeft: "calc(50% - 50vw)",
  width: "100vw",
  "@media (min-width: 810px)": { display: "block" },
});
const mobileCartSpacerStyle = css({
  height: "calc(112px + var(--store-wide-sale-height))",
  "@media (min-width: 810px)": { display: "none" },
});
const mobileCartTitleStyle = css({
  "@media (min-width: 810px)": { display: "none" },
});
const cartCountStyle = css({
  fontFamily: "var(--font-title)",
  fontSize: "1rem",
  fontWeight: 900,
  letterSpacing: "-.05em",
  lineHeight: 1.4,
  margin: "0 0 48px",
  textTransform: "uppercase",
  "@media (min-width: 810px)": { fontSize: "1.25rem" },
});
const lineListStyle = css({ listStyle: "none", margin: 0, padding: 0 });
const pageLineListStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "36px",
});
const drawerLineListStyle = css({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "16px",
  maxHeight: "60vh",
  minHeight: 0,
  overflowY: "auto",
  padding: "16px 20px",
  scrollbarColor: "rgba(255,255,255,.8) transparent",
  scrollbarWidth: "thin",
  "&::-webkit-scrollbar": { width: "8px" },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255,255,255,.8)",
    border: "2px solid var(--color-blue-brand)",
    borderRadius: "999px",
  },
  "&::-webkit-scrollbar-thumb:hover": { background: "var(--color-white)" },
});
const errorBannerStyle = css({
  alignItems: "start",
  background: "var(--color-red-50)",
  border: "1px solid var(--color-red-800)",
  display: "flex",
  gap: "16px",
  justifyContent: "space-between",
  marginBottom: "16px",
  padding: "12px",
  "& p": { margin: "0 0 4px" },
});
