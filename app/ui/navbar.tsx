import { css, type Handle } from "remix/ui";

import { CartShell } from "../assets/public/cart.tsx";
import { MobileMenu, RemixLogo } from "../assets/public/navbar.tsx";
import type { CartInitialData } from "../data/cart.ts";
import { marketPath, type ActiveMarket } from "../lib/public/market.ts";
import type {
  NavigationMenuData,
  StoreWideSaleData,
} from "../data/storefront.ts";
import { StoreWideSaleMarquee } from "./store-wide-sale.tsx";

interface NavbarProps {
  cartInitialData?: CartInitialData;
  market: ActiveMarket;
  menu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
}

export function Navbar(handle: Handle<NavbarProps>) {
  return () => (
    <>
      {handle.props.storeWideSale ? (
        <StoreWideSaleMarquee
          locale={handle.props.market.locale}
          sale={handle.props.storeWideSale}
        />
      ) : null}
      <header mix={navbarStyle}>
        <a
          href={marketPath("/", handle.props.market.pathPrefix)}
          aria-label="Remix Store home"
          mix={homeLinkStyle}
        >
          <RemixLogo />
        </a>

        <nav aria-label="Main navigation" mix={desktopNavStyle}>
          <ul>
            {handle.props.menu.items.map((item) => (
              <li key={item.id}>
                <a href={item.url}>{item.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div mix={actionsStyle}>
          <MobileMenu menu={handle.props.menu} />
          <CartShell
            initialData={handle.props.cartInitialData}
            automaticDiscountLabel={handle.props.storeWideSale?.title}
            market={handle.props.market}
          />
        </div>
      </header>
    </>
  );
}

const navbarStyle = css({
  alignItems: "center",
  background: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  left: 0,
  maxHeight: "var(--header-height)",
  padding: "16px",
  position: "fixed",
  right: 0,
  top: "var(--store-wide-sale-height)",
  width: "100%",
  zIndex: 10,
  "@media (min-width: 810px)": {
    gridTemplateColumns: "1fr auto 1fr",
    padding: "36px",
  },
});

const homeLinkStyle = css({
  display: "flex",
  justifyContent: "flex-start",
  maxWidth: "fit-content",
});

const desktopNavStyle = css({
  display: "none",
  justifyContent: "center",
  "& ul": {
    alignItems: "center",
    display: "flex",
    flexWrap: "nowrap",
    gap: "20px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  "& a": {
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.25,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  "@media (min-width: 810px)": { display: "flex" },
  "@media (min-width: 1400px)": { "& ul": { gap: "28px" } },
  "@media (min-width: 1640px)": { "& ul": { gap: "36px" } },
});

const actionsStyle = css({
  alignItems: "center",
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
  "@media (min-width: 810px)": { gap: "12px" },
});
