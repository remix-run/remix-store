import { flatRoutes } from "@remix-run/fs-routes";
import { hydrogenRoutes } from "@shopify/hydrogen";
import { type RouteConfig } from "@remix-run/route-config";

const routes = hydrogenRoutes(await flatRoutes()) satisfies RouteConfig;

export default routes;
