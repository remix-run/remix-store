import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { serveBrowserAssets } from "../assets.server.ts";

export function nodePlatform(): Middleware {
  let servePublicFiles = staticFiles("./public", { index: false });
  let serveAssets = serveBrowserAssets();

  return (context, next) =>
    servePublicFiles(context, async () => await serveAssets(context, next));
}
