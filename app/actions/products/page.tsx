import { type Handle } from "remix/ui";

import { ProductDetails } from "../../assets/public/product-details.tsx";
import type { NavigationMenuData, ProductData } from "../../data/storefront.ts";
import { Document } from "../../ui/document.tsx";

export function ProductPage(
  handle: Handle<{
    canonicalUrl: string;
    menu: NavigationMenuData;
    product: ProductData;
    search: string;
  }>,
) {
  return () => {
    let { product } = handle.props;
    let socialImage = product.images.nodes[0]?.url
      ? productSocialImage(product.images.nodes[0].url)
      : undefined;

    return (
      <Document
        canonicalUrl={handle.props.canonicalUrl}
        title={product.seo.title ?? product.title}
        description={product.seo.description ?? product.description}
        socialImage={socialImage}
        socialType="product"
      >
        <main>
          <ProductDetails
            menu={handle.props.menu}
            product={product}
            search={handle.props.search}
            shopPayStoreUrl={new URL(handle.props.canonicalUrl).origin}
          />
        </main>
      </Document>
    );
  };
}

function productSocialImage(source: string): string {
  try {
    let url = new URL(source);
    url.searchParams.set("width", "1200");
    url.searchParams.set("height", "630");
    url.searchParams.set("pad_color", "000000");
    return url.toString();
  } catch {
    return source;
  }
}
