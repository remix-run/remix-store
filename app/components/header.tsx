import { Suspense } from "react";
import type { NavLinkProps } from "@remix-run/react";
import { Await, NavLink } from "@remix-run/react";
import { type CartViewPayload, useAnalytics } from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { ThemeToggle } from "~/components/theme-toggle";
import Icon from "~/components/icon";
import { TitleLogo } from "~/components/title-logo";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import { useHydrated, useRelativeUrl } from "~/ui/primitives/utils";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { CartMain } from "./cart";

interface HeaderProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
}

export function Header({ menu, cart }: HeaderProps) {
  return (
    <header
      // TODO: make sticky
      className="flex h-[var(--header-height)] items-center justify-between"
    >
      <HeaderMenu menu={menu} />
      <NavLink prefetch="intent" to="/" className="flex-1 text-center" end>
        <TitleLogo />
      </NavLink>
      <HeaderCartActions cart={cart} />
    </header>
  );
}

type HeaderMenuProps = Pick<HeaderProps, "menu">;

export function HeaderMenu({ menu }: HeaderMenuProps) {
  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = event.currentTarget.href;
  }

  return (
    <>
      <div className="flex-1 md:hidden">
        <HeaderMenuMobileToggle menu={menu} />
      </div>
      <nav className="hidden flex-1 md:flex md:gap-3" role="navigation">
        {menu.items.map((item) => {
          if (!item.url) return null;
          return (
            <HeaderMenuLink
              key={item.id}
              title={item.title}
              url={item.url}
              onClick={closeAside}
            />
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
  const { url } = useRelativeUrl(props.url);

  // Not my favorite, honestly might be better to just hardcode this data
  // and not get it as data from Shopify
  let size;
  let contents;
  if (props.title.toLowerCase().startsWith("info")) {
    contents = (
      <Icon name="info" aria-label={props.title} className="text-inherit" />
    );
    size = "icon" as const;
  } else {
    size = "sm" as const;
    contents = props.title.split(" ")[0];
  }

  return (
    <Button asChild size={size}>
      <NavLink
        className="cursor-pointer uppercase"
        end
        onClick={props.onClick}
        prefetch="intent"
        to={url}
      >
        {contents}
      </NavLink>
    </Button>
  );
}

function HeaderMenuMobileToggle({ menu }: HeaderMenuProps) {
  // force the drawer closed via a full page navigation
  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = event.currentTarget.href;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" className="md:hidden">
          <Icon name="menu" aria-label="navigation menu" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <SheetDescription className="sr-only">navigation menu</SheetDescription>
        <SheetBody>
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
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function HeaderMenuMobileLink(props: HeaderMenuLinkProps) {
  const { url } = useRelativeUrl(props.url);

  return (
    <Button size="lg" asChild className="text-left">
      <NavLink
        // prefetch="intent"
        to={url}
        onClick={props.onClick}
      >
        {props.title}
      </NavLink>
    </Button>
  );
}

function HeaderCartActions({ cart }: Pick<HeaderProps, "cart">) {
  return (
    <div className="flex flex-1 gap-3" role="navigation">
      <div className="ml-auto hidden md:block">
        {/* TODO: make interactive */}
        <ButtonWithWellText size="icon" wellPrefix="🇺🇸 USD">
          <Icon name="globe" aria-label="change currency" />
        </ButtonWithWellText>
      </div>
      <div className="ml-auto md:ml-0">
        <Suspense fallback={<CartBadge count={0} />}>
          <Await resolve={cart}>
            {(cart) => (
              <Sheet>
                <SheetTrigger>
                  <CartBadge count={cart?.totalQuantity || 0} />
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Your Cart</SheetTitle>
                  </SheetHeader>
                  <SheetDescription className="sr-only">
                    Your cart with {cart?.totalQuantity} items
                  </SheetDescription>
                  <SheetBody>
                    <CartMain cart={cart!} layout="aside" />
                  </SheetBody>
                </SheetContent>
              </Sheet>
            )}
          </Await>
        </Suspense>
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
