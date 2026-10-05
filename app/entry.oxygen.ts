import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";

import "./assets/public/site.css";
import interItalic from "./assets/public/font/inter-italic-latin-var.woff2?url";
import interRoman from "./assets/public/font/inter-roman-latin-var.woff2?url";
import jetBrainsMono from "./assets/public/font/jet-brains-mono.woff2?url";
import lexendZetta from "./assets/public/font/lexend-zetta-black.woff2?url";
import { resolveOxygenBuyerIp } from "./buyer-ip.ts";
import clientAssets from "./actions/public/entry.tsx?assets=client";
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
      fonts: { interItalic, interRoman, jetBrainsMono, lexendZetta },
      importMap: {},
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
    let cache = await globalThis.caches?.open("hydrogen");

    return app.fetch(request, {
      buyerIp: resolveOxygenBuyerIp(request),
      cache,
      env,
      waitUntil: context?.waitUntil.bind(context),
    });
  },
};

if (import.meta.hot) import.meta.hot.accept();
