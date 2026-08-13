import { MemoryStorefrontCache } from "../data/storefront-cache.ts";
import { render } from "../middleware/render.tsx";
import { createApp } from "../router.ts";

export const testEnv = {
  PUBLIC_STORE_DOMAIN: "example.myshopify.com",
  ["PRIVATE_" + "STOREFRONT_API_TOKEN"]: "test-token",
};

export function createTestApp(fetch: typeof globalThis.fetch) {
  let app = createApp({
    renderer: render({
      documentAssets: { css: [], entry: "/assets/entry.js", js: [] },
      resolveClientEntry(_entryId, component) {
        return { href: "/assets/component.js", exportName: component.name };
      },
    }),
    storefront: {
      cache: new MemoryStorefrontCache(),
      env: testEnv,
      fetch,
    },
  });

  return {
    fetch(request: Request) {
      return app.fetch(request, { buyerIp: "127.0.0.1" });
    },
  };
}

export function createStorefrontFetch(
  handlers: Record<
    string,
    (body: StorefrontRequestBody) => unknown | Promise<unknown>
  >,
): typeof globalThis.fetch {
  return async (_input, init) => {
    let body = JSON.parse(String(init?.body)) as StorefrontRequestBody;
    let operationName = operationNameFrom(body.query);
    let handler = handlers[operationName];
    if (!handler && operationName === "redirects") {
      return graphqlResponse({ urlRedirects: { edges: [] } });
    }
    if (!handler && operationName === "RemixStoreWideSale") {
      return graphqlResponse({ shop: { storeWideSale: null } });
    }
    if (!handler) {
      throw new Error(`Unexpected Storefront operation: ${operationName}`);
    }
    return graphqlResponse(await handler(body));
  };
}

export function graphqlResponse(
  data: unknown,
  errors?: Array<{ message: string }>,
): Response {
  return new Response(JSON.stringify(errors ? { data, errors } : { data }), {
    headers: { "Content-Type": "application/json" },
  });
}

export function navigationData() {
  return {
    footerMenu: { items: [] },
    menu: { items: [] },
    shop: { primaryDomain: { url: "https://example.myshopify.com" } },
  };
}

export function analyticsShopData() {
  return {
    shop: { id: "gid://shopify/Shop/test" },
    localization: { country: { currency: { isoCode: "USD" } } },
  };
}

export interface StorefrontRequestBody {
  query: string;
  variables: Record<string, unknown>;
}

function operationNameFrom(query: string): string {
  let match = query.match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (!match?.[1]) throw new Error("Storefront request has no operation name");
  return match[1];
}
