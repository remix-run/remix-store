import {
  initializeShopifyScripts,
  trackCartAnalytics,
} from "@shopify/hydrogen";
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from "remix/multiple-import-maps-polyfill";
import { navigate as remixNavigate, run } from "remix/component";

import { createPageViewPublisher } from "../../ui/public/analytics.tsx";
import { connectBrowserCartStore } from "../../ui/public/cart/cart-store.ts";
import { configureOpenCartAction } from "../../ui/public/cart/cart.tsx";
import { documentMarketPathPrefix } from "../../lib/public/market.ts";
import { routeTemplates } from "../../lib/public/route-templates.ts";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await importModule(moduleUrl);
    let component = module[exportName];
    if (typeof component !== "function") {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
    }
    return component;
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads;

    preloadShim(preloads);
    return [];
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
let cartStore = connectBrowserCartStore(undefined, documentMarketPathPrefix());
if (cartStore) trackCartAnalytics(cartStore);
configureOpenCartAction();
