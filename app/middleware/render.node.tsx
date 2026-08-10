import * as path from "node:path";

import { assetServer } from "../assets.server.ts";
import { render } from "./render.tsx";

const browserEntryHref = await assetServer.getHref("app/entry.browser.ts");

export function renderForNode() {
  return render({
    documentAssets: {
      css: [],
      entry: browserEntryHref,
      js: [],
    },
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith("file://")) {
        throw new Error(
          `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
        );
      }

      return {
        href: await assetServer.getHref(entryId),
        exportName:
          entryId.split("#")[1] || component.name || titleCaseFileName(entryId),
      };
    },
  });
}

function titleCaseFileName(fileUrl: string): string {
  let url = new URL(fileUrl);
  let fileName = path.basename(url.pathname, path.extname(url.pathname));
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}
