import { forwardRef, useMemo } from "react";
import { href, Link, NavLink } from "react-router";
import type { NavLinkProps } from "react-router";
import {
  type CartViewPayload,
  Money,
  useAnalytics,
  useOptimisticCart,
} from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { Icon } from "~/components/icon";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { useHydrated } from "~/lib/hooks";
import { cn } from "~/lib/cn";
import { AnimatedLink } from "~/components/ui/animated-link";
import { RemixLogo } from "~/components/remix-logo";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "~/components/ui/popover";
import {
  CartHeader,
  CartLineItem,
  CheckoutLink,
  useCartDiscounts,
} from "./cart";
import { StoreWideSaleMarquee, useStoreWideSale } from "./store-wide-sale";
import { clsx } from "clsx";

interface NavbarProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: CartApiQueryFragment | null;
}

const FREE_SHIPPING_THRESHOLD = 75;

export function Navbar({ menu, cart }: NavbarProps) {
  const saleData = useStoreWideSale();
  const hasActiveSale = Boolean(saleData);

  return (
    <>
      <StoreWideSaleMarquee />
      <header
        className={cn(
          "max-h-(--header-height) bg-linear-to-b fixed z-10 grid w-full grid-cols-2 items-center from-black/100 to-black/0 p-4 md:grid-cols-3 md:p-9",
          hasActiveSale ? "top-10" : "top-0",
        )}
      >
        <Link
          to={href("/")}
          className="flex max-w-fit justify-start"
          prefetch="intent"
        >
          <span className="sr-only">Home</span>
          <RemixLogo animateOnScroll />
        </Link>
        <nav className="hidden justify-center md:flex">
          <ul className="flex flex-nowrap gap-9">
            {menu.items.map((item) => {
              if (!item.url) return null;
              return (
                <li key={item.url} className="text-nowrap">
                  <HeaderMenuLink title={item.title} url={item.url} />
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex justify-end">
          <CartButton cart={cart} />
        </div>
      </header>
    </>
  );
}

type HeaderMenuLinkProps = {
  title: string;
  url: string;
  onClick?: NavLinkProps["onClick"];
};
function HeaderMenuLink(props: HeaderMenuLinkProps) {
  let { url } = useRelativeUrl(props.url);

  return (
    <NavLink
      className="text-base/tight font-semibold no-underline"
      to={url}
      prefetch="intent"
    >
      {props.title}
    </NavLink>
  );
}

function CartButton({ cart: originalCart }: Pick<NavbarProps, "cart">) {
  let cart = useOptimisticCart(originalCart);
  let totalQuantity = cart?.totalQuantity || 0;
  let cartDiscounts = useCartDiscounts(cart);

  if (!cart || totalQuantity === 0) {
    return (
      <>
        <Link
          to="/collections/all"
          className="group relative flex h-12 items-center justify-center gap-2 rounded-[54px] bg-white px-5 py-2 text-center text-base font-semibold text-black no-underline md:hidden"
          prefetch="intent"
        >
          <Icon
            name="cart"
            className="size-6"
            fill="currentColor"
            aria-hidden="true"
          />
          Shop All
        </Link>

        <AnimatedLink
          to="/collections/all"
          iconName="cart"
          animationType="text"
          expandedText="All"
          prefetch="intent"
          className="hidden md:flex"
        >
          Shop
        </AnimatedLink>
      </>
    );
  }

  let lines = cart.lines.nodes;
  let subtotalAmount = cart?.cost?.subtotalAmount;
  let checkoutUrl = cart.checkoutUrl;
  let isOptimistic = Boolean(cart.isOptimistic);

  let onImageClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Is this hacky?
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    });
    e.currentTarget.dispatchEvent(event);
  };

  let subtotal =
    Number(cartDiscounts?.discountedSubtotalAmount?.amount) ||
    Number(subtotalAmount?.amount);

  return (
    <>
      <CartCTALink quantity={totalQuantity} className="flex md:hidden" />

      <Popover>
        <PopoverTrigger asChild className="group">
          <CartCTAButton quantity={totalQuantity} className="hidden md:flex" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="bg-blue-brand rounded-t-4xl min-w-[380px] max-w-min rounded-b-[2.625rem] text-white"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <CartHeader totalQuantity={totalQuantity} />
            <PopoverClose asChild>
              <button
                type="button"
                aria-label="Close cart"
                className="rounded-full p-1 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <Icon name="x" className="size-8" />
              </button>
            </PopoverClose>
          </div>
          <ul className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
            {lines.map((line) => (
              <CartLineItem
                key={line.id}
                isOptimistic={isOptimistic}
                line={line}
                onImageClick={onImageClick}
                layout="cart"
              />
            ))}
          </ul>
          <div className="bg-blue-brand flex w-full flex-col items-start gap-3 rounded-b-[2.625rem] p-4">
            <div className="flex w-full flex-col items-start gap-1">
              <div className="flex w-full items-center justify-between">
                <p className="font-title tracking-tightest text-base font-black uppercase">
                  subtotal
                </p>

                {subtotalAmount ? (
                  <Money
                    className={clsx("text-sm", isOptimistic && "text-white/50")}
                    data={subtotalAmount}
                  />
                ) : null}
              </div>

              {/* Show cart-level discounts */}
              {cartDiscounts?.totalCartDiscount &&
              cartDiscounts?.totalCartDiscount > 0 ? (
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-medium text-green-400">
                    {cartDiscounts?.discountTitle}
                  </p>
                  <p className="text-sm font-medium text-green-400">
                    -${cartDiscounts.totalCartDiscount.toFixed(2)}
                  </p>
                </div>
              ) : null}

              {/* Show total if there are discounts */}
              {cartDiscounts?.discountedSubtotalAmount &&
                cartDiscounts?.totalCartDiscount > 0 && (
                  <div className="flex w-full items-center justify-between border-t border-white/20 pt-1">
                    <p className="font-title tracking-tightest text-base font-black uppercase">
                      Total
                    </p>
                    <Money
                      className={clsx(
                        "text-sm font-bold",
                        isOptimistic && "text-white/50",
                      )}
                      data={cartDiscounts?.discountedSubtotalAmount}
                    />
                  </div>
                )}
              <p className="text-center text-xs text-white">
                {subtotal < FREE_SHIPPING_THRESHOLD
                  ? `Add $${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} more to get free shipping (U.S. only)`
                  : "Free shipping on U.S. orders over $75"}
              </p>
            </div>
            <CheckoutLink
              to={checkoutUrl ?? ""}
              disabled={isOptimistic || !checkoutUrl}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/**
 * The call-to-action button for the cart that shows the current quantity of items.
 * On hover/focus, it reveals additional text indicating "Item(s)" after the quantity.
 *
 * Note: This component has some hacky behavior to handle mobile vs desktop cases:
 * - On mobile: It's always a button (used within Popover)
 * - On desktop: It's a Link before hydration, then becomes a button after
 *
 * This dual behavior exists because:
 * 1. Mobile needs a direct link to the cart page
 * 2. Desktop needs to trigger the popover but a link for non-JS fallback
 */

function CartCTALink({
  quantity,
  className,
}: {
  quantity: number;
  className?: string;
}) {
  let linkClassNames = useCartCTAClassNames(className);

  return (
    <Link
      to={href("/:locale?/cart")}
      className={linkClassNames}
      prefetch="intent"
    >
      <CartCTAInner quantity={quantity} />
    </Link>
  );
}

const CartCTAButton = forwardRef<
  HTMLButtonElement,
  { quantity: number } & React.ComponentPropsWithoutRef<"button">
>(({ quantity, className, ...props }, ref) => {
  let { publish, shop, cart, prevCart } = useAnalytics();
  let isHydrated = useHydrated();

  let buttonClassNames = useCartCTAClassNames(className);

  if (!isHydrated) {
    return <CartCTALink quantity={quantity} className={buttonClassNames} />;
  }

  // After hydration or on desktop, render as a button
  return (
    <button
      type="button"
      className={buttonClassNames}
      onClick={() => {
        publish("cart_viewed", {
          cart,
          prevCart,
          shop,
          url: window.location.href || "",
        } satisfies CartViewPayload);
      }}
      ref={ref}
      {...props}
    >
      <CartCTAInner quantity={quantity} />
    </button>
  );
});

function CartCTAInner({ quantity }: { quantity: number }) {
  return (
    <>
      <Icon
        name="cart"
        className="size-6 md:size-8"
        fill="currentColor"
        aria-hidden="true"
      />
      <span className="flex gap-1">
        <span>{quantity}</span>
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap pr-0 transition-all duration-300 ease-in-out",
            "max-w-0 group-hover:max-w-[10ch] group-hover:pr-1",
            "group-data-[state=open]:max-w-[10ch] group-data-[state=open]:pr-1",
          )}
        >
          {`Item${quantity > 1 ? "s" : ""}`}
          <span className="sr-only">in cart</span>
        </span>
      </span>
    </>
  );
}

function useCartCTAClassNames(className?: string) {
  return useMemo(
    () =>
      cn(
        "group bg-blue-brand relative flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[54px] px-5 py-2 pr-4 pl-5 text-center text-base font-semibold text-white no-underline md:h-16 md:gap-2.5 md:px-6 md:py-4 md:pr-5 md:pl-6 md:text-xl",
        className,
      ),
    [className],
  );
}
