import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";

import { resolveOxygenBuyerIp } from "./buyer-ip.ts";
import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.oxygen.ts?assets=ssr";
import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";
import { type Env, type ExecutionContext } from "./runtime.ts";

const assets = mergeAssets(clientAssets, serverAssets);
const app = createApp({
  renderer: render({
    documentAssets: {
      css: assets.css,
      entry: clientAssets.entry,
      js: assets.js,
    },
    resolveClientEntry(entryId, component) {
      let separator = entryId.lastIndexOf("#");
      return separator === -1
        ? { href: entryId, exportName: component.name }
        : {
            href: entryId.slice(0, separator),
            exportName: entryId.slice(separator + 1),
          };
    },
  }),
});

export default {
  async fetch(
    request: Request,
    env?: Env,
    context?: ExecutionContext,
  ): Promise<Response> {
    let cache =
      typeof caches === "undefined" ? undefined : await caches.open("hydrogen");

    return app.fetch(request, {
      buyerIp: resolveOxygenBuyerIp(request),
      cache,
      env,
      waitUntil: context?.waitUntil.bind(context),
    });
  },
};

if (import.meta.hot) import.meta.hot.accept();
