import React, { useRef } from "react";
import {
  CartForm,
  Money,
  type OptimisticCartLine,
  useOptimisticCart,
  type OptimisticCart,
} from "@shopify/hydrogen";
import type { CartLineUpdateInput } from "@shopify/hydrogen/storefront-api-types";
import { Link, type FetcherWithComponents } from "@remix-run/react";
import type { CartApiQueryFragment } from "storefrontapi.generated";
import { useVariantUrl } from "~/lib/variants";
import { AsideDescription } from "~/components/ui/aside";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import { Button } from "~/components/ui/button";
import { Icon } from "~/components/icon";
import { clsx } from "clsx";
import { cn } from "~/lib/cn";

type CartLine = OptimisticCartLine<CartApiQueryFragment["lines"]["nodes"][0]>;

type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: "page" | "aside";
};

export function CartMain({ layout, cart: originalCart }: CartMainProps) {
  const cart = useOptimisticCart(originalCart);
  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);

  return (
    <div className="h-full w-full">
      <CartEmpty hidden={linesCount} layout={layout} />
      <CartDetails hidden={!linesCount} cart={cart} layout={layout} />
    </div>
  );
}

function CartEmpty({
  hidden = false,
  layout = "aside",
}: {
  hidden: boolean;
  layout?: CartMainProps["layout"];
}) {
  const ctaUrl = "/collections/all";
  return (
    <div className={clsx("h-full w-full flex-col", hidden ? "hidden" : "flex")}>
      <CartItems layout={layout}>There are no items in this cart.</CartItems>
      <div className="mt-auto">
        <Button intent="secondary" size="lg" asChild>
          <Link
            to={ctaUrl}
            onClick={() => {
              if (layout !== "aside") return;
              // force the drawer closed via a full page navigation
              window.location.href = ctaUrl;
            }}
          >
            <span>Back to shop</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

function CartDetails({
  hidden = true,
  layout,
  cart,
}: {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: "page" | "aside";
  hidden: boolean;
}) {
  const cartHasItems = !!cart?.lines?.nodes?.length;
  if (!cartHasItems) return null;

  return (
    <div className={clsx("h-full flex-col", hidden ? "hidden" : "flex")}>
      <CartItems layout={layout}>
        <strong className="font-bold">{cart.totalQuantity}</strong>{" "}
        {cart.totalQuantity === 1 ? "item" : "item(s)"} in this cart
      </CartItems>
      <CartLines lines={cart?.lines?.nodes} layout={layout} />
      {cartHasItems && (
        <CartSummary layout={layout}>
          <CartSubTotal subtotalAmount={cart.cost?.subtotalAmount} />
          <CartDiscounts discountCodes={cart.discountCodes} />
          <CheckoutButton checkoutUrl={cart.checkoutUrl} />
        </CartSummary>
      )}
    </div>
  );
}

function CartItems({
  layout,
  children,
}: Pick<CartMainProps, "layout"> & { children: React.ReactNode }) {
  if (layout === "aside") {
    return (
      <AsideDescription asChild>
        <p className="h-14">{children}</p>
      </AsideDescription>
    );
  }

  return <p className="h-14">{children}</p>;
}

function CartLines({
  lines,
  layout,
}: {
  layout: CartMainProps["layout"];
  lines: CartLine[];
}) {
  if (!lines) return null;

  // This ungodly height calculation is:
  // 100vh - cart header - cart summary - line item count - padding
  const cartLinesHeight = `h-[calc(100vh-var(--aside-header-height)-var(--aside-summary-height)-(--spacing(14))-(--spacing(9)))]`;

  return (
    <div
      aria-labelledby="cart-lines"
      className={clsx("overflow-y-auto", cartLinesHeight)}
    >
      <ul className="flex flex-col gap-9">
        {lines.map((line) => (
          <CartLineItem key={line.id} line={line} layout={layout} />
        ))}
      </ul>
    </div>
  );
}

function CartLineItem({
  layout,
  line,
}: {
  layout: CartMainProps["layout"];
  line: CartLine;
}) {
  const { id, merchandise } = line;
  const { product, title, image, selectedOptions } = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);

  return (
    <li key={id} className="flex first:pt-0 last:pb-8">
      {image && (
        <div className="h-[148px] w-[148px]">
          <HydrogenImage
            className="pointer-events-none size-auto select-none"
            alt={title}
            data={image}
            loading="lazy"
          />
        </div>
      )}

      <div className="ml-6 flex flex-col">
        <Link
          prefetch="intent"
          className="no-underline"
          to={lineItemUrl}
          onClick={() => {
            if (layout === "aside") {
              // close the drawer
              window.location.href = lineItemUrl;
            }
          }}
        >
          <p>
            <strong className="text-xl tracking-tight text-neutral-800 dark:text-white">
              {product.title}
            </strong>
          </p>
        </Link>
        <CartLinePrice line={line} as="span" />
        <ul>
          {selectedOptions.map((option) => {
            const isDefaultVariant = option.value === "Default Title";
            if (isDefaultVariant) return null;
            return (
              <li key={option.name}>
                <small>
                  {option.name}: {option.value}
                </small>
              </li>
            );
          })}
        </ul>
        <CartLineQuantity line={line} />
      </div>
    </li>
  );
}

function CartSubTotal({
  subtotalAmount,
}: {
  subtotalAmount?: Partial<CartApiQueryFragment["cost"]["subtotalAmount"]>;
}) {
  return (
    <dl className="flex w-full justify-between">
      <dt className="text-xl">Subtotal</dt>
      <dd>
        {subtotalAmount?.amount ? (
          <p className="inline-flex">
            <span className="mr-3">{subtotalAmount.currencyCode}</span>
            <Money as="strong" data={subtotalAmount} />
          </p>
        ) : (
          "-"
        )}
      </dd>
    </dl>
  );
}

function CartSummary({
  layout,
  children = null,
  className,
}: {
  children?: React.ReactNode;
  layout: CartMainProps["layout"];
  className?: string;
}) {
  return (
    <div
      aria-labelledby="cart-summary"
      className={cn(
        // should be conditional wether user has already inputted a discount or not
        "h-[var(--aside-summary-height)]",
        "absolute bottom-0 left-0 bg-neutral-100 dark:bg-neutral-700",
        "w-full p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CartLineRemoveButton({
  children,
  lineIds,
}: {
  children: React.ReactNode;
  lineIds: string[];
}) {
  return (
    <div className="ml-auto">
      <CartForm
        action={CartForm.ACTIONS.LinesRemove}
        inputs={{ lineIds }}
        route="/cart"
      >
        {children}
      </CartForm>
    </div>
  );
}

function CartLineQuantity({ line }: { line: CartLine }) {
  if (!line || typeof line?.quantity === "undefined") return null;
  const { id: lineId, quantity, isOptimistic } = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="rounded-input mt-3 flex w-[194px] bg-neutral-50 p-[1px] dark:bg-neutral-900">
      <div className="flex items-center justify-between px-5">
        <CartLineUpdateButton lines={[{ id: lineId, quantity: prevQuantity }]}>
          <button
            disabled={!!isOptimistic}
            type="submit"
            value={prevQuantity}
            name="decrease-quantity"
          >
            <Icon
              name="minus"
              aria-label="Decrease quantity"
              className="dar:bg-red"
            />
          </button>
        </CartLineUpdateButton>
        <div className="w-12 text-center font-bold">{quantity}</div>
        <CartLineUpdateButton lines={[{ id: lineId, quantity: nextQuantity }]}>
          <button
            disabled={!!isOptimistic}
            type="submit"
            value={nextQuantity}
            name="increase-quantity"
          >
            <Icon name="plus" aria-label="Increase quantity" />
          </button>
        </CartLineUpdateButton>
      </div>
      <CartLineRemoveButton lineIds={[lineId]}>
        <Button size="icon" disabled={!!isOptimistic} type="submit">
          <Icon name="trash" aria-label="Remove cart item" />
        </Button>
      </CartLineRemoveButton>
    </div>
  );
}

function CartLinePrice({
  line,
  priceType = "regular",
  ...passthroughProps
}: {
  line: CartLine;
  priceType?: "regular" | "compareAt";
  [key: string]: any;
}) {
  if (!line?.cost?.amountPerQuantity || !line?.cost?.totalAmount)
    return <div style={{ visibility: "hidden" }}>&nbsp;</div>;

  const moneyV2 =
    priceType === "regular"
      ? line.cost.totalAmount
      : line.cost.compareAtAmountPerQuantity;

  if (moneyV2 == null) {
    return <div style={{ visibility: "hidden" }}>&nbsp;</div>;
  }

  return (
    <div>
      <Money withoutTrailingZeros {...passthroughProps} data={moneyV2} />
    </div>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes?: CartApiQueryFragment["discountCodes"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const codeEntered = Boolean(inputRef.current?.value);
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({ code }) => code) || [];

  const codeApplied = Boolean(codes.length);
  const codeEnteredInvalid = codeEntered && !codeApplied;

  return (
    <div className={clsx(codeEnteredInvalid ? "pt-8 pb-2" : "py-8")}>
      {/* Have existing discount, display it with a remove option */}
      {Boolean(codes.length) && (
        <div className="flex justify-between">
          <p className="rounded-input text-blue-brand w-full bg-neutral-200 p-5 leading-5 dark:bg-neutral-800">
            Promo code applied
          </p>
        </div>
      )}

      {/* Show an input to apply a discount */}
      {!codes.length && (
        <UpdateDiscountForm discountCodes={codes}>
          <div className="rounded-input flex h-[60px] w-full justify-between bg-neutral-200 pl-5 dark:bg-neutral-800">
            <input
              type="text"
              ref={inputRef}
              name="discountCode"
              placeholder="Enter promo code"
              className={clsx(
                "font-sm lh-5 my-5 bg-neutral-200 font-mono leading-5 font-bold uppercase dark:bg-neutral-800",
                "focus:border-transparent focus:ring-0 focus:outline-hidden",
                "placeholder:font-thin placeholder:normal-case",
                "w-full",
              )}
            />
            <div className="pt-[1px] pr-[1px]">
              <Button type="submit" className="w-max uppercase">
                apply code
              </Button>
            </div>
          </div>
        </UpdateDiscountForm>
      )}

      <span
        className={clsx(
          "text-red-brand mt-2 text-sm",
          codeEnteredInvalid ? "visible" : "hidden",
        )}
      >
        The code you entered is invalid or has expired
      </span>
    </div>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {({ data }: FetcherWithComponents<any>) => {
        return children;
      }}
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  return (
    <div className="h-6 w-6">
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.LinesUpdate}
        inputs={{ lines }}
      >
        {children}
      </CartForm>
    </div>
  );
}

function CheckoutButton({ checkoutUrl }: { checkoutUrl?: string }) {
  if (!checkoutUrl) return null;

  return (
    <div className="flex">
      <Button intent="primary" size="lg" asChild>
        <a href={checkoutUrl} target="_self">
          <p>Continue to checkout</p>
        </a>
      </Button>
    </div>
  );
}
