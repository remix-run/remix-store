import { Suspense } from "react";
import type { NavLinkProps } from "@remix-run/react";
import { Await, NavLink } from "@remix-run/react";
import { type CartViewPayload, useAnalytics } from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { useAside } from "~/components/aside";
import { ThemeToggle } from "~/components/theme-toggle";
import Icon from "~/components/icon";
import { TitleLogo } from "~/components/title-logo";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import { useRelativeUrl } from "~/ui/primitives/utils";

interface HeaderProps {
  menu: NonNullable<HeaderQuery["menu"]>;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
}

export function Header({ menu, isLoggedIn, cart }: HeaderProps) {
  return (
    <header
      // TODO: make sticky
      className="z-10 flex h-[var(--header-height)] items-center justify-between"
    >
      <HeaderMenu menu={menu} />
      <NavLink prefetch="intent" to="/" className="flex-1 text-center" end>
        <TitleLogo />
      </NavLink>
      <HeaderCartActions isLoggedIn={isLoggedIn} cart={cart} />
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
        <HeaderMenuMobileToggle />
      </div>
      <nav className="hidden flex-1 md:flex md:gap-3" role="navigation">
        {menu.items.map((item) => {
          if (!item.url) return null;
          return (
            <MobileMenuLink
              key={item.id}
              title={item.title}
              url={item.url}
              onClick={closeAside}
            />
          );
        })}
        <ThemeToggle />
      </nav>
    </>
  );
}

export function HeaderMenuMobile({ menu }: HeaderMenuProps) {
  // force the drawer closed via a full page navigation
  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.href = event.currentTarget.href;
  }

  return (
    <nav className="flex h-full w-full flex-col gap-4">
      <Button size="lg" asChild className="text-left">
        <NavLink prefetch="intent" to="/collections/all" onClick={closeAside}>
          Shop All Items
        </NavLink>
      </Button>
      <Button size="lg" asChild className="text-left">
        <NavLink to="/new" onClick={closeAside}>
          New & Featured
        </NavLink>
      </Button>
      <Button size="lg" asChild className="text-left">
        <NavLink to="/help" onClick={closeAside}>
          Info & Help
        </NavLink>
      </Button>

      {/* TODO: should we just remove all this? This seems convoluted */}
      {menu.items.map((item) => {
        if (!item.url) return null;

        const { url } = useRelativeUrl(item.url);

        let size;
        let contents;
        if (item.title === "Info") {
          contents = (
            <Icon
              name="info"
              aria-label={item.title}
              className="text-inherit"
            />
          );
          size = "icon" as const;
        } else {
          size = "sm" as const;
          contents = item.title;
        }
        return (
          <Button key={item.id} asChild size={size}>
            <NavLink
              className="cursor-pointer uppercase"
              end
              onClick={closeAside}
              prefetch="intent"
              to={url}
            >
              {contents}
            </NavLink>
          </Button>
        );
      })}
      <ThemeToggle />
    </nav>
  );
}

function MobileMenuLink(props: {
  title: string;
  url: string;
  onClick?: NavLinkProps["onClick"];
}) {
  const { url } = useRelativeUrl(props.url);

  let size;
  let contents;
  if (props.title === "Info") {
    contents = (
      <Icon name="info" aria-label={props.title} className="text-inherit" />
    );
    size = "icon" as const;
  } else {
    size = "sm" as const;
    contents = props.title;
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

function HeaderMenuMobileToggle() {
  const { open } = useAside();
  return (
    <Button size="icon" className="md:hidden" onClick={() => open("mobile")}>
      <Icon name="menu" aria-label="navigation menu" />
    </Button>
  );
}

function HeaderCartActions({ cart }: Pick<HeaderProps, "isLoggedIn" | "cart">) {
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
            {(cart) => {
              if (!cart) return <CartBadge count={0} />;
              return <CartBadge count={cart.totalQuantity || 0} />;
            }}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

function CartBadge({ count }: { count: number }) {
  const { open } = useAside();
  const { publish, shop, cart, prevCart } = useAnalytics();

  return (
    <Button asChild intent={count > 0 ? "primary" : "secondary"}>
      <a
        href="/cart"
        className={"flex gap-2"}
        onClick={(e) => {
          e.preventDefault();
          open("cart");
          publish("cart_viewed", {
            cart,
            prevCart,
            shop,
            url: window.location.href || "",
          } as CartViewPayload);
        }}
      >
        <Icon name="bag" className="text-inherit" aria-label="cart" /> {count}
      </a>
    </Button>
  );
}
