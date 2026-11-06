import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { isPolicyHandle, queryPolicy } from "./data.ts";
import { cacheControl } from "../../lib/cache-control.ts";
import { marketUrl } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../../ui/error-pages.tsx";
import { PolicyPage } from "./page.tsx";

export default createController(routes.policies, {
  actions: {
    async show({ market, params, render, storefrontClient, url }) {
      if (!isPolicyHandle(params.handle)) {
        return render(<NotFoundPage />, { status: 404 });
      }

      let policy = await queryPolicy(storefrontClient, params.handle);
      if (!policy) {
        return render(<NotFoundPage />, { status: 404 });
      }

      return render(
        <PolicyPage
          canonicalUrl={marketUrl(
            url,
            routes.policies.show.href(params),
            market.pathPrefix,
          )}
          policy={policy}
        />,
        { headers: new SuperHeaders({ cacheControl: cacheControl.browsing }) },
      );
    },
  },
});
