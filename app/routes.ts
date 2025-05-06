import { flatRoutes } from "@remix-run/fs-routes";
import { hydrogenRoutes } from "@shopify/hydrogen";
import { prefix, route, type RouteConfig } from "@remix-run/route-config";

const routes = [
  ...(await hydrogenRoutes(
    await flatRoutes({ rootDirectory: "routes/pages" }),
  )),
  ...prefix("_actions", [
    route("color-scheme", "routes/actions/color-scheme.tsx"),
    route("load-more-products", "routes/actions/load-more-products.tsx"),
  ]),
] satisfies RouteConfig;

export default routes;
