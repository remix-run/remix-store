import { Renderer } from "remix/middleware/render";
import { createElement, type RemixNode } from "remix/ui";
import {
  createMiddleware,
  createRouter,
  type Middleware,
  type RouterContext,
} from "remix/router";

import {
  createRootController,
  type RootControllerOptions,
} from "./actions/controller.tsx";
import collectionsController from "./actions/collections/controller.tsx";
import policiesController from "./actions/policies/controller.tsx";
import productsController from "./actions/products/controller.tsx";
import seoController from "./actions/seo/controller.ts";
import {
  createSubscribeController,
  type SubscribeControllerOptions,
} from "./actions/subscribe/controller.tsx";
import { ErrorPage, NotFoundPage } from "./actions/pages.tsx";
import { market } from "./middleware/market.tsx";
import { render } from "./middleware/render.tsx";
import { storefront, type StorefrontOptions } from "./middleware/storefront.ts";
import { routes } from "./routes.ts";
import { fetchWithRuntime, type Runtime } from "./runtime.ts";

export interface AppOptions {
  platform?: Middleware;
  renderer: ReturnType<typeof render>;
  storefront?: StorefrontOptions;
  subscribe?: SubscribeControllerOptions;
  seasonalSnow?: RootControllerOptions;
}

const passThrough: Middleware = (_context, next) => next();

function createAppMiddleware(options: AppOptions) {
  return createMiddleware(
    options.platform ?? passThrough,
    options.renderer,
    errorPages(),
    market(),
    storefront(options.storefront),
  );
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

function createAppRouter(options: AppOptions) {
  return createRouter({
    middleware: createAppMiddleware(options),
    defaultHandler(context) {
      if (context.method !== "GET") {
        return new Response(`Not Found: ${context.url.pathname}`, {
          status: 404,
        });
      }
      return context.render(createElement(NotFoundPage, {}), { status: 404 });
    },
  });
}

type AppContext = RouterContext<ReturnType<typeof createAppRouter>>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

export function createApp(options: AppOptions) {
  let router = createAppRouter(options);

  router.map(routes, createRootController(options.seasonalSnow));
  router.map(routes.collections, collectionsController);
  router.map(routes.policies, policiesController);
  router.map(routes.products, productsController);
  router.map(routes.seo, seoController);
  router.map(routes.subscribe, createSubscribeController(options.subscribe));

  return {
    fetch(request: Request, runtime: Runtime = {}) {
      return fetchWithRuntime(request, runtime, () => router.fetch(request));
    },
  };
}
