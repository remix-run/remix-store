import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";

import { resolveNodeBuyerIp } from "./app/buyer-ip.ts";
import { app, closeNodeApp } from "./app/node.ts";

const isHmr = Boolean(
  process.env.NODE_ENV === "development" && process.env.REMIX_NODE_HMR,
);
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? parsePort("HMR_PROXY_PORT", process.env.HMR_PROXY_PORT)
  : null;
const port = parsePort("PORT", process.env.PORT ?? "44100");

const server = http.createServer(
  createRequestListener(
    (request) =>
      app.fetch(request, {
        buyerIp: resolveNodeBuyerIp(request, process.env),
        env: process.env,
      }),
    {
      trustProxy: isHmr || process.env.TRUST_PROXY === "true",
    },
  ),
);

server.listen(port, () => {
  if (isHmr) {
    import("remix/node-hmr/runtime").then((nodeHmr) =>
      nodeHmr.emitServerReady(),
    );
  }

  console.log(`Server listening on http://localhost:${hmrProxyPort ?? port}`);
});

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
