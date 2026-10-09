import type { AssetServer } from "remix/assets";

import type { DocumentAssets } from "./ui/document-assets.tsx";

/** The application consumes metadata, not a compiler or an HTTP server. */
export type Assets = Pick<AssetServer, "getScriptEntry" | "getHref"> & {
  // Vite extracts CSS instead of injecting it through compiled module imports.
  // Native assets do not need this capability.
  getStylesheets?: (paths: string | string[]) => Promise<string[]>;
};

/** Browser files every document links. The Vite config registers these too. */
export const documentAssetSources = {
  scriptEntry: "app/actions/public/entry.tsx",
  stylesheet: "app/assets/public/site.css",
  fonts: {
    interItalic: "app/assets/public/font/inter-italic-latin-var.woff2",
    interRoman: "app/assets/public/font/inter-roman-latin-var.woff2",
    jetBrainsMono: "app/assets/public/font/jet-brains-mono.woff2",
    lexendZetta: "app/assets/public/font/lexend-zetta-black.woff2",
  },
} as const;

export async function getDocumentAssets(
  assets: Assets,
  additionalStylesheets: string[] = [],
): Promise<DocumentAssets> {
  let { scriptEntry: entry, stylesheet: site, fonts } = documentAssetSources;
  let [
    scriptEntry,
    stylesheet,
    interItalic,
    interRoman,
    jetBrainsMono,
    lexendZetta,
    browserStylesheets,
  ] = await Promise.all([
    assets.getScriptEntry(entry),
    assets.getHref(site),
    assets.getHref(fonts.interItalic),
    assets.getHref(fonts.interRoman),
    assets.getHref(fonts.jetBrainsMono),
    assets.getHref(fonts.lexendZetta),
    assets.getStylesheets?.(entry) ?? [],
  ]);

  return {
    scriptEntry,
    stylesheets: [
      ...new Set([stylesheet, ...browserStylesheets, ...additionalStylesheets]),
    ],
    fonts: { interItalic, interRoman, jetBrainsMono, lexendZetta },
  };
}
