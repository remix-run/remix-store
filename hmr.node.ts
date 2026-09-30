import * as http from "node:http";

import { createFetchProxy } from "remix/fetch-proxy";
import { createHmrReadyFetch, run } from "remix/node-hmr";
import { createRequestListener } from "remix/node-fetch-server";

const hmrProxyPort = parsePort("PORT", 44100);
const appPort = parsePort("APP_PORT", hmrProxyPort + 1);
const hmrEventPort = parsePort("HMR_EVENT_PORT", appPort + 1);

const hmrRunner = run("server.node.ts", {
  env: {
    ...process.env,
    PORT: String(appPort),
    HMR_PROXY_PORT: String(hmrProxyPort),
  },
  nodeArgs: ["--import", "remix/node-tsx", "--import", "remix/ui-hmr/node"],
  browserHmrChannel: { port: hmrEventPort },
});

const proxyFetch = createFetchProxy(`http://127.0.0.1:${appPort}`, {
  xForwardedHeaders: true,
});
const server = http.createServer(
  createRequestListener(createHmrReadyFetch(hmrRunner, proxyFetch)),
);

server.listen(hmrProxyPort, "127.0.0.1", () => {
  console.log(
    `Development proxy listening on http://127.0.0.1:${hmrProxyPort}`,
  );
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => hmrRunner.close().finally(() => process.exit(0)));
  server.closeAllConnections();
}

function parsePort(name: string, fallback: number): number {
  let value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0 || value > 65_535) {
    throw new Error(
      `Invalid ${name} value "${process.env[name] ?? ""}". Expected a port from 1 to 65535.`,
    );
  }
  return value;
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
