import { css, type Handle } from "remix/ui";

import { CartPageContent } from "../assets/public/cart.tsx";
import { CollectionProductGrid } from "../assets/public/collection-grid.tsx";
import { HomeHero } from "../assets/public/home-hero.tsx";
import { SnowField } from "../assets/public/snow-field.tsx";
import type { CartInitialData } from "../data/cart.ts";
import type {
  HomeHeroData,
  HomeLookbookEntryData,
  ProductCardData,
  ProductMoney,
  ProductPageInfoData,
} from "../data/storefront.ts";
import { focalPointPosition } from "../lib/image-utils.ts";
import { marketPath, type ActiveMarket } from "../lib/public/market.ts";
import { routes } from "../routes.ts";
import { BrandedState } from "../ui/public/branded-state.tsx";
import { Document } from "../ui/document.tsx";
import { ShellDataProvider } from "../ui/shell-data.tsx";
import { PillIcon, pillLinkStyle } from "../ui/public/pill-link.tsx";
import { ShopifyImage } from "../ui/public/shopify-image.tsx";

export function HomePage(
  handle: Handle<{
    canonicalUrl: string;
    description?: string | null;
    hero: HomeHeroData | null;
    lookbookEntries: HomeLookbookEntryData[];
    market: ActiveMarket;
    pageInfo: ProductPageInfoData;
    products: ProductCardData[];
    shopName: string;
    showSeasonalSnow: boolean;
  }>,
) {
  return () => {
    let { hero, lookbookEntries } = handle.props;
    let [firstEntry, ...remainingEntries] = lookbookEntries;
    let collectionHandle = hero?.collectionHandle ?? "all";

    return (
      <Document
        canonicalUrl={handle.props.canonicalUrl}
        title={handle.props.shopName}
        description={handle.props.description ?? undefined}
      >
        {handle.props.showSeasonalSnow ? <SnowField /> : null}
        <main>
          <HomeHero
            assetImages={hero?.assetImages ?? []}
            collectionHref={marketPath(
              routes.collections.show.href({ handle: collectionHandle }),
              handle.props.market.pathPrefix,
            )}
            heading="Remix 3 Racing Team Collection"
            cta="Shop New Items"
          />
          <div mix={editorialStyle}>
            {firstEntry ? (
              <LookbookEntry entry={firstEntry} market={handle.props.market} />
            ) : null}
            <RunnerPanel />
            {remainingEntries.map((entry) => (
              <LookbookEntry
                key={entry.id}
                entry={entry}
                market={handle.props.market}
              />
            ))}
            {handle.props.products.length ? (
              <div data-home-catalog="true" mix={homeCatalogStyle}>
                <CollectionProductGrid
                  action={marketPath(
                    routes.collections.show.href({ handle: "all" }),
                    handle.props.market.pathPrefix,
                  )}
                  pathPrefix={handle.props.market.pathPrefix}
                  products={handle.props.products}
                  pageInfo={handle.props.pageInfo}
                />
              </div>
            ) : null}
          </div>
        </main>
      </Document>
    );
  };
}

function LookbookEntry(
  handle: Handle<{ entry: HomeLookbookEntryData; market: ActiveMarket }>,
) {
  return () => {
    let { entry } = handle.props;
    let { product } = entry;
    let price = product
      ? lookbookPrice(product.price, handle.props.market.locale)
      : null;

    return (
      <section aria-label={product?.title ?? "Coming soon"} mix={lookbookStyle}>
        <div aria-hidden="true" mix={lookbookImageStyle}>
          <ShopifyImage
            image={entry.image}
            alt=""
            sizes="100vw"
            objectPosition={focalPointPosition(entry.focalPoint ?? undefined)}
          />
        </div>
        {product && price ? (
          <a
            href={marketPath(
              `/products/${encodeURIComponent(product.handle)}`,
              handle.props.market.pathPrefix,
            )}
            aria-label={`${product.title}, ${price}`}
            mix={[pillLinkStyle, lookbookLinkStyle]}
          >
            <span aria-hidden="true" data-lookbook-hit-area="true" />
            <PillIcon name="fast-forward" />
            <span>{product.title}</span>
            <span aria-hidden="true" mix={middleDotStyle}>
              ·
            </span>
            <span>{price}</span>
          </a>
        ) : (
          <span
            aria-label="Coming soon"
            mix={[pillLinkStyle, lookbookLinkStyle]}
          >
            <PillIcon name="mail" />
            <span>Coming Soon</span>
          </span>
        )}
      </section>
    );
  };
}

