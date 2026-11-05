import {
  createCartFormRegister,
  type CartData,
  type MoneyV2,
} from "@shopify/hydrogen";
import { css, on, type Handle } from "remix/component";

import { routes } from "../../routes.ts";
import { cartApiPath } from "../../lib/public/cart-routes.ts";
import {
  marketPath,
  type ActiveMarket,
  type MarketPathPrefix,
} from "../../lib/public/market.ts";
import { Icon } from "../../ui/public/icon.tsx";
import { shopifyImageUrl } from "../../ui/public/shopify-image.tsx";
import { visuallyHiddenStyle } from "../../ui/public/visually-hidden.ts";
import { formatCartMoney, pendingValueStyle } from "./cart-format.ts";

const register = createCartFormRegister();

function productHref(
  handle: string,
  pathPrefix: MarketPathPrefix = "",
): string {
  return marketPath(routes.products.show.href({ handle }), pathPrefix);
}

export type CartLineData = CartData["lines"]["nodes"][number];

export function CartLine(
  handle: Handle<{
    drawer: boolean;
    line: CartLineData;
    market: ActiveMarket;
    messages: string[];
    /** Runs when a product link is followed, e.g. to close the drawer. */
    onLinkClick?: () => void;
    pending: boolean;
  }>,
) {
  return () => {
    let { drawer, line, market, messages, onLinkClick, pending } = handle.props;
    let merchandise = line.merchandise;
    let product = merchandise?.product;
    let productTitle = product?.title ?? "Product";
    let href = product?.handle
      ? productHref(product.handle, market.pathPrefix)
      : undefined;
    let errorId = `${handle.id}-errors`;
    let compareAtPrice = getLineCompareAtPrice(line);
    let imageLinkStyle = drawer ? drawerLineImageLinkStyle : lineImageLinkStyle;
    let closeOnClick = onLinkClick
      ? on<HTMLAnchorElement>("click", onLinkClick)
      : undefined;
    // The drawer is a closed dialog until opened, so its thumbnails wait to
    // load until then.
    let thumbnail = merchandise?.image ? (
      <img
        src={shopifyImageUrl(merchandise.image.url, drawer ? 160 : 240)}
        alt={merchandise.image.altText ?? merchandise.product.title}
        width={merchandise.image.width ?? undefined}
        height={merchandise.image.height ?? undefined}
        loading={drawer ? "lazy" : "eager"}
      />
    ) : null;

    return (
      <li
        aria-busy={pending ? "true" : undefined}
        mix={drawer ? drawerLineStyle : lineStyle}
      >
        {thumbnail ? (
          href ? (
            <a
              href={href}
              aria-label={`View ${productTitle}`}
              mix={[imageLinkStyle, closeOnClick]}
            >
              {thumbnail}
            </a>
          ) : (
            <span mix={imageLinkStyle}>{thumbnail}</span>
          )
        ) : null}
        <div mix={lineInfoStyle}>
          <h2 mix={lineTitleStyle}>
            {href ? (
              <a href={href} mix={closeOnClick}>
                {productTitle}
              </a>
            ) : (
              productTitle
            )}
          </h2>
          {merchandise?.title && merchandise.title !== "Default Title" ? (
            <p mix={detailStyle}>{merchandise.title}</p>
          ) : null}
          <form
            action={cartApiPath(market.pathPrefix)}
            method="post"
            aria-busy={pending ? "true" : undefined}
            mix={quantityFormStyle}
          >
            <button
              {...register("set")}
              data-set-quantity="true"
              mix={visuallyHiddenStyle}
            >
              Update quantity
            </button>
            <input type="hidden" {...register("lineId", { value: line.id })} />
            <button
              type="submit"
              {...(line.quantity === 1
                ? register("remove")
                : register("decrease"))}
              aria-label={
                line.quantity === 1 ? "Remove item" : "Decrease quantity"
              }
            >
              <Icon name="circle-minus" />
            </button>
            <input
              {...register("quantity", {
                value: line.quantity,
                interactive: true,
              })}
              aria-label="Quantity"
              data-pending={pending || undefined}
              aria-invalid={messages.length ? "true" : undefined}
              aria-describedby={messages.length ? errorId : undefined}
            />
            <button
              type="submit"
              {...register("increase")}
              aria-label="Increase quantity"
            >
              <Icon name="circle-plus" />
            </button>
          </form>
          {messages.length ? (
            <ErrorMessages id={errorId} messages={messages} />
          ) : null}
        </div>
        <div
          data-line-price="true"
          mix={[linePriceGroupStyle, pending ? pendingValueStyle : undefined]}
        >
          {compareAtPrice ? (
            <s>{formatCartMoney(compareAtPrice, market.locale)} each</s>
          ) : null}
          <p mix={linePriceStyle}>
            {formatCartMoney(line.cost.totalAmount, market.locale)}
          </p>
        </div>
      </li>
    );
  };
}

function getLineCompareAtPrice(line: CartLineData): MoneyV2 | null {
  let compareAtPrice = line.cost.compareAtAmountPerQuantity;
  if (!compareAtPrice) return null;

  let compareAtAmount = Number(compareAtPrice.amount);
  let selectedAmount = Number(line.cost.amountPerQuantity.amount);
  if (!Number.isFinite(compareAtAmount) || compareAtAmount <= selectedAmount) {
    return null;
  }
  return compareAtPrice;
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
const quantityFormStyle = css({
  alignItems: "center",
  display: "flex",
  fontSize: ".875rem",
  gap: "10px",
  lineHeight: "20px",
  marginTop: "4px",
  width: "fit-content",
  "& button:not([data-set-quantity])": {
    background: "transparent",
    border: 0,
    color: "rgba(255,255,255,.5)",
    padding: 0,
  },
  "@media (hover: hover)": {
    "& button:not([data-set-quantity]):hover": { color: "white" },
  },
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
const errorStyle = css({
  color: "var(--color-red-brand)",
  flexBasis: "100%",
  margin: "4px 0 0",
  "& p": { margin: "4px 0" },
});
