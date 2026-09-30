import { createController } from "remix/router";

import { isPolicyHandle, queryPolicy } from "../../data/policies.ts";
import { marketPath } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../pages.tsx";
import { PolicyPage } from "./page.tsx";

export default createController(routes.policies, {
  actions: {
    async show({ market, params, render, storefrontClient, url }) {
      if (!isPolicyHandle(params.handle)) {
        return render(<NotFoundPage />, { status: 404 });
      }

      let result = await queryPolicy(storefrontClient, params.handle);
      if (!result.ok) {
        throw new Error(result.message, { cause: result.errors });
      }
      if (!result.data) {
        return render(<NotFoundPage />, { status: 404 });
      }

      return render(
        <PolicyPage
          canonicalUrl={
            url.origin +
            marketPath(routes.policies.show.href(params), market.pathPrefix)
          }
          market={market}
          policy={result.data}
        />,
      );
    },
  },
});
