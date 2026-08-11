import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";

import { app, closeNodeApp } from "../app/node.ts";
import { createCart } from "../test/cart-fixtures.ts";

const appPort = 44_110;
const storefrontPort = 44_111;
const env = {
  PUBLIC_STORE_DOMAIN: `http://localhost:${storefrontPort}`,
  PUBLIC_STOREFRONT_API_TOKEN: "e2e-token",
};

const storefrontServer = http.createServer(async (request, response) => {
  let body = "";
  for await (let chunk of request) body += chunk;

  try {
    let { query } = JSON.parse(body) as { query: string };
    let operation = query.match(
      /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/,
    )?.[1];
    let data = storefrontData(operation);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ errors: [{ message: String(error) }] }));
  }
});

const appServer = http.createServer(
  createRequestListener((request) => app.fetch(request, { env })),
);

await Promise.all([
  listen(storefrontServer, storefrontPort),
  listen(appServer, appPort),
]);
console.log(`E2E fixture server listening on http://localhost:${appPort}`);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all([
    close(appServer),
    close(storefrontServer),
    closeNodeApp(),
  ]);
}

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));

function storefrontData(operation: string | undefined): unknown {
  switch (operation) {
    case "RemixNavigation":
      return {
        menu: {
          items: [
            {
              id: "all",
              title: "All Products",
              url: "http://localhost:44110/collections/all",
            },
          ],
        },
        footerMenu: { items: [] },
        shop: { primaryDomain: { url: "http://localhost:44110" } },
      };
    case "RemixHomeEditorial":
      return {
        shop: { name: "Remix Store", description: "Racing apparel" },
        hero: null,
        lookbook: null,
      };
    case "RemixCollection":
      return {
        collection: {
          id: "collection",
          handle: "all",
          title: "All products",
          description: "The complete catalog",
          products: {
            nodes: [productCard()],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    case "RemixProduct":
      return { product: product() };
    case "RemixAnalyticsShop":
      return {
        shop: { id: "gid://shopify/Shop/test" },
        localization: { country: { currency: { isoCode: "USD" } } },
      };
    case "CartCreate":
      return {
        cartCreate: { cart: cart(), userErrors: [], warnings: [] },
      };
    case "Cart":
      return { cart: cart() };
    default:
      throw new Error(`Unexpected Storefront operation: ${operation}`);
  }
}

function cart() {
  let value = createCart();
  let line = value.lines.nodes[0];
  if (line?.merchandise) {
    line.merchandise.id = "variant";
    line.merchandise.product.title = "Test product";
  }
  return value;
}

function productCard() {
  return {
    id: "product",
    handle: "test-product",
    title: "Test product",
    images: { nodes: [] },
    selectedOrFirstAvailableVariant: {
      price: { amount: "20.00", currencyCode: "USD" },
      compareAtPrice: null,
    },
    priceRange: {
      maxVariantPrice: { amount: "20.00", currencyCode: "USD" },
    },
  };
}

function product() {
  let selectedVariant = variant();
  return {
    id: "product",
    handle: "test-product",
    title: "Test product",
    description: "A deterministic test product.",
    requiresSellingPlan: false,
    category: { name: "Test category" },
    seo: { title: "Test product", description: "A test product" },
    customDescription: null,
    technicalDescription: null,
    priceRange: {
      minVariantPrice: { amount: "20.00", currencyCode: "USD" },
    },
    encodedVariantExistence: "v1_0",
    encodedVariantAvailability: "v1_0",
    options: [
      {
        name: "Title",
        optionValues: [
          { name: "Default Title", firstSelectableVariant: selectedVariant },
        ],
      },
    ],
    selectedOrFirstAvailableVariant: selectedVariant,
    adjacentVariants: [],
    images: { nodes: [] },
  };
}

function variant() {
  return {
    availableForSale: true,
    compareAtPrice: null,
    id: "variant",
    image: null,
    price: { amount: "20.00", currencyCode: "USD" },
    product: { handle: "test-product", title: "Test product" },
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    title: "Default Title",
  };
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}
