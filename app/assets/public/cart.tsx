import {
  createCartFormRegister,
  formatMoney,
  type CartData,
  type CartErrorGroup,
  type CartErrorState,
  type CartState,
  type CartStore,
  type MoneyV2,
} from "@shopify/hydrogen";
import { clientEntry, css, on, type Handle } from "remix/ui";

import {
  marketPath,
  US_MARKET,
  type ActiveMarket,
  type MarketLocale,
  type MarketPathPrefix,
} from "../../lib/public/market.ts";
import { BrandedState } from "../../ui/public/branded-state.tsx";
import { shopifyImageUrl } from "../../ui/public/shopify-image.tsx";
import {
  createSnapshotApplier,
  hasPendingCartWork,
  publishCartViewedWhenSettled,
} from "./analytics.tsx";
import { PageTitle } from "./page-title.tsx";
import {
  getBrowserCartStore,
  getCartApiPath,
  type CartInitialData,
} from "./cart-store.ts";

const CART_DRAWER_ID = "cart-drawer";
const STANDARD_ACTIONS_READY_EVENT = "DOMContentLoaded";
const register = createCartFormRegister();

let openCartActionConfigured = false;
let openCartActionRetryQueued = false;

// Browser entries cannot import the server-side route contract (app/routes.ts
// is outside the public asset boundary), so these mirror the route paths
// declared there. Keep them in sync with app/routes.ts.
function collectionHref(
  handle: string,
  pathPrefix: MarketPathPrefix = "",
): string {
  return marketPath(`/collections/${encodeURIComponent(handle)}`, pathPrefix);
}
function productHref(
  handle: string,
  pathPrefix: MarketPathPrefix = "",
): string {
  return marketPath(`/products/${encodeURIComponent(handle)}`, pathPrefix);
}

function openCartDrawer() {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(max-width: 809px)").matches) {
    let prefix = (document.documentElement.dataset.marketPrefix ||
      "") as MarketPathPrefix;
    window.location.assign(marketPath("/cart", prefix));
    return;
  }
  let drawer = document.getElementById(CART_DRAWER_ID);
  if (drawer instanceof HTMLDialogElement && !drawer.open) {
    if (drawer.dataset.cartEmpty === "true") return;
    drawer.showModal();
    setCartTriggerExpanded(true);
    let prefix = (document.documentElement.dataset.marketPrefix ||
      "") as MarketPathPrefix;
    publishCartViewedWhenSettled(getBrowserCartStore(undefined, prefix));
  }
}

function closeCartDrawer() {
  if (typeof document === "undefined") return;
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
 * to the app’s cart dialog. The handler is page-lifetime configuration, so it
 * delegates to the stable DOM helper instead of closing over component state.
 */
export function configureOpenCartAction(): boolean {
  if (typeof document === "undefined") return false;
  if (openCartActionConfigured) return true;

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
      STANDARD_ACTIONS_READY_EVENT,
      () => {
        openCartActionRetryQueued = false;
        configureOpenCartAction();
      },
      { once: true },
    );
  }

  return false;
}

