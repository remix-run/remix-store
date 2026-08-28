import {
  initializeShopifyScripts,
  trackCartAnalytics,
} from "@shopify/hydrogen";
import { navigate as remixNavigate, run } from "remix/ui";

import { createPageViewPublisher } from "../../assets/public/analytics.tsx";
import { getBrowserCartStore } from "../../assets/public/cart-store.ts";
import { configureOpenCartAction } from "../../assets/public/cart.tsx";
import { resolveFrameResponse } from "../../assets/public/frame-resolver.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";
import { routeTemplates } from "../../lib/public/route-templates.ts";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(/* @vite-ignore */ moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, options) {
    return resolveFrameResponse(new URL(src, window.location.href), options);
  },
});

if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error(
        "Error reloading the top frame after a server update:",
        error,
      );
    }
  });
}

app.addEventListener("error", (event) => {
  console.error("Hydration error:", event.error);
});

let publishPageViewed = createPageViewPublisher();
app.frames.top.addEventListener("reloadComplete", publishPageViewed);

await Promise.all([
  app.ready(),
  initializeShopifyScripts({
    routes: routeTemplates,
    navigate(url) {
      remixNavigate(url);
    },
  }),
]);

publishPageViewed();
let pathPrefix = marketPathPrefix(
  document.documentElement.dataset.marketPrefix,
);
let cartStore = getBrowserCartStore(undefined, pathPrefix);
if (cartStore) trackCartAnalytics(cartStore);
configureOpenCartAction();

function marketPathPrefix(value: string | undefined): MarketPathPrefix {
  return value === "/en-ca" ? value : "";
}
