import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";

import clientAssets from "../entry.browser.ts?assets=client";
import serverAssets from "../entry.server.ts?assets=ssr";
import { render, type RenderOptions } from "./render.tsx";

export function renderForOxygen() {
  let assets = mergeAssets(clientAssets, serverAssets);

  return render({
    documentAssets: {
      css: assets.css as RenderOptions["documentAssets"]["css"],
      entry: clientAssets.entry,
      js: assets.js as RenderOptions["documentAssets"]["js"],
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
  });
}
