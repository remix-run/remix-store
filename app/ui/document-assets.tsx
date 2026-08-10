import type { Handle, RemixNode } from "remix/ui";

export interface AssetAttributes {
  [name: string]: boolean | string | undefined;
}

export interface DocumentAssets {
  css: AssetAttributes[];
  entry: string;
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
    js: handle.props.js,
  });

  return () => <>{handle.props.children}</>;
}
