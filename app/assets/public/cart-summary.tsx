import type { CartData, MoneyV2 } from "@shopify/hydrogen";
import { css, type Handle } from "remix/component";

import type { ActiveMarket } from "../../lib/public/market.ts";
import { Icon } from "../../ui/public/icon.tsx";
import { money, pendingValueStyle } from "./cart-format.ts";
import { appCartData } from "./cart-store.ts";

/** Totals and checkout link. The page adds a tax note; the drawer is compact. */
export function CartSummary(
  handle: Handle<{
    automaticDiscountLabel: string;
    cart: CartData;
    drawer: boolean;
    market: ActiveMarket;
    pending: boolean;
  }>,
) {
  return () => {
    let { automaticDiscountLabel, cart, drawer, market, pending } =
      handle.props;
    let discountAllocation = getCartDiscountAllocation(cart);
    let hasFinalTotal =
      Number(cart.cost.subtotalAmount.amount) !==
      Number(cart.cost.totalAmount.amount);
    let pendingStyle = pending ? pendingValueStyle : undefined;

    return (
      <div mix={drawer ? drawerSummaryStyle : summaryStyle}>
        <div mix={drawer ? drawerTotalsStyle : pageTotalsStyle}>
          <div mix={drawer ? drawerSubtotalStyle : pageSubtotalStyle}>
            <strong>Subtotal</strong>
            <span mix={pendingStyle}>
              {money(cart.cost.subtotalAmount, market.locale)}
            </span>
          </div>
          {discountAllocation ? (
            <div mix={allocationStyle}>
              <span>{automaticDiscountLabel}</span>
              <span>-{money(discountAllocation, market.locale)}</span>
            </div>
          ) : null}
          {hasFinalTotal ? (
            <div mix={finalTotalStyle}>
              <strong>Total</strong>
              <span mix={pendingStyle}>
                {money(cart.cost.totalAmount, market.locale)}
              </span>
            </div>
          ) : null}
          <FreeShippingNotice
            market={market}
            subtotal={cart.cost.subtotalAmount}
          />
          {drawer ? null : (
            <p mix={taxNoteStyle}>Taxes &amp; Shipping details at checkout</p>
          )}
        </div>
        {cart.checkoutUrl ? (
          <a
            href={cart.checkoutUrl}
            mix={drawer ? drawerCheckoutStyle : checkoutStyle}
          >
            <span>{pending ? "Updating cart…" : "Check out"}</span>
            {pending ? null : <Icon name="fast-forward" />}
          </a>
        ) : null}
      </div>
    );
  };
}

function getCartDiscountAllocation(cart: CartData): MoneyV2 | null {
  let allocations = appCartData(cart)
    .lines.nodes.flatMap((line) => line.discountAllocations ?? [])
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

function FreeShippingNotice(
  handle: Handle<{
    market: ActiveMarket;
    subtotal: { amount: string; currencyCode: string };
  }>,
) {
  return () => {
    let { market, subtotal } = handle.props;
    let threshold = 75;
    let amount = Number(subtotal.amount);
    // Only compare the subtotal with the minimum when both are in USD.
    let showProgress =
      subtotal.currencyCode === "USD" &&
      Boolean(subtotal.amount.trim()) &&
      Number.isFinite(amount) &&
      amount >= 0;
    let achieved = amount >= threshold;
    let percentage = Math.min(Math.floor((amount / threshold) * 100), 100);

    return (
      <div mix={freeShippingStyle}>
        {showProgress ? (
          <>
            <p>
              {achieved
                ? "You've reached the US$75 free shipping minimum."
                : `Add ${money(
                    {
                      amount: (threshold - amount).toFixed(2),
                      currencyCode: "USD",
                    },
                    market.locale,
                  )} more for free shipping`}
            </p>
            <div data-progress-track="true">
              <span
                role="progressbar"
                aria-label="Free shipping progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                data-complete={achieved || undefined}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </>
        ) : null}
        {market.country === "US" ? (
          <p mix={shippingConfirmationStyle}>
            Shipping options confirmed at checkout.
          </p>
        ) : (
          <p>
            Free shipping with a US$75 minimum. See your shipping options at
            checkout.
          </p>
        )}
      </div>
    );
  };
}

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
  "& strong, & span": { lineHeight: "1.4rem" },
  "@media (min-width: 810px)": {
    "& strong, & span": { fontSize: "1.25rem", lineHeight: "1.75rem" },
  },
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
  lineHeight: "1rem",
  margin: 0,
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
const shippingConfirmationStyle = css({
  color: "rgba(255,255,255,.7)",
  fontSize: ".75rem !important",
  lineHeight: "1rem !important",
});
const freeShippingStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  "& p": { fontSize: ".875rem", lineHeight: "20px", margin: 0 },
  "& [data-progress-track]": {
    background: "rgba(255,255,255,.18)",
    borderRadius: "999px",
    height: "8px",
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
