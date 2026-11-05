import { type Handle } from "remix/component";

import { CollectionViewed } from "../../ui/public/analytics.tsx";
import { CollectionProducts } from "../../ui/collection-products.tsx";
import type {
  ProductCardData,
  ProductPageInfoData,
} from "../../data/public/types.ts";
import { PageTitle } from "../../ui/public/page-title.tsx";
import { Document } from "../../ui/document.tsx";
import { shellMarket } from "../../ui/shell-data-provider.tsx";

// The grid shows up to three columns below 2000px wide.
const FIRST_ROW_PRODUCTS = 3;

export function CollectionPage(
  handle: Handle<{
    canonicalUrl: string;
    description: string;
    handle: string;
    id: string;
    pageInfo: ProductPageInfoData;
    products: ProductCardData[];
    /** The document title, when it differs from the visible heading. */
    seoTitle?: string | null;
    title: string;
  }>,
) {
  return () => (
    <Document
      canonicalUrl={handle.props.canonicalUrl}
      title={handle.props.seoTitle || handle.props.title}
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
          <CollectionProducts
            collectionHandle={handle.props.handle}
            eagerImageCount={FIRST_ROW_PRODUCTS}
            pathPrefix={shellMarket(handle).pathPrefix}
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
