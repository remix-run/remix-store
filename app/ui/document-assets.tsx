import type { ScriptEntry } from "remix/assets";
import type { Handle, RemixNode } from "remix/component";

/** Resolved webfont URLs, shared by @font-face and preload links. */
export interface DocumentFonts {
  interItalic: string;
  interRoman: string;
  jetBrainsMono: string;
  lexendZetta: string;
}

export interface DocumentAssets {
  scriptEntry: ScriptEntry;
  stylesheets: string[];
  fonts: DocumentFonts;
}

interface DocumentAssetsProviderProps extends DocumentAssets {
  children?: RemixNode;
}

export function DocumentAssetsProvider(
  handle: Handle<DocumentAssetsProviderProps, DocumentAssets>,
) {
  handle.context.set({
    scriptEntry: handle.props.scriptEntry,
    stylesheets: handle.props.stylesheets,
    fonts: handle.props.fonts,
  });
  return () => <>{handle.props.children}</>;
}
