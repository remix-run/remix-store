import type { ScriptEntry } from "remix/assets";
import type { Handle, RemixNode } from "remix/component";

/** Resolved URLs for the webfonts a document may preload. */
export interface DocumentFonts {
  interRoman: string;
  jetBrainsMono: string;
  lexendZetta: string;
}

export interface DocumentAssets {
  scriptEntry: ScriptEntry;
  stylesheets: string[];
  fonts: DocumentFonts;
}

interface RequestDocumentAssets extends DocumentAssets {
  /** The response's CSP nonce, for authored script and preload tags. */
  nonce?: string;
}

interface DocumentAssetsProviderProps extends RequestDocumentAssets {
  children?: RemixNode;
}

export function DocumentAssetsProvider(
  handle: Handle<DocumentAssetsProviderProps, RequestDocumentAssets>,
) {
  handle.context.set({
    scriptEntry: handle.props.scriptEntry,
    stylesheets: handle.props.stylesheets,
    fonts: handle.props.fonts,
    nonce: handle.props.nonce,
  });
  return () => <>{handle.props.children}</>;
}
