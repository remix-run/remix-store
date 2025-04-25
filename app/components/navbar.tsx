import type { NavLinkProps } from "@remix-run/react";
import { Link, NavLink } from "@remix-run/react";
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
import { CartHeader, CartLineItem, CheckoutLink } from "./cart";
import { clsx } from "clsx";

interface NavbarProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: CartApiQueryFragment | null;
}

export function Navbar({ menu, cart }: NavbarProps) {
  return (
    <header className="fixed top-0 z-10 grid max-h-(--header-height) w-full grid-cols-2 items-center bg-linear-to-b from-black/100 to-black/0 p-4 md:grid-cols-3 md:p-9">
      <Link to="/" className="flex max-w-fit justify-start">
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
  );
}

function CartButton({ cart: originalCart }: Pick<NavbarProps, "cart">) {
  let cart = useOptimisticCart(originalCart);
  let totalQuantity = cart?.totalQuantity || 0;
  let { publish, shop } = useAnalytics();

  if (!cart || totalQuantity === 0) {
    return (
      <AnimatedLink
        to="/collections/all"
        iconName="cart"
        animationType="text"
        expandedText="All"
      >
        Shop
      </AnimatedLink>
    );
  }

  let lines = cart.lines.nodes;
  let subtotalAmount = cart.cost?.subtotalAmount;
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

  return (
    <>
      <div className="block md:hidden">
        <CartCTA isLink quantity={totalQuantity} />
      </div>
      <Popover>
        <PopoverTrigger asChild className="group">
          <div
            // div makes trigger work (dumb) and controls hiding for mobile
            className="hidden md:block"
          >
            <CartCTA quantity={totalQuantity} />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="bg-blue-brand max-h-[80vh] max-w-min min-w-[380px] overflow-y-auto rounded-t-4xl rounded-b-[2.625rem] text-white"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <CartHeader totalQuantity={totalQuantity} />
            <PopoverClose asChild>
              <button
                type="button"
                aria-label="Close cart"
                className="rounded-full p-1 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
              >
                <Icon name="x" className="size-8" />
              </button>
            </PopoverClose>
          </div>
          <ul className="flex flex-col gap-4 px-5 pt-4 pb-44">
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
          <div className="bg-blue-brand absolute bottom-0 flex w-full flex-col items-start gap-3 rounded-b-[2.625rem] p-4">
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
              <p className="text-center text-xs text-white/50">
                Taxes & Shipping calculated at checkout
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
 *
 * @param props.isLink - Whether this should behave as a link (mobile) or button (desktop)
 * @param props.quantity - The number of items in the cart
 */
function CartCTA({
  isLink = false,
  quantity,
}: {
  isLink?: boolean;
  quantity: number;
}) {
  let { publish, shop, cart, prevCart } = useAnalytics();
  let isHydrated = useHydrated();

  let className =
    "group bg-blue-brand relative flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[54px] px-5 py-2 pr-4 pl-5 text-center text-base font-semibold text-white no-underline md:h-16 md:gap-2.5 md:px-6 md:py-4 md:pr-5 md:pl-6 md:text-xl";

  let inner = (
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
            "overflow-hidden pr-0 whitespace-nowrap transition-all duration-300 ease-in-out",
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

  // Before hydration or on mobile, render as a link for non-JS fallback
  if (isLink || !isHydrated) {
    return (
      <Link to="/cart" className={className}>
        {inner}
      </Link>
    );
  }

  // After hydration or on desktop, render as a button
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        publish("cart_viewed", {
          cart,
          prevCart,
          shop,
          url: window.location.href || "",
        } satisfies CartViewPayload);
      }}
    >
      {inner}
    </button>
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
      className="text-base leading-tight font-semibold text-white no-underline hover:font-bold hover:text-white"
      to={url}
    >
      {props.title}
    </NavLink>
  );
}
