import { Await, Link } from "@remix-run/react";
import { Suspense } from "react";
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from "storefrontapi.generated";
import { Aside } from "~/components/aside";
import { Footer } from "~/components/footer";
import { Header, HeaderMenu } from "~/components/header";
import { CartMain } from "~/components/cart";
import {
  PredictiveSearchForm,
  PredictiveSearchResults,
} from "~/components/search";
import { Button } from "./ui/button";
import clsx from "clsx";

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
}: PageLayoutProps) {
  return (
    <div className="px-3 sm:px-9">
      <CartAside cart={cart} />
      {/* <SearchAside /> */}
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <main>{children}</main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </div>
  );
}

function CartAside({ cart }: { cart: PageLayoutProps["cart"] }) {
  return (
    <Aside type="cart" heading="Your Cart">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart!} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function SearchAside() {
  return (
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search">
        <br />
        <PredictiveSearchForm>
          {({ fetchResults, inputRef }) => (
            <div>
              <input
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
              />
              &nbsp;
              <button
                onClick={() => {
                  window.location.href = inputRef?.current?.value
                    ? `/search?q=${inputRef.current.value}`
                    : `/search`;
                }}
              >
                Search
              </button>
            </div>
          )}
        </PredictiveSearchForm>
        <PredictiveSearchResults />
      </div>
    </Aside>
  );
}

// Still need to do
// - Get mobile menu from the data
// - Add theme toggle to mobile menu
// - Make header sticky
// - Add filter and sorting header

function MobileMenuAside({
  header,
  publicStoreDomain,
}: {
  header: PageLayoutProps["header"];
  publicStoreDomain: PageLayoutProps["publicStoreDomain"];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU" direction="left">
        <div className="flex h-full w-full flex-col gap-4">
          {/* TODO: get from the data */}

          <Button size="lg" asChild className="text-left">
            <Link to="/shop">Shop All Items</Link>
          </Button>
          <Button size="lg" asChild className="text-left">
            <Link to="/new">New & Featured</Link>
          </Button>
          <Button size="lg" asChild className="text-left">
            <Link to="/help">Info & Help</Link>
          </Button>
          {/* <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
          /> */}
        </div>
      </Aside>
    )
  );
}
