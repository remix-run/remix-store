import { getDocumentAssets } from "./assets.ts";
import { assets } from "./assets.oxygen.ts";
import { resolveOxygenBuyerIp } from "./buyer-ip.ts";
import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";
import { type Env, type ExecutionContext } from "./runtime.ts";

const app = createApp({
  renderer: render({
    assets,
    documentAssets: await getDocumentAssets(
      assets,
      await assets.getStylesheets("app/entry.oxygen.ts"),
    ),
  }),
});

export default {
  async fetch(
    request: Request,
    env?: Env,
    context?: ExecutionContext,
  ): Promise<Response> {
    let cache = await globalThis.caches?.open("hydrogen");

    return app.fetch(request, {
      buyerIp: resolveOxygenBuyerIp(request),
      cache,
      env,
      waitUntil: context?.waitUntil.bind(context),
    });
  },
};

if (import.meta.hot) import.meta.hot.accept();
