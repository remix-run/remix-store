import type { AssetServer } from "remix/assets";

import type { DocumentAssets } from "./ui/document-assets.tsx";

/** The application consumes metadata, not a compiler or an HTTP server. */
export type Assets = Pick<AssetServer, "getScriptEntry" | "getHref"> & {
  // Vite extracts CSS instead of injecting it through compiled module imports.
  // Native assets do not need this capability.
  getStylesheets?: (paths: string | string[]) => Promise<string[]>;
};

export async function getDocumentAssets(
  assets: Assets,
  additionalStylesheets: string[] = [],
): Promise<DocumentAssets> {
  // Literal source paths let the Vite adapter discover the browser outputs.
  let [
    scriptEntry,
    stylesheet,
    interItalic,
    interRoman,
    jetBrainsMono,
    lexendZetta,
    browserStylesheets,
  ] = await Promise.all([
    assets.getScriptEntry("app/actions/public/entry.tsx"),
    assets.getHref("app/assets/public/site.css"),
    assets.getHref("app/assets/public/font/inter-italic-latin-var.woff2"),
    assets.getHref("app/assets/public/font/inter-roman-latin-var.woff2"),
    assets.getHref("app/assets/public/font/jet-brains-mono.woff2"),
    assets.getHref("app/assets/public/font/lexend-zetta-black.woff2"),
    assets.getStylesheets?.("app/actions/public/entry.tsx") ?? [],
  ]);

  return {
    scriptEntry,
    stylesheets: [
      ...new Set([stylesheet, ...browserStylesheets, ...additionalStylesheets]),
    ],
    fonts: { interItalic, interRoman, jetBrainsMono, lexendZetta },
  };
}
