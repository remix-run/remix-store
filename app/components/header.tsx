import type { NavLinkProps } from "@remix-run/react";
import { Link, NavLink } from "@remix-run/react";
import {
  type CartViewPayload,
  CartForm,
  useAnalytics,
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

interface HeaderProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: CartApiQueryFragment | null;
}

export function Header({ menu, cart }: HeaderProps) {
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

function CartButton({ cart }: Pick<HeaderProps, "cart">) {
  let totalQuantity = cart?.totalQuantity || 0;
  const { publish, shop } = useAnalytics();

  if (totalQuantity === 0) {
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

  return (
    <>
      <div className="block md:hidden">
        <CartCTA isLink quantity={totalQuantity} />
      </div>
      <Popover>
        <PopoverTrigger asChild className="group">
          {/* div makes trigger work (dumb) and controls hiding for mobile */}
          <div className="hidden md:block">
            <CartCTA quantity={totalQuantity} />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="bg-blue-brand max-w-min min-w-[380px] rounded-t-4xl rounded-b-[2.625rem] text-white"
        >
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="font-title tracking-tightest text-base font-black uppercase">
              {totalQuantity} item(s) in cart
            </h2>
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
          <div className="flex flex-col gap-4 px-5 py-4">
            {cart?.lines?.nodes.map((line) => {
              const { id, quantity } = line;
              const prevQuantity = Math.max(0, quantity - 1);

              return (
                <div key={id} className="flex items-start gap-3">
                  <div className="size-20 shrink-0 rounded-2xl bg-white p-2">
                    {line.merchandise.image && (
                      <img
                        src={line.merchandise.image.url}
                        alt={line.merchandise.image.altText || ""}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 text-sm">
                    <h3 className="font-bold tracking-tight">
                      {line.merchandise.product.title}
                    </h3>
                    <p>
                      {line.merchandise.title !== "Default Title" &&
                        line.merchandise.title}
                    </p>
                    <CartQuantityControls
                      lineId={id}
                      quantity={quantity}
                      productTitle={line.merchandise.product.title}
                    />
                  </div>

                  <p className="text-sm font-bold">
                    ${Number(line.cost.totalAmount.amount).toFixed(0)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="flex w-full items-center justify-between">
              <span className="font-title tracking-tightest text-base font-black uppercase">
                subtotal
              </span>
              <span className="text-sm">
                ${Number(cart?.cost?.subtotalAmount?.amount || 0)}
              </span>
            </p>
            <p className="text-center text-xs text-white/50">
              Taxes & Shipping calculated at checkout
            </p>
            {cart?.checkoutUrl ? <CheckoutLink to={cart.checkoutUrl} /> : null}
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
  const isHydrated = useHydrated();

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

// TODO: make optimistic

function CartQuantityControls({
  lineId,
  quantity,
  productTitle,
}: {
  lineId: string;
  quantity: number;
  productTitle: string;
}) {
  const prevQuantity = quantity - 1;

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

function CheckoutLink({ to }: { to: string }) {
  return (
    <a
      href={to}
      className="group hover:bg-blue-brand flex w-full items-center justify-center rounded-[54px] bg-white px-6 py-4 text-xl font-semibold text-black no-underline transition-colors duration-300 hover:text-white"
    >
      <div className="flex w-0 min-w-fit items-center justify-between gap-2.5 transition-[width] duration-300 ease-in-out group-hover:w-full">
        <span>Check out</span>
        <Icon
          name="fast-forward"
          className="size-8"
          fill="currentColor"
          aria-hidden="true"
        />
      </div>
    </a>
  );
}
