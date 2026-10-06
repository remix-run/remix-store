import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createBuilder, createServer } from "vite";

import { fixture } from "./testing/asset-fixture.ts";

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function start(app: Fixture) {
  let server = await createServer({
    configFile: false,
    root: app.root,
    logLevel: "silent",
    plugins: app.plugins(),
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    let address = server.httpServer!.address();
    assert.ok(address && typeof address === "object");
    return { server, url: `http://127.0.0.1:${address.port}` };
  } catch (error) {
    await server.close();
    throw error;
  }
}

describe("discovery and document stylesheet dependencies", () => {
  it("uses the Worker export branch for both execution and isolated CSS discovery", async () => {
    let app = await fixture({
      "node_modules/conditional-style/package.json": JSON.stringify({
        name: "conditional-style",
        type: "module",
        exports: {
          node: "./node.js",
          worker: "./worker.js",
          default: "./node.js",
        },
      }),
      "node_modules/conditional-style/node.js":
        'export const marker="node-branch";',
      "node_modules/conditional-style/worker.js":
        'import "../../app/public/worker-only.css";export const marker="worker-branch";',
      "app/public/worker-only.css": "body{--worker-style:1}",
    });
    let started: Awaited<ReturnType<typeof start>> | undefined;
    try {
      await writeFile(
        resolve(app.root, "app/server.tsx"),
        'import {marker} from "conditional-style";\n' +
          app.files["app/server.tsx"]!.replace(
            "<body>",
            "<body><p>{marker}</p>",
          ),
      );
      started = await start(app);
      let response = await fetch(started.url);
      assert.equal(response.status, 200);
      let html = await response.text();
      assert.match(html, /worker-branch/);
      assert.match(html, /href="\/app\/public\/worker-only\.css"/);
    } finally {
      await started?.server.close();
      await app.cleanup();
    }
  });

  it("returns loadable bootstrap-only CSS from the shared document factory in development and production", async () => {
    let documentFactory = await readFile(resolve("app/assets.ts"), "utf8");
    // Fonts are unrelated setup: follow the app's current filenames rather
    // than making this CSS regression depend on a fixed typography inventory.
    let fonts = await readdir(resolve("app/assets/public/font"));
    let app = await fixture({
      "app/assets.ts": documentFactory,
      "app/actions/public/entry.tsx":
        'import "../../assets/public/browser-only.css";console.log("bootstrap");',
      "app/assets/public/site.css": "body{--site:1}",
      "app/assets/public/browser-only.css": "body{--bootstrap-only:1}",
      ...Object.fromEntries(
        fonts.map((name) => [`app/assets/public/font/${name}`, "fixture-font"]),
      ),
      "app/server.tsx": `import manifest from "./asset-manifest.ts";
import {createAssetResolver} from ${JSON.stringify(resolve("app/asset-resolver.ts"))};
import {getDocumentAssets} from "./assets.ts";
let assets=createAssetResolver(manifest);
let documentAssets=await getDocumentAssets(assets);
export default {fetch(){return Response.json(documentAssets.stylesheets);}};
if(import.meta.hot)import.meta.hot.accept();`,
    });
    let started: Awaited<ReturnType<typeof start>> | undefined;
    function assertStyles(css: string[]) {
      // Expected CSS is known independently of the manifest producer. Comparing
      // two manifest-derived lists could miss both sides omitting a dependency.
      assert.match(css.join("\n"), /--site/);
      assert.match(css.join("\n"), /--bootstrap-only/);
    }
    try {
      started = await start(app);
      let response = await fetch(started.url);
      assert.equal(response.status, 200);
      let hrefs: string[] = await response.json();
      let url = started.url;
      assertStyles(
        await Promise.all(
          hrefs.map(async (href) => {
            let css = await fetch(url + href, {
              headers: { Accept: "text/css" },
            });
            assert.equal(css.status, 200);
            return css.text();
          }),
        ),
      );
      await started.server.close();
      started = undefined;
      let builder = await createBuilder({
        configFile: false,
        root: app.root,
        logLevel: "silent",
        oxc: { jsx: { development: false } },
        plugins: app.plugins(),
      });
      await builder.buildApp();
      let worker = await import(
        pathToFileURL(resolve(app.root, "dist/ssr/index.js")).href
      );
      let builtResponse = await worker.default.fetch(
        new Request("https://store.test/"),
      );
      assert.equal(builtResponse.status, 200);
      hrefs = await builtResponse.json();
      assertStyles(
        await Promise.all(
          hrefs.map((href) =>
            readFile(resolve(app.root, "dist/client", href.slice(1)), "utf8"),
          ),
        ),
      );
    } finally {
      await started?.server.close();
      await app.cleanup();
    }
  });

  it("refuses static development reads of server files, including /@fs URLs", async () => {
    let app = await fixture({ "app/private.txt": "NOT_PUBLIC_CONTENT" });
    let started: Awaited<ReturnType<typeof start>> | undefined;
    try {
      started = await start(app);
      for (let href of [
        "/app/private.txt",
        `/@fs/${resolve(app.root, "app/private.txt")}`,
      ]) {
        let response: Response = await fetch(started.url + href);
        assert.equal(response.status, 404);
        assert.doesNotMatch(await response.text(), /NOT_PUBLIC_CONTENT/);
      }
      let font = await fetch(`${started.url}/app/public/font.woff2`);
      assert.equal(font.status, 200);
      assert.equal(await font.text(), "fixture-font");
    } finally {
      await started?.server.close();
      await app.cleanup();
    }
  });
});