function RunnerPanel() {
  return () => (
    <section aria-label="Remix runner" mix={runnerPanelStyle}>
      <div mix={runnerImageContainerStyle}>
        <img
          src="/brand/remix-runner.svg"
          width="326"
          height="206"
          alt="Silhouette of a runner made of white circles"
          mix={runnerStaticStyle}
        />
        <img
          src="/brand/remix-runner-animated.svg"
          width="326"
          height="206"
          alt=""
          aria-hidden="true"
          mix={runnerAnimatedStyle}
        />
      </div>
    </section>
  );
}

function lookbookPrice(
  price: ProductMoney,
  locale: ActiveMarket["locale"],
): string {
  let amount = Number(price.amount);
  if (!Number.isFinite(amount)) return "Price unavailable";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CartPage(
  handle: Handle<{
    canonicalUrl?: string;
    initialData: CartInitialData;
    market: ActiveMarket;
  }>,
) {
  return () => {
    let storeWideSale = handle.context.get(ShellDataProvider)?.storeWideSale;

    return (
      <Document canonicalUrl={handle.props.canonicalUrl} title="Cart" noIndex>
        <main mix={cartMainStyle}>
          <CartPageContent
            initialData={handle.props.initialData}
            automaticDiscountLabel={storeWideSale?.title}
            market={handle.props.market}
          />
        </main>
      </Document>
    );
  };
}

export function NotFoundPage(handle: Handle) {
  return () => {
    let market = handle.context.get(ShellDataProvider)?.market;
    return (
      <Document title="Not found" noIndex>
        <main>
          <BrandedState
            kind="404"
            heading="Page not found"
            copy="The page you requested does not exist."
            href={marketPath("/", market?.pathPrefix ?? "")}
            icon="fast-forward"
            linkLabel="Return home"
            reverseIcon
          />
        </main>
      </Document>
    );
  };
}

export function ErrorPage(handle: Handle) {
  return () => {
    let market = handle.context.get(ShellDataProvider)?.market;
    return (
      <Document title="Storefront unavailable" noIndex>
        <main>
          <BrandedState
            kind="500"
            heading="Storefront unavailable"
            copy="The storefront could not load. Please try again."
            href={marketPath("/", market?.pathPrefix ?? "")}
            icon="fast-forward"
            linkLabel="Return home"
            reverseIcon
          />
        </main>
      </Document>
    );
  };
}

const cartMainStyle = css({ minHeight: "70vh" });

const editorialStyle = css({ position: "relative" });

const homeCatalogStyle = css({
  background: "linear-gradient(180deg, #2d2d38, var(--color-black))",
  padding: "36px 0",
  "@media (min-width: 810px)": { padding: "48px 0" },
  "@media (min-width: 1400px)": { padding: "64px 0" },
});

const lookbookStyle = css({
  background: "var(--color-black)",
  height: "640px",
  position: "relative",
  "@media (min-width: 810px)": { height: "800px" },
});

const lookbookImageStyle = css({
  inset: 0,
  position: "absolute",
  "& img": {
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
});

const lookbookLinkStyle = css({
  bottom: "20px",
  left: "20px",
  maxWidth: "calc(100vw - 40px)",
  position: "absolute",
  whiteSpace: "nowrap",
  zIndex: 1,
  '& [data-lookbook-hit-area="true"]': {
    bottom: "-20px",
    height: "640px",
    left: "-20px",
    position: "absolute",
    width: "100vw",
  },
  "@media (min-width: 810px)": {
    bottom: "36px",
    left: "36px",
    maxWidth: "calc(100vw - 72px)",
    '& [data-lookbook-hit-area="true"]': {
      bottom: "-36px",
      height: "800px",
      left: "-36px",
    },
  },
});

const middleDotStyle = css({ fontSize: "1.75rem", lineHeight: 0 });

const runnerPanelStyle = css({
  alignItems: "center",
  animation: "runner-brand-background 14s ease-in-out infinite",
  background: "var(--color-blue-brand)",
  display: "flex",
  height: "390px",
  justifyContent: "center",
  "@media (min-width: 810px)": { height: "480px" },
  "@media (min-width: 1400px)": { height: "800px" },
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const runnerImageContainerStyle = css({
  height: "100%",
  position: "relative",
  width: "65%",
  "@media (min-width: 1640px)": { width: "60%" },
  "@media (min-width: 2000px)": { width: "55%" },
  "@media (min-width: 2700px)": { width: "50%" },
  "& img": {
    height: "100%",
    left: "50%",
    maxWidth: "90%",
    objectFit: "contain",
    position: "absolute",
    top: 0,
    transform: "translateX(-50%)",
    width: "100%",
  },
});

const runnerStaticStyle = css({
  display: "none",
  "@media (prefers-reduced-motion: reduce)": { display: "block" },
});

const runnerAnimatedStyle = css({
  display: "block",
  "@media (prefers-reduced-motion: reduce)": { display: "none" },
});
