import { nodePlatform } from "./middleware/platform.node.ts";
import { renderForNode } from "./middleware/render.node.tsx";
import { createAppRouter } from "./router.ts";

export const router = createAppRouter({
  platform: nodePlatform(),
  renderer: renderForNode(),
});
