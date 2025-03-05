import { useEffect, useRef, useState } from "react";
import type { NavLinkProps } from "@remix-run/react";
import { Link, NavLink } from "@remix-run/react";
import { type CartViewPayload, useAnalytics } from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { ThemeToggle } from "~/components/theme-toggle";
import Icon from "~/components/icon";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { useHydrated } from "~/lib/use-hydrated";
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

interface HeaderProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: CartApiQueryFragment | null;
}

export function Header({ menu, cart }: HeaderProps) {
  return (
    <header className="fixed top-0 z-10 grid w-full grid-cols-3 items-center p-9">
      <Link to="/" className="flex max-w-fit justify-start">
        <span className="sr-only">Home</span>
        <RemixLogo animateOnScroll />
      </Link>
      <nav className="flex justify-center">
        <ul className="flex flex-nowrap gap-9">
          {menu.items.map((item) => {
            if (!item.url) return null;
            return (
              <li key={item.url}>
                <HeaderMenuLink title={item.title} url={item.url} />
              </li>
            );
          })}
        </ul>
      </nav>

      <CartLink cart={cart} />
    </header>
  );
}

function CartLink({ cart }: Pick<HeaderProps, "cart">) {
  let totalQuantity = cart?.totalQuantity || 0;

  return (
    <div className="flex justify-end">
      {totalQuantity > 0 ? (
        <AnimatedLink
          to="cart"
          iconName="cart"
          animationType="text"
          expandedText={`Item${totalQuantity > 1 ? "s" : ""}`}
          className="bg-blue-brand text-white"
        >
          {totalQuantity}
          <span className="sr-only">in cart</span>
        </AnimatedLink>
      ) : (
        <AnimatedLink
          to="/collections/all"
          iconName="cart"
          animationType="text"
          expandedText="All"
          className={clsx({ "bg-blue-brand text-white": totalQuantity > 0 })}
        >
          Shop
        </AnimatedLink>
      )}
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
