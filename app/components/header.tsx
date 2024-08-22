import type { CSSProperties } from "react";
import { Suspense } from "react";
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

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = "desktop" | "mobile";

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const { shop, menu } = header;
  if (!menu) return null;
  return (
    <header
      // TODO: make sticky
      className="z-10 flex h-[var(--header-height)] items-center justify-between"
    >
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      />
      <NavLink prefetch="intent" to="/" className="flex-1 text-center" end>
        <TitleLogo />
      </NavLink>
      <HeaderCartActions isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: NonNullable<HeaderProps["header"]["menu"]>;
  primaryDomainUrl: HeaderProps["header"]["shop"]["primaryDomain"]["url"];
  viewport: Viewport;
  publicStoreDomain: HeaderProps["publicStoreDomain"];
}) {
  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    if (viewport === "mobile") {
      event.preventDefault();
      window.location.href = event.currentTarget.href;
    }
  }

  return (
    <>
      <div className="flex-1 md:hidden">
        <HeaderMenuMobileToggle />
      </div>
      <nav className="hidden flex-1 md:flex md:gap-3" role="navigation">
        {viewport === "mobile" && (
          <NavLink end onClick={closeAside} prefetch="intent" to="/">
            Home
          </NavLink>
        )}
        {/* TODO: should we just remove all this? This seems convoluted */}
        {menu.items.map((item) => {
          if (!item.url) return null;

          // if the url is internal, we strip the domain
          const url =
            item.url.includes("myshopify.com") ||
            item.url.includes(publicStoreDomain) ||
            item.url.includes(primaryDomainUrl)
              ? new URL(item.url).pathname
              : item.url;

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
    </>
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
        <CartToggle cart={cart} />
      </div>
    </div>
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

function CartToggle({ cart }: Pick<HeaderProps, "cart">) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        {(cart) => {
          if (!cart) return <CartBadge count={0} />;
          return <CartBadge count={cart.totalQuantity || 0} />;
        }}
      </Await>
    </Suspense>
  );
}
