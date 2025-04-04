import { useEffect, useRef, useState } from "react";
import type { NavLinkProps } from "@remix-run/react";
import { Link, NavLink } from "@remix-run/react";
import { type CartViewPayload, useAnalytics } from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { ThemeToggle } from "~/components/theme-toggle";
import { Icon } from "~/components/icon";
import type { IconName } from "~/components/icon/types.generated";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { useHydrated } from "~/lib/hooks";
import { cn } from "~/lib/cn";
import {
  Aside,
  AsideBody,
  AsideContent,
  AsideDescription,
  AsideHeader,
  AsideTitle,
  AsideTrigger,
  useAside,
} from "~/components/ui/aside";
import { CartMain } from "~/components/cart";
import { clsx } from "clsx";
import { AnimatedLink } from "~/components/ui/animated-link";
import { RemixLogo } from "~/components/remix-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { CartForm } from "@shopify/hydrogen";

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

      <CartButton cart={cart} />
    </header>
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

function CartCTA({
  children,
  className,
  iconName,
  expandedText,
}: {
  children: React.ReactNode;
  className?: string;
  iconName: IconName;
  expandedText: string;
}) {
  const linkClasses = cn(
    "group relative flex h-12 items-center justify-center gap-2 rounded-[54px] bg-white px-5 py-2 text-center text-base font-semibold text-black no-underline md:h-16 md:gap-2.5 md:px-6 md:py-4 md:text-xl pl-5 pr-4 md:pl-6 md:pr-5",
    "data-[state=open]:bg-blue-brand data-[state=open]:text-white",
    className,
  );

  return (
    <button type="button" className={linkClasses}>
      <Icon
        name={iconName}
        className="size-6 md:size-8"
        fill="currentColor"
        aria-hidden="true"
      />
      <span className="flex gap-1">
        <span>{children}</span>
        <span
          className={cn(
            "overflow-hidden pr-0 whitespace-nowrap transition-all duration-300 ease-in-out",
            "max-w-0 group-hover:max-w-[10ch] group-hover:pr-1",
            "group-data-[state=open]:max-w-[10ch] group-data-[state=open]:pr-1",
          )}
        >
          {expandedText}
        </span>
      </span>
    </button>
  );
}

