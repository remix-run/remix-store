import { css, Frame, type Handle } from "remix/component";

import { LoadMoreProducts } from "../assets/public/load-more-products.tsx";
import { ProductCard } from "../assets/public/product-card.tsx";
import type {
  ProductCardData,
  ProductPageInfoData,
} from "../data/storefront.ts";
import { marketPath, type MarketPathPrefix } from "../lib/public/market.ts";
import { routes } from "../routes.ts";

interface ProductPageProps {
  collectionHandle: string;
  /** Leading cards whose images load eagerly; the first is fetched first. */
  eagerImageCount?: number;
  pageInfo: ProductPageInfoData;
  pathPrefix: MarketPathPrefix;
  products: ProductCardData[];
}

/** A collection's first page of cards. Later pages load into nested frames. */
export function CollectionProducts(handle: Handle<ProductPageProps>) {
  return () => (
    <section aria-label="Collection products">
      <ul mix={productGridStyle}>
        <ProductPage {...handle.props} />
      </ul>
    </section>
  );
}

/**
 * Grid items for one page, ending in a lazy frame for the next page. The
 * frame loads as it approaches the viewport; until then, and without
 * JavaScript, its fallback is the "Load more" control.
 */
export function ProductPage(handle: Handle<ProductPageProps>) {
  return () => {
    let {
      collectionHandle,
      eagerImageCount = 0,
      pageInfo,
      pathPrefix,
      products,
    } = handle.props;
    return (
      <>
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard
              pathPrefix={pathPrefix}
              product={product}
              loading={index < eagerImageCount ? "eager" : "lazy"}
              fetchPriority={
                index === 0 && eagerImageCount > 0 ? "high" : undefined
              }
            />
          </li>
        ))}
        {pageInfo.hasNextPage && pageInfo.endCursor ? (
          <Frame
            src={collectionPageHref(
              collectionHandle,
              pageInfo.endCursor,
              pathPrefix,
            )}
            loading="lazy"
            fallback={loadMoreControl(
              collectionHandle,
              pageInfo.endCursor,
              pathPrefix,
            )}
          />
        ) : null}
      </>
    );
  };
}

/** The grid fragment for the page of products after `cursor`. */
export function collectionPageHref(
  collectionHandle: string,
  cursor: string,
  pathPrefix: MarketPathPrefix,
): string {
  let href = routes.collections.products.href({ handle: collectionHandle });
  return `${marketPath(href, pathPrefix)}?${new URLSearchParams({ cursor })}`;
}

/**
 * The "Load more" control for the page after `cursor`: a GET form for the
 * collection document without JavaScript, and a frame reload with it.
 */
export function loadMoreControl(
  collectionHandle: string,
  cursor: string,
  pathPrefix: MarketPathPrefix,
  failed = false,
) {
  return (
    <LoadMoreProducts
      action={marketPath(
        routes.collections.show.href({ handle: collectionHandle }),
        pathPrefix,
      )}
      cursor={cursor}
      failed={failed}
      src={collectionPageHref(collectionHandle, cursor, pathPrefix)}
    />
  );
}

const productGridStyle = css({
  background: "linear-gradient(in oklab, #2d2d38 0%, var(--color-black) 100%)",
  display: "grid",
  gap: "36px 0",
  gridTemplateColumns: "minmax(0, 1fr)",
  listStyle: "none",
  margin: 0,
  padding: 0,
  "& > li": { minWidth: 0 },
  // Production ends the last page with one more row gap before the footer.
  "&:has(> li:last-child > article)": { paddingBottom: "36px" },
  "@media (min-width: 810px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  "@media (min-width: 1400px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  "@media (min-width: 2000px)": {
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  },
  "@media (min-width: 2700px)": {
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  },
});
