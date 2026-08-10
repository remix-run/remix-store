import { renderForOxygen } from "./middleware/render.oxygen.tsx";
import { createAppRouter } from "./router.ts";

export const router = createAppRouter({
  renderer: renderForOxygen(),
});
