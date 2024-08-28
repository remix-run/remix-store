import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from "storefrontapi.generated";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";

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
      {/* <CartAside cart={cart} /> */}
      {/* <SearchAside /> */}

      {header.menu && (
        <>
          <Header menu={header.menu} cart={cart} isLoggedIn={isLoggedIn} />
          {/* <MobileMenuAside menu={header.menu} /> */}
        </>
      )}
      <main>{children}</main>
      <Footer footer={footer} />
    </div>
  );
}
