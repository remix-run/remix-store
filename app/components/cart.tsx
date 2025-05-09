import React, { useRef } from "react";
import { CartForm, type OptimisticCartLine } from "@shopify/hydrogen";
import { Link, type FetcherWithComponents, type LinkProps } from "react-router";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import { Button } from "~/components/ui/button";
import { Icon } from "~/components/icon";
import {
  ProductPrice,
  type ProductPriceProps,
} from "~/components/product-grid";
import { clsx } from "clsx";
import { cn } from "~/lib/cn";

import type { CartApiQueryFragment } from "storefrontapi.generated";
import { AnimatedLinkSpread } from "./ui/animated-link";

export function CartHeader({
  totalQuantity,
  className,
}: {
  totalQuantity: number;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-title tracking-tightest text-base font-black uppercase",
        className,
      )}
    >
      {totalQuantity} item(s) in cart
    </h2>
  );
}

export function CheckoutLink({
  to,
  disabled = false,
  ...props
}: {
  to: string;
  disabled?: boolean;
} & Omit<LinkProps, "to" | "children">) {
  return (
    <AnimatedLinkSpread to={to} {...props}>
      {disabled ? (
        <span>Updating cart...</span>
      ) : (
        <>
          <span>Check out</span>
          <Icon
            name="fast-forward"
            className="size-8"
            fill="currentColor"
            aria-hidden="true"
          />
        </>
      )}
    </AnimatedLinkSpread>
  );
}

type CartLine = OptimisticCartLine<CartApiQueryFragment["lines"]["nodes"][0]>;

export function CartLineItem({
  line,
  isOptimistic,
  onImageClick,
  className,
  layout,
}: {
  line: CartLine;
  /** Cart optimistic state */
  isOptimistic: boolean;
  /** Callback for when the image is clicked */
  onImageClick?: React.MouseEventHandler<HTMLAnchorElement>;
  layout?: ProductPriceProps["layout"];
  /** Additional className for the container */
  className?: string;
}) {
  let { id, quantity, cost } = line;
  let { image, title, product, price, compareAtPrice } = line.merchandise;

  // TODO: we need to revisit this logic with discounted items
  // it probably won't be quite the right experience
  let totalAmount =
    !cost && line.isOptimistic
      ? // For new, pending item, just use the price
        price
      : isOptimistic
        ? // If the cart is pending, calculate an amount
          {
            ...price,
            amount: String(Number(cost.amountPerQuantity.amount) * quantity),
          }
        : // otherwise, use the the actual cost
          cost.totalAmount;

  // If the product has a compare at price, multiply it by the quantity
  if (compareAtPrice) {
    compareAtPrice = {
      ...compareAtPrice,
      amount: String(Number(compareAtPrice.amount) * quantity),
    };
  }

  return (
    <li className={cn("flex items-start gap-3", className)}>
      <Link
        prefetch="intent"
        to={`/products/${product.handle}`}
        onClick={onImageClick}
        className="size-20 shrink-0 rounded-2xl bg-white p-2"
      >
        {image && (
          <HydrogenImage
            data={image}
            className="h-full w-full object-contain"
            sizes="5em"
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <h3 className="font-bold tracking-tight">{product.title}</h3>
        <p>{title !== "Default Title" && title}</p>
        <CartQuantityControls
          lineId={id}
          quantity={quantity}
          productTitle={product.title}
        />
      </div>

      <ProductPrice
        price={totalAmount}
        compareAtPrice={compareAtPrice}
        layout={layout}
      />
    </li>
  );
}

function CartQuantityControls({
  lineId,
  quantity,
  productTitle,
}: {
  lineId: string;
  quantity: number;
  productTitle: string;
}) {
  let prevQuantity = quantity - 1;

  let buttonClassName =
    "flex items-center justify-center rounded-full text-white/50 transition-colors duration-150 ease-in-out hover:text-white  focus-visible:text-white focus-visible:ring-1 focus-visible:ring-white/50  focus-visible:outline-none";

  return (
    <div
      className="flex items-center gap-2.5"
      role="group"
      aria-label={`Quantity controls for ${productTitle}`}
    >
      {quantity === 1 ? (
        <CartLineRemoveButton lineIds={[lineId]}>
          <button
            type="submit"
            className={buttonClassName}
            aria-label={`Remove ${productTitle} from cart`}
          >
            <Icon name="circle-minus" className="size-5" />
          </button>
        </CartLineRemoveButton>
      ) : (
        <CartLineUpdateButton lines={[{ id: lineId, quantity: prevQuantity }]}>
          <button
            className={buttonClassName}
            type="submit"
            value={prevQuantity}
            name="decrease-quantity"
            aria-label={`Decrease ${productTitle} quantity by 1`}
          >
            <Icon name="circle-minus" className="size-5" />
          </button>
        </CartLineUpdateButton>
      )}
      <span
        className="text-center"
        aria-label={`Current quantity: ${quantity}`}
      >
        {quantity}
      </span>
      <CartLineUpdateButton lines={[{ id: lineId, quantity: quantity + 1 }]}>
        <button
          className={buttonClassName}
          type="submit"
          value={quantity + 1}
          name="increase-quantity"
          aria-label={`Increase ${productTitle} quantity by 1`}
        >
          <Icon name="circle-plus" className="size-5" />
        </button>
      </CartLineUpdateButton>
    </div>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: { id: string; quantity: number }[];
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{ lines }}
    >
      {children}
    </CartForm>
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
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{ lineIds }}
    >
      {children}
    </CartForm>
  );
}

// Keeping this discount code logic because we might want to add it back

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
