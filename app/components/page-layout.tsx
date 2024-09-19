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
  const padding = "px-[var(--main-padding)]";
  return (
    <>
      {header.menu && (
        <Header
          className={padding}
          menu={header.menu}
          cart={cart}
          isLoggedIn={isLoggedIn}
        />
      )}
      <main className={padding}>{children}</main>
      <Footer className={padding} footer={footer} />
    </>
  );
}
