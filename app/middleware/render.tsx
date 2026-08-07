import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream } from "remix/ui/server";

export function render() {
  return renderWith((context) => {
    let { request } = context;

    return function renderPage(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(node, {
        frameSrc: request.url,
        signal: request.signal,
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

      let headers = new Headers(init?.headers);
      headers.set("Cache-Control", "private, no-store");
      return createHtmlResponse(stream, { ...init, headers });
    };
  });
}
