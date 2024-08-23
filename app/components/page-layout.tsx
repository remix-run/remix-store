import { Await } from "@remix-run/react";
import { Suspense } from "react";
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from "storefrontapi.generated";
import { Aside } from "~/components/aside";
import { Footer } from "~/components/footer";
import { Header, HeaderMenuMobile } from "~/components/header";
import { CartMain } from "~/components/cart";
import {
  PredictiveSearchForm,
  PredictiveSearchResults,
} from "~/components/search";

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
}: PageLayoutProps) {
  return (
    <div className="px-3 sm:px-9">
      <CartAside cart={cart} />
      {/* <SearchAside /> */}

      {header.menu && (
        <>
          <Header menu={header.menu} cart={cart} isLoggedIn={isLoggedIn} />
          <MobileMenuAside menu={header.menu} />
        </>
      )}
      <main>{children}</main>
      <Footer footer={footer} />
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
// - Make header sticky
// - Add filter and sorting header

function MobileMenuAside({ menu }: { menu: NonNullable<HeaderQuery["menu"]> }) {
  return (
    <Aside type="mobile" heading="MENU" direction="left">
      <div className="flex h-full w-full flex-col gap-4">
        <HeaderMenuMobile menu={menu} />
      </div>
    </Aside>
  );
}
