import type { Handle, RemixNode } from "remix/component";
import type { ImportMapData } from "remix/component/server";

export interface AssetAttributes {
  [name: string]: boolean | string | undefined;
}

/** Resolved webfont URLs, shared by `@font-face` rules and preload links. */
export interface DocumentFonts {
  interItalic: string;
  interRoman: string;
  jetBrainsMono: string;
  lexendZetta: string;
}

export interface DocumentAssets {
  css: AssetAttributes[];
  entry: string;
  fonts: DocumentFonts;
  importMap: ImportMapData;
  js: AssetAttributes[];
}

interface DocumentAssetsProviderProps extends DocumentAssets {
  children?: RemixNode;
}

export function DocumentAssetsProvider(
  handle: Handle<DocumentAssetsProviderProps, DocumentAssets>,
) {
  handle.context.set({
    css: handle.props.css,
    entry: handle.props.entry,
    fonts: handle.props.fonts,
    importMap: handle.props.importMap,
    js: handle.props.js,
  });

  return () => <>{handle.props.children}</>;
}
