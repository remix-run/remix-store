import { Renderer } from "remix/middleware/render";
import { createElement, type RemixNode } from "remix/ui";
import {
  createRouter,
  type Middleware,
  type MiddlewareContext,
} from "remix/router";

import rootController from "./actions/controller.tsx";
import collectionsController from "./actions/collections/controller.tsx";
import { ErrorPage, NotFoundPage } from "./actions/pages.tsx";
import { render } from "./middleware/render.tsx";
import { storefront, type StorefrontOptions } from "./middleware/storefront.ts";
import { routes } from "./routes.ts";
import { fetchWithRuntime, type Runtime } from "./runtime.ts";

export interface AppOptions {
  platform?: Middleware;
  renderer: ReturnType<typeof render>;
  storefront?: StorefrontOptions;
}

const passThrough: Middleware = (_context, next) => next();

function createMiddleware(options: AppOptions) {
  return [
    options.platform ?? passThrough,
    options.renderer,
    errorPages(),
    storefront(options.storefront),
  ] as const;
}

function errorPages(): Middleware {
  return async (context, next) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof Response) return error;
      if (
        context.request.signal.aborted &&
        error === context.request.signal.reason
      )
        throw error;
      console.error(error);
      let renderPage = context.get(Renderer) as (
        node: RemixNode,
        init?: ResponseInit,
      ) => Response;
      return renderPage(createElement(ErrorPage, {}), { status: 500 });
    }
  };
}

type AppContext = MiddlewareContext<ReturnType<typeof createMiddleware>>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export function createApp(options: AppOptions) {
  let router = createRouter<AppContext>({
    middleware: createMiddleware(options),
    defaultHandler(context) {
      if (context.method !== "GET") {
        return new Response(`Not Found: ${context.url.pathname}`, {
          status: 404,
        });
      }
      return context.render(createElement(NotFoundPage, {}), { status: 404 });
    },
  });

  router.map(routes, rootController);
  router.map(routes.collections, collectionsController);

  return {
    fetch(request: Request, runtime: Runtime = {}) {
      return fetchWithRuntime(request, runtime, () => router.fetch(request));
    },
  };
}
