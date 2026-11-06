import { css, type Handle } from "remix/component";

import type { CartInitialData } from "../data/public/cart.ts";
import { Document } from "../ui/document.tsx";
import { CartPageContent } from "../ui/public/cart/cart.tsx";
import { ShellDataProvider, shellMarket } from "../ui/shell-data-provider.tsx";

export function CartPage(
  handle: Handle<{
    canonicalUrl?: string;
    initialData: CartInitialData;
  }>,
) {
  return () => {
    let storeWideSale = handle.context.get(ShellDataProvider)?.storeWideSale;

    return (
      <Document
        canonicalUrl={handle.props.canonicalUrl}
        title={
          handle.props.initialData.cart?.totalQuantity
            ? `Cart (${handle.props.initialData.cart.totalQuantity})`
            : "Cart"
        }
        description="View your shopping cart and checkout"
        noIndex
      >
        <main mix={cartMainStyle}>
          <CartPageContent
            initialData={handle.props.initialData}
            automaticDiscountLabel={storeWideSale?.title}
            market={shellMarket(handle)}
          />
        </main>
      </Document>
    );
  };
}

const cartMainStyle = css({ minHeight: "70vh" });
