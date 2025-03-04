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

interface HeaderProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: CartApiQueryFragment | null;
}

export function Header({ menu, cart }: HeaderProps) {
  return (
    <header className="fixed top-0 z-10 grid w-full grid-cols-3 items-center p-9">
      <Link to="/" className="flex justify-start">
        <span className="sr-only">Home</span>

        <RemixLogo />
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

function RemixLogo() {
  // Start in up direction, as it shows the whole logo
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const lastScrollY = useRef(0);

  useEffect(() => {
    let throttleTimeout: NodeJS.Timeout | null = null;

    let throttle = (callback: () => void, delay: number) => {
      if (throttleTimeout !== null) return;

      throttleTimeout = setTimeout(() => {
        callback();
        throttleTimeout = null;
      }, delay);
    };

    const handleScroll = () => {
      throttle(() => {
        const currentScrollY = window.scrollY;

        let scrollOffset = 20;
        if (currentScrollY > lastScrollY.current + scrollOffset) {
          setScrollDirection("down");
        } else if (currentScrollY < lastScrollY.current - scrollOffset) {
          setScrollDirection("up");
        }

        lastScrollY.current = currentScrollY;
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, []);

  let letterCss = clsx(
    "transform transition-all duration-300 ease-in-out",
    scrollDirection === "down"
      ? "translate-y-[-200px] opacity-0"
      : "translate-y-[0px] opacity-100",
  );

  return (
    <svg width="140px" height="36px" viewBox="0 0 700 180" fill="none">
      <path
        className={clsx("fill-red-brand", letterCss)}
        d="M696.11,51.95h-46.39l-21.11,29.44-20.56-29.44h-49.73l44.73,60.82-48.62,63.04h46.39l24.72-33.61,24.72,33.61h49.73l-48.89-64.99,45-58.88Z"
      />
      <path
        className={clsx("fill-green-brand", letterCss)}
        d="M244.89,131.66c-4.17,9.72-11.95,13.89-24.17,13.89-13.61,0-24.72-7.22-25.84-22.5h86.95v-12.5c0-33.61-21.95-61.93-63.34-61.93-38.61,0-67.51,28.05-67.51,67.21s28.34,63.32,68.06,63.32c32.78,0,55.56-15.83,61.95-44.16l-36.11-3.33ZM195.44,101.39c1.67-11.66,8.06-20.55,22.5-20.55,13.33,0,20.56,9.44,21.11,20.55h-43.62Z"
      />
      <path
        className={clsx("fill-yellow-brand", letterCss)}
        d="M410.33,73.06c-5.28-14.44-16.67-24.44-38.62-24.44-18.61,0-31.95,8.33-38.61,21.94v-18.61h-45v123.87h45v-60.82c0-18.61,5.28-30.83,20-30.83,13.61,0,16.95,8.89,16.95,25.83v65.82h45v-60.82c0-18.61,5-30.83,20-30.83,13.61,0,16.67,8.89,16.67,25.83v65.82h45v-77.76c0-25.83-10-49.44-44.17-49.44-20.83,0-35.56,10.55-42.23,24.44Z"
      />
      <path
        className={clsx("fill-magenta-brand", letterCss)}
        d="M504.93,51.95v123.87h45V51.95h-45ZM504.65,40.29h45.56V.85h-45.56v39.44Z"
      />
      <path
        className={clsx(
          "transition-color transform duration-300 ease-in-out",
          scrollDirection === "down" ? "fill-white" : "fill-blue-brand",
        )}
        d="M145.12,135.55c1.57,20.18,1.57,29.64,1.57,39.97h-46.7c0-2.25.04-4.31.08-6.39.13-6.49.26-13.25-.79-26.91-1.39-20-10-24.44-25.84-24.44H0v-36.38h75.67c20,0,30-6.08,30-22.19,0-14.16-10-22.75-30-22.75H0V.85h84c45.28,0,67.78,21.39,67.78,55.55,0,25.55-15.83,42.21-37.23,44.99,18.06,3.61,28.61,13.89,30.56,34.16ZM0,175.52v-28.08h49.38c8.25,0,10.04,7.07,10.04,10.72v17.36H0Z"
      />
    </svg>
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
      className="hover:text-blue-brand text-base leading-tight font-semibold text-white no-underline"
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
