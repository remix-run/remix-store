import type { CSSProperties } from "react";
import { Suspense } from "react";
import { Await, NavLink } from "@remix-run/react";
import { type CartViewPayload, useAnalytics } from "@shopify/hydrogen";
import type {
  HeaderQuery,
  CartApiQueryFragment,
} from "storefrontapi.generated";
import { useAside } from "~/components/Aside";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "~/lib";

import Icon from "./Icon";
import { TitleLogo } from "./TitleLogo";
import { Button } from "./ui/button";

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
  return (
    <header
      className={cn(
        "sticky flex items-center justify-between",
        "px-9 pb-5 pt-7",
        "bg-neutral-200 dark:bg-neutral-800",
        "text-neutral-800 dark:text-white",
      )}
    >
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      />
      <NavLink
        prefetch="intent"
        to="/"
        style={activeLinkStyle}
        className="flex-grow text-center"
        end
      >
        <TitleLogo />
      </NavLink>
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps["header"]["menu"];
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
      <HeaderMenuMobileToggle />
      <nav
        className={cn({
          "flex gap-4": true,
          "flex-col": viewport === "mobile",
          "hidden flex-row sm:flex": viewport === "desktop",
        })}
        role="navigation"
      >
        {viewport === "mobile" && (
          <NavLink
            end
            onClick={closeAside}
            prefetch="intent"
            style={activeLinkStyle}
            to="/"
          >
            Home
          </NavLink>
        )}
        {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
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
                style={activeLinkStyle}
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

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, "isLoggedIn" | "cart">) {
  return (
    <div className="ml-auto flex items-center gap-4" role="navigation">
      <Button size="icon">
        <Icon name="globe" aria-label="currency" />
      </Button>
      <CartToggle cart={cart} />
    </div>
  );
}

function HeaderMenuMobileToggle() {
  const { open } = useAside();
  return (
    <button className="sm:hidden" onClick={() => open("mobile")}>
      <h3>☰</h3>
    </button>
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

const FALLBACK_HEADER_MENU = {
  id: "gid://shopify/Menu/199655587896",
  items: [
    {
      id: "gid://shopify/MenuItem/461609500728",
      resourceId: null,
      tags: [],
      title: "Collections",
      type: "HTTP",
      url: "/collections",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461609533496",
      resourceId: null,
      tags: [],
      title: "Blog",
      type: "HTTP",
      url: "/blogs/journal",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461609566264",
      resourceId: null,
      tags: [],
      title: "Policies",
      type: "HTTP",
      url: "/policies",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461609599032",
      resourceId: "gid://shopify/Page/92591030328",
      tags: [],
      title: "About",
      type: "PAGE",
      url: "/pages/about",
      items: [],
    },
  ],
};

function activeLinkStyle({ isActive }: { isActive: boolean }) {
  return {
    fontWeight: isActive ? "bold" : undefined,
    pointerEvents: isActive ? "none" : undefined,
  } satisfies CSSProperties;
}
