import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream, type RenderToStreamOptions } from "remix/ui/server";

import {
  DocumentAssetsProvider,
  type DocumentAssets,
} from "../ui/document-assets.tsx";

export interface RenderOptions {
  documentAssets: DocumentAssets;
  resolveClientEntry: NonNullable<RenderToStreamOptions["resolveClientEntry"]>;
}

export function render(options: RenderOptions) {
  return renderWith((context) => {
    let { request } = context;

    return function renderPage(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(
        <DocumentAssetsProvider {...options.documentAssets}>
          {node}
        </DocumentAssetsProvider>,
        {
          frameSrc: request.url,
          signal: request.signal,
          resolveClientEntry: options.resolveClientEntry,
        },
      );

      let headers = new Headers(init?.headers);
      // HTML contains request-scoped Storefront data and must not be cached.
      headers.set("Cache-Control", "private, no-store");
      return createHtmlResponse(stream, { ...init, headers });
    };
  });
}
