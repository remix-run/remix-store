import { createController } from "remix/router";

import { queryHome } from "../data/storefront.ts";
import { routes } from "../routes.ts";
import { HomePage } from "./pages.tsx";

export default createController(routes, {
  actions: {
    async home({ request, render, storefrontClient }) {
      let home = await queryHome(storefrontClient);
      if (!home.ok) throw new Error(home.message, { cause: home.errors });

      return render(
        <HomePage
          canonicalUrl={new URL(request.url).origin + routes.home.href()}
          shopName={home.data.shop.name}
          description={home.data.shop.description}
          hero={home.data.hero}
          lookbookEntries={home.data.lookbookEntries}
        />,
      );
    },
  },
});
