import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";

import { assetServer } from "./app/assets.server.ts";
import { router } from "./app/router.node.ts";
import { initializeRuntime } from "./app/runtime.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
  createRequestListener(
    async (request) => {
      initializeRuntime(request, process.env);

      try {
        return await router.fetch(request);
      } catch (error) {
        if (!(request.signal.aborted && error === request.signal.reason)) {
          console.error(error);
        }
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    { trustProxy: process.env.TRUST_PROXY === "true" },
  ),
);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close(async (error) => {
    await assetServer.close();
    process.exit(error ? 1 : 0);
  });
  server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
