import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";

import { app, closeNodeApp } from "./app/node.server.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
  createRequestListener((request) => app.fetch(request, { env: process.env }), {
    trustProxy: process.env.TRUST_PROXY === "true",
  }),
);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

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
