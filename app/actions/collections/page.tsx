import { type Handle } from "remix/ui";

import { CollectionViewed } from "../../assets/public/analytics.tsx";
import { CollectionProductGrid } from "../../assets/public/collection-grid.tsx";
import type {
  ProductCardData,
  ProductPageInfoData,
} from "../../data/storefront.ts";
import { PageTitle } from "../../assets/public/page-title.tsx";
import { marketPath, type ActiveMarket } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";

export function CollectionPage(
  handle: Handle<{
    canonicalUrl: string;
    description: string;
    handle: string;
    id: string;
    market: ActiveMarket;
    pageInfo: ProductPageInfoData;
    products: ProductCardData[];
    title: string;
  }>,
) {
  return () => (
    <Document
      canonicalUrl={handle.props.canonicalUrl}
      title={handle.props.title}
      description={handle.props.description}
      socialImage="/social-collections.jpg"
    >
      <main>
        <CollectionViewed
          key={handle.props.id}
          collection={{ id: handle.props.id, handle: handle.props.handle }}
        />
        <PageTitle title={handle.props.title} />
        {handle.props.products.length ? (
          <CollectionProductGrid
            action={marketPath(
              routes.collections.show.href({ handle: handle.props.handle }),
              handle.props.market.pathPrefix,
            )}
            pathPrefix={handle.props.market.pathPrefix}
            products={handle.props.products}
            pageInfo={handle.props.pageInfo}
          />
        ) : (
          <p
            style={{
              margin: 0,
              minHeight: "45vh",
              padding: "64px 20px",
              textAlign: "center",
            }}
          >
            No products found in this collection.
          </p>
        )}
      </main>
    </Document>
  );
}
