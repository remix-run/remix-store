import { initializeShopifyScripts } from "@shopify/hydrogen";
import { navigate as remixNavigate, run, type FrameContent } from "remix/ui";

import {
  createPageViewPublisher,
  trackConfirmedCartChanges,
} from "./assets/public/analytics.tsx";
import { getBrowserCartStore } from "./assets/public/cart-store.ts";
import { configureOpenCartAction } from "./assets/public/cart.tsx";
import { routeTemplates } from "./lib/public/route-templates.ts";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(/* @vite-ignore */ moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, options) {
    return resolveFrameResponse(
      new URL(src, window.location.href),
      options?.signal,
      options?.target,
    );
  },
});

async function resolveFrameResponse(
  url: URL,
  signal?: AbortSignal,
  target?: string,
): Promise<FrameContent> {
  let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
  if (target) headers.set("X-Remix-Target", target);

  let response = await fetch(url, {
    credentials: "same-origin",
    headers,
    signal,
  });
  let contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(
      `Failed to resolve HTML frame: ${response.status} ${response.statusText}`,
    );
  }

  // Error statuses still contain the branded document that navigation should
  // render (for example, when traversing history back to a 404).
  return response.body ?? response.text();
}

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
trackConfirmedCartChanges(getBrowserCartStore());
configureOpenCartAction();
