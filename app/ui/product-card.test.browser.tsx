import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import type { ProductCardData } from "../data/storefront.ts";
import { ProductCard } from "../assets/public/product-card.tsx";

describe("product cards", () => {
  it("presents the compare-at price as superseded when a product is on sale", (t) => {
    let product: ProductCardData = {
      compareAtPrice: "$30.00",
      handle: "racing-shirt",
      id: "shirt",
      images: [],
      isOnSale: true,
      price: "$20.00",
      title: "Racing shirt",
    };
    let { $, cleanup } = render(<ProductCard product={product} />);
    t.after(cleanup);

    let compareAtPrice = $("s");
    let currentPrice = $("s + span");
    assert.equal(compareAtPrice?.textContent, "$30.00");
    assert.equal(currentPrice?.textContent, "$20.00");
  });
});
