import type { Handle, RemixNode } from "remix/ui";
import type { ImportMapData } from "remix/ui/server";

export interface AssetAttributes {
  [name: string]: boolean | string | undefined;
}

export interface DocumentAssets {
  css: AssetAttributes[];
  entry: string;
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
    importMap: handle.props.importMap,
    js: handle.props.js,
  });

  return () => <>{handle.props.children}</>;
}