function CartButton({ cart }: Pick<HeaderProps, "cart">) {
  let totalQuantity = cart?.totalQuantity || 0;
  const { publish, shop } = useAnalytics();

  if (totalQuantity === 0) {
    return (
      <div className="flex justify-end">
        <AnimatedLink
          to="/collections/all"
          iconName="cart"
          animationType="text"
          expandedText="All"
        >
          Shop
        </AnimatedLink>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="group">
          <div>
            <CartCTA
              iconName="cart"
              expandedText={`Item${totalQuantity > 1 ? "s" : ""}`}
              className="bg-blue-brand text-white"
            >
              {totalQuantity}
              <span className="sr-only">in cart</span>
            </CartCTA>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[400px] bg-[#4475F2] p-6 text-white"
        >
          <div className="flex items-start justify-between">
            <h2 className="font-title text-[2rem] leading-[0.95]">
              {totalQuantity} ITEMS
              <br />
              IN CART
            </h2>
            <button className="rounded-full p-1 hover:bg-white/10">
              <Icon name="x" className="size-6" />
            </button>
          </div>
          <div className="mt-8 space-y-8">
            {cart?.lines?.nodes.map((line) => {
              const { id, quantity } = line;
              const prevQuantity = Math.max(0, quantity - 1);

              return (
                <div key={id} className="flex gap-4">
                  <div className="h-24 w-24 shrink-0 rounded-2xl bg-white p-2">
                    {line.merchandise.image && (
                      <img
                        src={line.merchandise.image.url}
                        alt={line.merchandise.image.altText || ""}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-title text-[1.75rem] leading-tight">
                          {line.merchandise.product.title}
                        </h3>
                        <p className="text-xl text-white/80">
                          {line.merchandise.title !== "Default Title" &&
                            line.merchandise.title}
                        </p>
                      </div>
                      <p className="font-title text-[1.75rem]">
                        ${Number(line.cost.totalAmount.amount).toFixed(2)}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      {quantity === 1 ? (
                        <CartLineRemoveButton lineIds={[id]}>
                          <button
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                            type="submit"
                          >
                            <Icon name="minus" className="size-5" />
                          </button>
                        </CartLineRemoveButton>
                      ) : (
                        <CartLineUpdateButton
                          lines={[{ id, quantity: prevQuantity }]}
                        >
                          <button
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                            type="submit"
                            value={prevQuantity}
                            name="decrease-quantity"
                          >
                            <Icon name="minus" className="size-5" />
                          </button>
                        </CartLineUpdateButton>
                      )}
                      <span className="w-8 text-center text-xl">
                        {quantity}
                      </span>
                      <CartLineUpdateButton
                        lines={[{ id, quantity: quantity + 1 }]}
                      >
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                          type="submit"
                          value={quantity + 1}
                          name="increase-quantity"
                        >
                          <Icon name="plus" className="size-5" />
                        </button>
                      </CartLineUpdateButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between border-t border-white/20 pt-6">
              <h3 className="font-title text-[2rem]">SUBTOTAL</h3>
              <p className="font-title text-[2rem]">
                ${Number(cart?.cost?.subtotalAmount?.amount || 0).toFixed(2)}
              </p>
            </div>
            <p className="text-center text-lg text-white/80">
              Taxes & Shipping calculated at checkout
            </p>
            {cart?.checkoutUrl && (
              <a
                href={cart.checkoutUrl}
                className="font-title mt-6 flex w-full items-center justify-center gap-1 rounded-full bg-white py-4 text-[1.75rem] text-black hover:bg-white/90"
              >
                Check out
                <Icon name="fast-forward" className="size-6" />
              </a>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type HeaderMenuProps = Pick<HeaderProps, "menu">;

function HeaderMenu({ menu }: HeaderMenuProps) {
  return (
    <>
      <div className="flex-1 md:hidden">
        <HeaderMenuMobileToggle menu={menu} />
      </div>
      <nav className="hidden flex-1 md:flex md:gap-3" role="navigation">
        {menu.items.map((item) => {
          if (!item.url) return null;
          return (
            <HeaderMenuLink key={item.id} title={item.title} url={item.url} />
          );
        })}
        <ThemeToggle display="icon" />
      </nav>
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
      className="text-base leading-tight font-semibold text-white no-underline hover:font-bold hover:text-white"
      to={url}
    >
      {props.title}
    </NavLink>
  );
}

function HeaderMenuMobileToggle({ menu }: HeaderMenuProps) {
  // force the drawer closed via a full page navigation
  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = event.currentTarget.href;
  }

  return (
    <Aside>
      <AsideTrigger asChild>
        <Button size="icon" className="md:hidden">
          <Icon name="menu" aria-label="navigation menu" />
        </Button>
      </AsideTrigger>
      <AsideContent side="left">
        <AsideHeader>
          <AsideTitle>Menu</AsideTitle>
        </AsideHeader>
        <AsideDescription className="sr-only">navigation menu</AsideDescription>
        <AsideBody>
          <nav className="flex h-full w-full flex-col gap-4">
            {menu.items.map((item) => {
              if (!item.url) return null;
              return (
                <HeaderMenuMobileLink
                  key={item.id}
                  title={item.title}
                  url={item.url}
                  onClick={closeAside}
                />
              );
            })}
            <ThemeToggle display="button" />
          </nav>
        </AsideBody>
      </AsideContent>
    </Aside>
  );
}

function HeaderMenuMobileLink(props: HeaderMenuLinkProps) {
  const { url } = useRelativeUrl(props.url);

  return (
    <Button size="lg" asChild className="text-left">
      <NavLink to={url} onClick={props.onClick}>
        {props.title}
      </NavLink>
    </Button>
  );
}

function HeaderCartActions({ cart }: Pick<HeaderProps, "cart">) {
  // needs to be a controlled component so we can trigger it from add to cart buttons
  const aside = useAside();

  const count = cart?.totalQuantity || 0;

  return (
    <div className="flex flex-1 gap-3" role="navigation">
      <div className="ml-auto hidden md:block md:w-[150px]">
        {/* TODO: make interactive */}
        <ButtonWithWellText size="icon" wellPrefix="🇺🇸 USD">
          <Icon name="globe" aria-label="change currency" />
        </ButtonWithWellText>
      </div>
      <div className="ml-auto flex md:ml-0">
        <Aside
          open={aside.type === "cart"}
          onOpenChange={(open) => aside.open(open ? "cart" : "none")}
        >
          <AsideTrigger>
            <CartBadge count={count} />
          </AsideTrigger>
          <AsideContent>
            <AsideHeader>
              <AsideTitle>Your Cart</AsideTitle>
            </AsideHeader>
            <AsideBody>
              <CartMain cart={cart!} layout="aside" />
            </AsideBody>
          </AsideContent>
        </Aside>
      </div>
    </div>
  );
}

function CartBadge({ count }: { count: number }) {
  const { publish, shop, cart, prevCart } = useAnalytics();
  const isHydrated = useHydrated();

  const inner = (
    <div className="flex gap-2">
      <Icon name="bag" className="text-inherit" aria-label="cart" /> {count}
    </div>
  );

  return (
    <Button
      asChild
      intent={count > 0 ? "primary" : "secondary"}
      onClick={() => {
        publish("cart_viewed", {
          cart,
          prevCart,
          shop,
          url: window.location.href || "",
        } as CartViewPayload);
      }}
    >
      {
        // clicking the button before hydration will navigate to the cart page
        !isHydrated ? <a href="/cart">{inner}</a> : inner
      }
    </Button>
  );
}
