import { type Handle } from "remix/ui";

import { CollectionProductGrid } from "../../assets/public/collection-grid.tsx";
import type {
  ProductCardData,
  ProductPageInfoData,
} from "../../data/storefront.ts";
import { PageTitle } from "../../assets/public/page-title.tsx";
import { Document } from "../../ui/document.tsx";

export function CollectionPage(
  handle: Handle<{
    description: string;
    handle: string;
    pageInfo: ProductPageInfoData;
    products: ProductCardData[];
    title: string;
  }>,
) {
  return () => (
    <Document title={handle.props.title} description={handle.props.description}>
      <main>
        <PageTitle title={handle.props.title} />
        {handle.props.products.length ? (
          <CollectionProductGrid
            action={`/collections/${encodeURIComponent(handle.props.handle)}`}
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
