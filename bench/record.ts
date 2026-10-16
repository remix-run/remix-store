import * as fs from "node:fs";
import * as path from "node:path";
import { parseEnv } from "node:util";

import { startAppServer } from "./app-server.ts";
import { pages, recordingPath } from "./pages.ts";
import { startStorefront, writeRecording } from "./storefront.ts";

// Records the read-only Storefront queries behind each benchmark page from the
// live store, using the credentials in `.env`. Run with `node bench/record.ts`.

const appPort = 44_130;
const storefrontPort = 44_131;
const root = path.resolve(import.meta.dirname, "..");

let env = parseEnv(fs.readFileSync(path.join(root, ".env"), "utf8"));
let storeDomain = env.PUBLIC_STORE_DOMAIN;
let storefrontToken = env.PRIVATE_STOREFRONT_API_TOKEN;
if (!storeDomain || !storefrontToken) {
  throw new Error(
    "Set PUBLIC_STORE_DOMAIN and PRIVATE_STOREFRONT_API_TOKEN in .env.",
  );
}

let recording = {};
let storefront = await startStorefront({
  port: storefrontPort,
  recording,
  upstream: storeDomain.includes("://")
    ? storeDomain
    : `https://${storeDomain}`,
});
let app = await startAppServer({
  dir: root,
  port: appPort,
  storefrontPort,
  storefrontId: env.PUBLIC_STOREFRONT_ID,
  storefrontToken,
});

try {
  for (let page of pages) {
    let response = await fetch(new URL(page.path, app.origin));
    let html = await response.text();
    if (response.status !== 200) {
      throw new Error(`${page.path} returned ${response.status}.`);
    }
    console.log(`${page.path}: ${Buffer.byteLength(html)} bytes`);
  }
} finally {
  await app.stop();
  await storefront.close();
}

writeRecording(recordingPath, recording);
console.log(
  `Recorded ${Object.keys(recording).length} operations to ${recordingPath}`,
);
