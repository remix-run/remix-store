import { constants as zlib } from "node:zlib";

import { SuperHeaders } from "remix/headers";
import { CacheControl } from "remix/headers/cache-control";
import { compression } from "remix/middleware/compression";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { getDocumentAssets } from "./assets.ts";
import { assets } from "./assets.node.ts";
import { cacheControl } from "./lib/cache-control.ts";
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
  // Node's default Brotli quality (11) spends ~150ms of CPU on each page and
  // module. Quality 5 is within ~12% of its size for ~1% of the CPU. Fastly
  // passes these bytes through: it only compresses uncompressed responses,
  // and uncacheable HTML only at level 1.
  let compress = compression({
    brotli: { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } },
  });
  // Root public files keep stable, unfingerprinted URLs, so cache them briefly.
  // Fingerprinted `/assets/*` responses set their own immutable headers.
  let servePublicFiles = staticFiles("./public", {
    cacheControl: new CacheControl(cacheControl.publicDay).toString(),
    index: false,
  });

  return (context, next) => {
    if (context.url.pathname === "/health") {
      return new Response("OK", {
        headers: new SuperHeaders({
          cacheControl: cacheControl.noStore,
          contentType: "text/plain; charset=utf-8",
        }),
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
        let headers = new SuperHeaders(response?.headers);
        headers.cacheControl = cacheControl.noStore;
        return new Response(response ? response.body : "Not Found", {
          headers,
          status: response?.status ?? 404,
        });
      }),
    );
  };
}
