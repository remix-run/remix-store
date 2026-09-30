import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";
import type { FetchHandler } from "remix/node-fetch-server";

import {
  CDN_ORIGIN_SECRET_HEADER,
  resolveNodeBuyerIp,
} from "./app/buyer-ip.ts";
import { app, closeNodeApp } from "./app/node.ts";

const isHmr = Boolean(
  process.env.NODE_ENV === "development" && process.env.REMIX_NODE_HMR,
);
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? parsePort("HMR_PROXY_PORT", process.env.HMR_PROXY_PORT)
  : null;
const port = parsePort("PORT", process.env.PORT ?? "44100");

const handler: FetchHandler = (request, client) => {
  let buyerIp = resolveNodeBuyerIp(request, process.env, client.address);
  logBuyerIpSource(request, buyerIp); // TEMP: remove after verifying Fastly.
  // Shopify's generic API proxy forwards most request headers upstream.
  request.headers.delete(CDN_ORIGIN_SECRET_HEADER);
  return app.fetch(request, { buyerIp, env: process.env });
};

const server = http.createServer(
  createRequestListener(handler, {
    trustProxy: isHmr || process.env.TRUST_PROXY === "true",
  }),
);

server.listen(port, () => {
  if (isHmr) {
    import("remix/node-hmr/runtime").then((nodeHmr) =>
      nodeHmr.emitServerReady(),
    );
  }

  console.log(`Server listening on http://localhost:${hmrProxyPort ?? port}`);
});

// TEMP: logs which header supplied the buyer IP, never the IP or secret.
function logBuyerIpSource(request: Request, buyerIp: string | undefined) {
  if (new URL(request.url).pathname === "/health") return;
  let cdnIp = request.headers.get("x-cdn-client-ip")?.trim();
  let source = !buyerIp
    ? "none"
    : buyerIp === cdnIp
      ? "cdn"
      : buyerIp === request.headers.get("fly-client-ip")?.trim()
        ? "fly"
        : "socket";
  console.log(
    `[buyer-ip] source=${source} cdnIpHeader=${Boolean(cdnIp)} secretHeader=${request.headers.has(CDN_ORIGIN_SECRET_HEADER)}`,
  );
}

function parsePort(name: string, value: string): number {
  let port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(
      `Invalid ${name} value "${value}". Expected a port from 1 to 65535.`,
    );
  }
  return port;
}

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close(async (error) => {
    await closeNodeApp();
    process.exit(error ? 1 : 0);
  });
  server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
