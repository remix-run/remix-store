import { constants as zlib } from "node:zlib";

import { SuperHeaders } from "remix/headers";
import { CacheControl } from "remix/headers/cache-control";
import { compression } from "remix/middleware/compression";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { getDocumentAssets } from "./assets.ts";
import {
  createNodeAssetServer,
  resolveNodeMode,
  type NodeMode,
} from "./assets.node.ts";
import { cacheControl } from "./lib/cache-control.ts";
import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";

type NodeAssetServer = Awaited<ReturnType<typeof createNodeAssetServer>>;

export type NodeApp = Awaited<ReturnType<typeof createNodeApp>>;

/**
 * Builds the Node app: starts the asset server (watching in development),
 * compiles the document entry hrefs and composes the router. Call `close`
 * to stop the asset server.
 */
export async function createNodeApp({
  mode = resolveNodeMode(process.env),
}: { mode?: NodeMode } = {}) {
  let assets = await createNodeAssetServer(mode);
  let documentAssets = await getDocumentAssets(assets);

  return {
    app: createApp({
      csp: { development: mode.development },
      platform: nodePlatform(assets),
      renderer: render({ assets, documentAssets }),
    }),
    browserEntryHref: documentAssets.scriptEntry.href,
    fonts: documentAssets.fonts,
    productDetailsEntryHref: await assets.getHref(
      "app/actions/products/public/product-details.tsx",
    ),
    snowFieldEntryHref: await assets.getHref(
      "app/actions/public/snow-field.tsx",
    ),
    close: () => assets.close(),
  };
}

function nodePlatform(assets: NodeAssetServer): Middleware {
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
