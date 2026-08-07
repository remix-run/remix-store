import { router } from "./router.ts";
import {
  initializeRuntime,
  type Env,
  type ExecutionContext,
} from "./runtime.ts";

export default {
  async fetch(
    request: Request,
    env?: Env,
    context?: ExecutionContext,
  ): Promise<Response> {
    let cache =
      typeof caches === "undefined" ? undefined : await caches.open("hydrogen");
    initializeRuntime(request, env, context, cache);

    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason))
        console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

if (import.meta.hot) import.meta.hot.accept();
