import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";

import { queryCollection } from "../../data/storefront.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../pages.tsx";
import { CollectionPage } from "./page.tsx";

const MAX_CURSOR_LENGTH = 2_048;

export default createController(routes.collections, {
  actions: {
    index() {
      return redirect(routes.collections.show.href({ handle: "all" }));
    },
    async show({ params, render, request, storefrontClient, url }) {
      let cursor = url.searchParams.get("cursor")?.trim() || undefined;
      if (cursor && cursor.length > MAX_CURSOR_LENGTH) {
        return new Response("Invalid cursor", { status: 400 });
      }

      let collection = await queryCollection(storefrontClient, params.handle, {
        after: cursor,
        first: cursor ? 8 : 15,
      });
      if (!collection.ok) {
        throw new Error(collection.message, { cause: collection.errors });
      }
      if (!collection.data) {
        return render(<NotFoundPage />, { status: 404 });
      }

      if (cursor && acceptsJson(request)) {
        return Response.json({
          products: collection.data.products.nodes,
          pageInfo: collection.data.products.pageInfo,
        });
      }

      return render(
        <CollectionPage
          handle={collection.data.handle}
          title={collection.data.title}
          description={collection.data.description}
          products={collection.data.products.nodes}
          pageInfo={collection.data.products.pageInfo}
        />,
      );
    },
  },
});

function acceptsJson(request: Request): boolean {
  return (
    request.headers
      .get("Accept")
      ?.split(",")
      .some((value) => value.trim().startsWith("application/json")) ?? false
  );
}