configureOpenCartAction();

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
    let appliedMarketPathPrefix = market.pathPrefix;
    let store = getBrowserCartStore(
      handle.props.initialData,
      market.pathPrefix,
    );
    let state = store?.getState();
    let drawerState = state;
    let cartHadItems = Boolean(state?.data.lines.nodes.length);
    let hydrated = false;

    let applySnapshot = createSnapshotApplier(
      handle,
      store,
      () => {
        state = store?.getState();
        drawerState = state;
      },
      () => market.pathPrefix,
    );

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        let cartHasItems = nextState.data.lines.nodes.length > 0;
        let removedFinalLine = cartHadItems && !cartHasItems;
        cartHadItems = cartHasItems;
        state = nextState;
        if (cartHasItems) drawerState = nextState;
        if (hydrated) {
          if (removedFinalLine) closeCartDrawer();
          handle.update();
        }
      });
      handle.signal.addEventListener("abort", unsubscribe, { once: true });
      handle.queueTask((signal) => {
        if (signal.aborted) return;
        hydrated = true;
        state = store.getState();
        drawerState = state;
        handle.update();
      });
    }

    return () => {
      market = handle.props.market ?? US_MARKET;
      if (market.pathPrefix !== appliedMarketPathPrefix) {
        appliedMarketPathPrefix = market.pathPrefix;
        getBrowserCartStore(handle.props.initialData, market.pathPrefix);
      }
      applySnapshot(handle.props.initialData);

      let snapshot = getCartSnapshot(
        hydrated ? state : undefined,
        handle.props.initialData,
      );
      let drawerSnapshot = getCartSnapshot(
        hydrated ? drawerState : undefined,
        handle.props.initialData,
      );
      let cartIsEmpty = !snapshot.loading && !snapshot.cart?.lines.nodes.length;

      return (
        <>
          <CartTrigger snapshot={snapshot} pathPrefix={market.pathPrefix} />
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
              <h2 id="cart-drawer-title">{cartDialogTitle(drawerSnapshot)}</h2>
              <button
                type="button"
                aria-label="Close cart"
                mix={on("click", closeCartDrawer)}
              >
                <SpriteIcon name="x" />
              </button>
            </header>
            <div mix={drawerBodyStyle}>
              <CartView
                {...drawerSnapshot}
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
    let appliedMarketPathPrefix = market.pathPrefix;
    let store = getBrowserCartStore(
      handle.props.initialData,
      market.pathPrefix,
    );
    let state = store?.getState();
    let hydrated = false;

    let applySnapshot = createSnapshotApplier(
      handle as Handle<{ initialData?: CartInitialData }>,
      store,
      () => {
        state = store?.getState();
        publishCartViewedWhenSettled(store);
      },
      () => market.pathPrefix,
    );

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        state = nextState;
        if (hydrated) handle.update();
      });
      handle.signal.addEventListener("abort", unsubscribe, { once: true });
      handle.queueTask((signal) => {
        if (signal.aborted) return;
        hydrated = true;
        state = store.getState();
        publishCartViewedWhenSettled(store);
        handle.update();
      });
    }

    return () => {
      market = handle.props.market ?? US_MARKET;
      if (market.pathPrefix !== appliedMarketPathPrefix) {
        appliedMarketPathPrefix = market.pathPrefix;
        getBrowserCartStore(handle.props.initialData, market.pathPrefix);
      }
      applySnapshot(handle.props.initialData);

      return (
        <CartView
          {...getCartSnapshot(
            hydrated ? state : undefined,
            handle.props.initialData,
          )}
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
    snapshot: CartSnapshot;
  }>,
) {
  return () => {
    let { cart, loading } = handle.props.snapshot;
    let quantity = cart?.totalQuantity ?? 0;

    if (loading || !cart || quantity === 0) {
      return (
        <a
          href={collectionHref("all", handle.props.pathPrefix)}
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
          <span data-sr-only="true"> in cart</span>
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
  return () => <SpriteIcon name="cart" />;
}

function SpriteIcon(handle: Handle<{ name: string }>) {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <use href={`/sprites.svg#${handle.props.name}`} />
    </svg>
  );
}

function cartDialogTitle(snapshot: CartSnapshot): string {
  let quantity = snapshot.cart?.totalQuantity;
  if (!quantity) return snapshot.loading ? "Loading cart" : "Your cart";
  return `${quantity} item(s) in cart`;
}

type CartSnapshot = {
  cart: CartData | null;
  errors?: CartErrorState;
  loading: boolean;
  state?: CartState;
};

type CartViewProps = CartSnapshot & {
  automaticDiscountLabel?: string;
  drawer?: boolean;
  market: ActiveMarket;
  store?: CartStore;
};

function getCartSnapshot(
  state?: CartState,
  initialData?: CartInitialData,
): CartSnapshot {
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

  return {
    cart: null,
    errors: state?.errors,
    loading: state?.loading ?? true,
    state,
  };
}

function CartView(handle: Handle<CartViewProps>) {
  let dismissedAt = 0;

  return () => {
    let { cart, drawer = false, errors, loading, state, store } = handle.props;
    let lines = cart?.lines.nodes ?? [];
    let bannerMessages = errors
      ? getBannerMessages(
          errors,
          lines.map((line) => line.id),
        )
      : [];
    let showBanner = Boolean(
      errors && bannerMessages.length > 0 && errors.lastUpdatedAt > dismissedAt,
    );

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
          {showBanner ? (
            <CartErrorBanner
              messages={bannerMessages}
              onDismiss={() => {
                dismissedAt = errors?.lastUpdatedAt ?? Date.now();
                handle.update();
              }}
            />
          ) : null}
          <BrandedState
            kind="empty"
            heading="No items in cart"
            copy="Please browse our catalog and add items before checking out."
            href={collectionHref("all", handle.props.market.pathPrefix)}
            linkLabel="Shop All"
            icon="cart"
          />
        </section>
      );
    }

    let cartPending = hasPendingCartWork(state);
    let discountAllocation = getCartDiscountAllocation(cart);
    let hasFinalTotal =
      Number(cart.cost.subtotalAmount.amount) !==
      Number(cart.cost.totalAmount.amount);
    let automaticDiscountLabel =
      handle.props.automaticDiscountLabel?.trim() || "Automatic discount";

    return (
      <section
        mix={[
          drawer ? drawerContentStyle : pageCartContentStyle,
          on("submit", (event) => {
            event.preventDefault();
            if (!store) return;

            void store.handleFormSubmit(event).catch((error) => {
              if (!(error instanceof Error && error.name === "AbortError")) {
                console.error("[hydrogen] cart update failed", error);
              }
            });
          }),
        ]}
      >
        {!drawer ? (
          <>
            <div mix={pageTitleStyle}>
              <PageTitle title="Cart" />
            </div>
            <div aria-hidden="true" mix={mobileCartSpacerStyle} />
            <h1 mix={mobileCartTitleStyle}>Cart</h1>
            <h2 mix={cartCountStyle}>{cart.totalQuantity} item(s) in cart</h2>
          </>
        ) : null}
        {showBanner ? (
          <CartErrorBanner
            messages={bannerMessages}
            onDismiss={() => {
              dismissedAt = errors?.lastUpdatedAt ?? Date.now();
              handle.update();
            }}
          />
        ) : null}

        <ul
          mix={[
            lineListStyle,
            drawer ? drawerLineListStyle : pageLineListStyle,
          ]}
        >
          {lines.map((line, index) => {
            let merchandise = line.merchandise;
            let linePending = state?.pending.lines.has(line.id) ?? false;
            let lineMessages = errors
              ? getErrorGroupMessages(errors.lines.get(line.id))
              : [];
            let lineErrorId = `${handle.id}-line-${index}-errors`;
            let compareAtPrice = getLineCompareAtPrice(line);

            return (
              <li
                key={line.id}
                aria-busy={linePending ? "true" : undefined}
                mix={drawer ? drawerLineStyle : lineStyle}
              >
                {merchandise?.image ? (
                  merchandise.product.handle ? (
                    <a
                      href={productHref(
                        merchandise.product.handle,
                        handle.props.market.pathPrefix,
                      )}
                      aria-label={`View ${merchandise.product.title}`}
                      mix={[
                        drawer ? drawerLineImageLinkStyle : lineImageLinkStyle,
                        drawer ? on("click", closeCartDrawer) : undefined,
                      ]}
                    >
                      <img
                        src={shopifyImageUrl(
                          merchandise.image.url,
                          drawer ? 160 : 240,
                        )}
                        alt={
                          merchandise.image.altText ?? merchandise.product.title
                        }
                        width={merchandise.image.width ?? undefined}
                        height={merchandise.image.height ?? undefined}
                      />
                    </a>
                  ) : (
                    <span
                      mix={
                        drawer ? drawerLineImageLinkStyle : lineImageLinkStyle
                      }
                    >
                      <img
                        src={shopifyImageUrl(
                          merchandise.image.url,
                          drawer ? 160 : 240,
                        )}
                        alt={
                          merchandise.image.altText ?? merchandise.product.title
                        }
                        width={merchandise.image.width ?? undefined}
                        height={merchandise.image.height ?? undefined}
                      />
                    </span>
                  )
                ) : null}
                <div mix={lineInfoStyle}>
                  <h2 mix={lineTitleStyle}>
                    {merchandise?.product.handle ? (
                      <a
                        href={productHref(
                          merchandise.product.handle,
                          handle.props.market.pathPrefix,
                        )}
                        mix={drawer ? on("click", closeCartDrawer) : undefined}
                      >
                        {merchandise.product.title}
                      </a>
                    ) : (
                      (merchandise?.product.title ?? "Product")
                    )}
                  </h2>
                  {drawer ? (
                    merchandise?.title &&
                    merchandise.title !== "Default Title" ? (
                      <p mix={detailStyle}>{merchandise.title}</p>
                    ) : null
                  ) : (
                    merchandise?.selectedOptions?.map((option) => (
                      <p key={option.name} mix={detailStyle}>
                        {option.name}: {option.value}
                      </p>
                    ))
                  )}
                  <form
                    action={getCartApiPath(handle.props.market.pathPrefix)}
                    method="post"
                    aria-busy={linePending ? "true" : undefined}
                    mix={quantityFormStyle}
                  >
                    <button {...register("set")} data-set-quantity="true">
                      Update quantity
                    </button>
                    <input
                      type="hidden"
                      {...register("lineId", { value: line.id })}
                    />
                    <button
                      type="submit"
                      {...(line.quantity === 1
                        ? register("remove")
                        : register("decrease"))}
                      aria-label={
                        line.quantity === 1
                          ? "Remove item"
                          : "Decrease quantity"
                      }
                    >
                      <SpriteIcon name="circle-minus" />
                    </button>
                    <input
                      {...register("quantity", {
                        value: line.quantity,
                        interactive: true,
                      })}
                      aria-label="Quantity"
                      data-pending={linePending || undefined}
                      aria-invalid={lineMessages.length ? "true" : undefined}
                      aria-describedby={
                        lineMessages.length ? lineErrorId : undefined
                      }
                    />
                    <button
                      type="submit"
                      {...register("increase")}
                      aria-label="Increase quantity"
                    >
                      <SpriteIcon name="circle-plus" />
                    </button>
                  </form>
                  {lineMessages.length ? (
                    <ErrorMessages id={lineErrorId} messages={lineMessages} />
                  ) : null}
                </div>
                <div
                  data-line-price="true"
                  mix={[
                    linePriceGroupStyle,
                    linePending ? pendingValueStyle : undefined,
                  ]}
                >
                  {compareAtPrice ? (
                    <s>
                      {money(compareAtPrice, handle.props.market.locale)} each
                    </s>
                  ) : null}
                  <p mix={linePriceStyle}>
                    {money(line.cost.totalAmount, handle.props.market.locale)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div mix={drawer ? drawerSummaryStyle : summaryStyle}>
          {drawer ? (
            <>
              <div mix={drawerTotalsStyle}>
                <div mix={drawerSubtotalStyle}>
                  <strong>Subtotal</strong>
                  <span mix={cartPending ? pendingValueStyle : undefined}>
                    {money(
                      cart.cost.subtotalAmount,
                      handle.props.market.locale,
                    )}
                  </span>
                </div>
                {discountAllocation ? (
                  <div mix={allocationStyle}>
                    <span>{automaticDiscountLabel}</span>
                    <span>
                      -{money(discountAllocation, handle.props.market.locale)}
                    </span>
                  </div>
                ) : null}
                {hasFinalTotal ? (
                  <div mix={finalTotalStyle}>
                    <strong>Total</strong>
                    <span mix={cartPending ? pendingValueStyle : undefined}>
                      {money(cart.cost.totalAmount, handle.props.market.locale)}
                    </span>
                  </div>
                ) : null}
                <FreeShippingProgress
                  locale={handle.props.market.locale}
                  subtotal={cart.cost.subtotalAmount}
                />
              </div>
              {cart.checkoutUrl ? (
                <a href={cart.checkoutUrl} mix={drawerCheckoutStyle}>
                  <span>{cartPending ? "Updating cart…" : "Check out"}</span>
                  {cartPending ? null : <SpriteIcon name="fast-forward" />}
                </a>
              ) : null}
            </>
          ) : (
            <>
              <div mix={pageTotalsStyle}>
                <div mix={pageSubtotalStyle}>
                  <strong>Subtotal</strong>
                  <span mix={cartPending ? pendingValueStyle : undefined}>
                    {money(
                      cart.cost.subtotalAmount,
                      handle.props.market.locale,
                    )}
                  </span>
                </div>
                {discountAllocation ? (
                  <div mix={allocationStyle}>
                    <span>{automaticDiscountLabel}</span>
                    <span>
                      -{money(discountAllocation, handle.props.market.locale)}
                    </span>
                  </div>
                ) : null}
                {hasFinalTotal ? (
                  <div mix={finalTotalStyle}>
                    <strong>Total</strong>
                    <span mix={cartPending ? pendingValueStyle : undefined}>
                      {money(cart.cost.totalAmount, handle.props.market.locale)}
                    </span>
                  </div>
                ) : null}
                <FreeShippingProgress
                  locale={handle.props.market.locale}
                  subtotal={cart.cost.subtotalAmount}
                />
                <p mix={taxNoteStyle}>
                  Taxes &amp; shipping details at checkout
                </p>
              </div>
              {cart.checkoutUrl ? (
                <a href={cart.checkoutUrl} mix={checkoutStyle}>
                  <span>{cartPending ? "Updating cart…" : "Check out"}</span>
                  {cartPending ? null : <SpriteIcon name="fast-forward" />}
                </a>
              ) : null}
            </>
          )}
        </div>
      </section>
    );
  };
}

type CartDiscountAllocationData = {
  __typename?: string;
  discountedAmount: MoneyV2;
};

function getCartDiscountAllocation(cart: CartData): MoneyV2 | null {
  let allocations = cart.lines.nodes
    .flatMap(
      (line) =>
        (
          line as typeof line & {
            discountAllocations?: CartDiscountAllocationData[];
          }
        ).discountAllocations ?? [],
    )
    .filter(
      (allocation) =>
        allocation.__typename === "CartAutomaticDiscountAllocation",
    );
  let first = allocations[0]?.discountedAmount;
  if (!first) return null;

  let amount = allocations.reduce(
    (total, allocation) => total + Number(allocation.discountedAmount.amount),
    0,
  );
  return amount > 0
    ? { amount: String(amount), currencyCode: first.currencyCode }
    : null;
}

function getLineCompareAtPrice(
  line: CartData["lines"]["nodes"][number],
): MoneyV2 | null {
  let compareAtPrice = line.cost.compareAtAmountPerQuantity;
  if (!compareAtPrice) return null;

  let compareAtAmount = Number(compareAtPrice.amount);
  let selectedAmount = Number(line.cost.amountPerQuantity.amount);
  if (!Number.isFinite(compareAtAmount) || compareAtAmount <= selectedAmount) {
    return null;
  }
  return compareAtPrice;
}

function FreeShippingProgress(
  handle: Handle<{
    locale: MarketLocale;
    subtotal: { amount: string; currencyCode: string };
  }>,
) {
  return () => {
    let { subtotal } = handle.props;
    if (subtotal.currencyCode !== "USD") return null;

    let threshold = 75;
    let amount = Number(subtotal.amount);
    if (!Number.isFinite(amount)) return null;

    let remaining = Math.max(0, threshold - amount);
    let percentage = Math.round(
      Math.min(1, Math.max(0, amount / threshold)) * 100,
    );
    let achieved = remaining === 0;
    let remainingPrice = money(
      {
        amount: remaining.toFixed(2),
        currencyCode: subtotal.currencyCode,
      },
      handle.props.locale,
    );

    return (
      <div
        role="group"
        aria-label="Free shipping progress"
        mix={freeShippingStyle}
      >
        <p>
          {achieved
            ? "Your shipping is free!"
            : `Add ${remainingPrice} more for free shipping`}
        </p>
        <div data-progress-track="true">
          <span
            role="progressbar"
            aria-label={
              achieved
                ? "Free shipping unlocked"
                : `${percentage}% toward free shipping`
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
            data-complete={achieved || undefined}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };
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

function ErrorMessages(handle: Handle<{ id: string; messages: string[] }>) {
  return () => (
    <div id={handle.props.id} role="alert" mix={errorStyle}>
      {handle.props.messages.map((message, index) => (
        <p key={`${message}-${index}`}>{message}</p>
      ))}
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
  errors: CartErrorState,
  visibleLineIds: string[],
): string[] {
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

function money(
  value: { amount: string; currencyCode: string },
  locale: MarketLocale,
): string {
  return formatMoney(value as MoneyV2, { locale }).toString();
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
  "&:hover [data-expanded-label], &:focus-visible [data-expanded-label], &[aria-expanded='true'] [data-expanded-label]":
    {
      maxWidth: "10ch",
    },
  "& [data-sr-only]": {
    clip: "rect(0, 0, 0, 0)",
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
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
  "& button:hover": { background: "rgba(255,255,255,.2)" },
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
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
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
const lineStyle = css({
  alignItems: "start",
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "80px minmax(0, 1fr) auto",
  minHeight: "80px",
});
const drawerLineStyle = css({
  alignItems: "start",
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "80px minmax(0, 1fr) auto",
  minHeight: "80px",
});
const lineImageLinkStyle = css({
  background: "var(--color-white)",
  borderRadius: "16px",
  display: "block",
  height: "80px",
  padding: "8px",
  width: "80px",
  "& img": { height: "100%", objectFit: "contain", width: "100%" },
});
const drawerLineImageLinkStyle = css({
  background: "white",
  borderRadius: "16px",
  display: "block",
  height: "80px",
  padding: "8px",
  width: "80px",
  "& img": { height: "100%", objectFit: "contain", width: "100%" },
});
const lineInfoStyle = css({ minWidth: 0 });
const lineTitleStyle = css({
  fontSize: ".875rem",
  fontWeight: 700,
  letterSpacing: "-.025em",
  lineHeight: "20px",
  margin: 0,
  "& a, & a:hover": { color: "inherit", textDecoration: "none" },
});
const detailStyle = css({ fontSize: ".875rem", lineHeight: "20px", margin: 0 });
const linePriceGroupStyle = css({
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column",
  fontSize: ".875rem",
  gap: "4px",
  whiteSpace: "nowrap",
  "& s": { opacity: 0.75 },
});
const linePriceStyle = css({ margin: 0, whiteSpace: "nowrap" });
const summaryStyle = css({
  alignItems: "flex-end",
  background: "var(--color-black)",
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  marginTop: "36px",
  padding: "16px 0",
  position: "sticky",
  zIndex: 10,
});
const pageTotalsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  width: "100%",
});
const pageSubtotalStyle = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  "& strong": {
    fontFamily: "var(--font-title)",
    fontSize: "1rem",
    fontWeight: 900,
    letterSpacing: "-.05em",
    textTransform: "uppercase",
  },
  "& span": { fontSize: "1rem", fontWeight: 700 },
  "@media (min-width: 810px)": { "& strong, & span": { fontSize: "1.25rem" } },
});
const allocationStyle = css({
  color: "var(--color-green-brand)",
  display: "flex",
  fontSize: ".875rem",
  fontWeight: 600,
  justifyContent: "space-between",
});
const finalTotalStyle = css({
  alignItems: "center",
  borderTop: "1px solid rgba(255,255,255,.2)",
  display: "flex",
  justifyContent: "space-between",
  marginTop: "4px",
  paddingTop: "8px",
  "& strong": {
    fontFamily: "var(--font-title)",
    fontSize: "1rem",
    letterSpacing: "-.05em",
    textTransform: "uppercase",
  },
  "& span": { fontSize: "1rem", fontWeight: 700 },
});
const taxNoteStyle = css({
  color: "rgba(255,255,255,.5)",
  fontSize: ".75rem",
  margin: "4px 0 0",
  textAlign: "center",
});
const checkoutStyle = css({
  alignItems: "center",
  background: "var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-black) !important",
  display: "flex",
  fontSize: "1.25rem",
  fontWeight: 600,
  gap: "10px",
  justifyContent: "center",
  minHeight: "64px",
  padding: "16px 24px",
  textDecoration: "none",
  width: "100%",
  "& svg": { fill: "currentColor", height: "32px", width: "32px" },
  "@media (min-width: 810px)": { width: "240px" },
});
const quantityFormStyle = css({
  alignItems: "center",
  display: "flex",
  fontSize: ".875rem",
  gap: "10px",
  lineHeight: "20px",
  marginTop: "4px",
  width: "fit-content",
  "& [data-set-quantity]": {
    clip: "rect(0, 0, 0, 0)",
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
  "& button:not([data-set-quantity])": {
    background: "transparent",
    border: 0,
    color: "rgba(255,255,255,.5)",
    padding: 0,
  },
  "& button:not([data-set-quantity]):hover": { color: "white" },
  "& button svg": { height: "20px", width: "20px" },
  '& input[name="quantity"]': {
    appearance: "textfield",
    background: "transparent",
    border: 0,
    color: "inherit",
    font: "inherit",
    height: "20px",
    padding: 0,
    textAlign: "center",
    width: "20px",
  },
  '& input[name="quantity"][data-pending]': { opacity: 0.5 },
  '& input[name="quantity"]::-webkit-inner-spin-button, & input[name="quantity"]::-webkit-outer-spin-button':
    {
      appearance: "none",
      margin: 0,
    },
});
const drawerSummaryStyle = css({
  background: "var(--color-blue-brand)",
  flex: "0 0 auto",
  borderRadius: "0 0 42px 42px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "16px",
});
const drawerTotalsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});
const drawerSubtotalStyle = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  lineHeight: 1.4,
  "& strong": {
    fontFamily: "var(--font-title)",
    fontSize: "1rem",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  "& span": { fontSize: ".875rem" },
});
const freeShippingStyle = css({
  "& p": { fontSize: ".875rem", lineHeight: "20px", margin: 0 },
  "& [data-progress-track]": {
    background: "rgba(255,255,255,.18)",
    borderRadius: "999px",
    height: "8px",
    marginTop: "8px",
    overflow: "hidden",
  },
  '& [role="progressbar"]': {
    background: "white",
    borderRadius: "999px",
    display: "block",
    height: "100%",
    transition: "width 300ms ease",
  },
  '& [role="progressbar"][data-complete]': {
    background: "var(--color-green-brand)",
  },
});
const drawerCheckoutStyle = css({
  alignItems: "center",
  background: "white",
  borderRadius: "54px",
  color: "black !important",
  display: "flex",
  fontSize: "1.25rem",
  fontWeight: 600,
  gap: "10px",
  lineHeight: 1.4,
  justifyContent: "center",
  minHeight: "64px",
  padding: "16px 24px",
  textDecoration: "none",
  width: "100%",
  "& svg": { height: "32px", width: "32px" },
});
const pendingValueStyle = css({
  opacity: 0.5,
});
const errorStyle = css({
  color: "var(--color-red-brand)",
  flexBasis: "100%",
  margin: "4px 0 0",
  "& p": { margin: "4px 0" },
});
const errorBannerStyle = css({
  alignItems: "start",
  background: "#fff0f0",
  border: "1px solid #a40000",
  display: "flex",
  gap: "16px",
  justifyContent: "space-between",
  marginBottom: "16px",
  padding: "12px",
  "& p": { margin: "0 0 4px" },
});
