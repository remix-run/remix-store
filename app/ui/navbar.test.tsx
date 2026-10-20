import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../testing/storefront.ts";

describe("navbar", () => {
  it("prefetches only menu links that lead to catalog pages", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: () => ({
          ...navigationData(),
          menu: {
            items: [
              { id: "all", title: "All", url: "/collections/all" },
              { id: "ca", title: "Canada", url: "/en-ca/collections/apparel" },
              { id: "tee", title: "Tee", url: "/products/remix-tee" },
              { id: "policy", title: "Policy", url: "/policies/refund" },
              { id: "sale", title: "Sale", url: "/discount/LAUNCH" },
              { id: "cart", title: "Cart", url: "/cart/111:1" },
              {
                id: "ext",
                title: "Blog",
                url: "https://remix.run/collections",
              },
            ],
          },
        }),
      }),
    );

    let response = await app.fetch(
      new Request(`https://example.com${routes.subscribe.index.href()}`),
    );
    let html = await response.text();

    for (let nav of [
      /<nav aria-label="Main navigation"[\s\S]*?<\/nav>/,
      /<nav id="mobile-navigation"[\s\S]*?<\/nav>/,
    ]) {
      let links = html.match(nav)?.[0].match(/<a [^>]*>[^<]*/g) ?? [];
      let prefetched = links
        .filter((link) => link.includes('data-rmx-prefetch="intent"'))
        .map((link) => link.slice(link.indexOf(">") + 1));
      assert.deepEqual(prefetched, ["All", "Canada", "Tee"]);
    }
  });
});
