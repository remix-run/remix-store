import { compression } from "remix/middleware/compression";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { getDocumentAssets } from "./assets.ts";
import { assets } from "./assets.node.ts";
import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";

const documentAssets = await getDocumentAssets(assets);
export const browserEntryHref = documentAssets.scriptEntry.href;
export const fonts = documentAssets.fonts;
export const productDetailsEntryHref = await assets.getHref(
  "app/assets/public/product-details.tsx",
);
export const snowFieldEntryHref = await assets.getHref(
  "app/assets/public/snow-field.tsx",
);

export const app = createApp({
  platform: nodePlatform(),
  renderer: render({ assets, documentAssets }),
});

export function closeNodeApp() {
  return assets.close();
}

function nodePlatform(): Middleware {
  let compress = compression();
  // Root public files keep stable, unfingerprinted URLs, so cache them briefly.
  // Fingerprinted `/assets/*` responses set their own immutable headers.
  let servePublicFiles = staticFiles("./public", {
    cacheControl: "public, max-age=86400",
    index: false,
  });

  return (context, next) => {
    if (context.url.pathname === "/health") {
      return new Response("OK", {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return compress(context, async () =>
      servePublicFiles(context, async () => {
        let { pathname } = context.url;
        if (pathname !== "/assets" && !pathname.startsWith("/assets/")) {
          return next();
        }

        let response = await assets.fetch(context.request);
        if (response && response.status < 400) return response;

        // A stale fingerprint during a deploy must not be cached by a CDN.
        let headers = new Headers(response?.headers);
        headers.set("Cache-Control", "no-store");
        return new Response(response ? response.body : "Not Found", {
          headers,
          status: response?.status ?? 404,
        });
      }),
    );
  };
}
