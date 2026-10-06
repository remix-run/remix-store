import { readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { oxygen } from "@shopify/mini-oxygen/vite";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createBuilder, createServer } from "vite";

import { remixOxygen } from "./remix-oxygen.ts";
import { fixture, linkHrefs } from "./testing/asset-fixture.ts";

describe("local Vite assets", () => {
  it("builds a portable Worker with importable island exports and only static preload hints", async () => {
    let app = await fixture({
      // Both browser entries share this dependency, so it must be hinted;
      // the dynamic-only module must remain loadable without being preloaded.
      "app/public/entry.ts": 'export { href } from "./dependency.ts";',
      "app/public/dependency.ts":
        'export const message="first render"; export const href=import.meta.url;',
      "app/public/lazy.ts": "export const href=import.meta.url;",
    });
    try {
      await writeFile(
        resolve(app.root, "app/public/counter.tsx"),
        app.files["app/public/counter.tsx"] +
          '\nexport { href as sharedHref } from "./dependency.ts";',
      );
      let builder = await createBuilder({
        configFile: false,
        root: app.root,
        base: "/store/",
        logLevel: "silent",
        oxc: { jsx: { development: false } },
        plugins: app.plugins(),
      });
      await builder.buildApp();
      let workerPath = resolve(app.root, "dist/ssr/index.js");
      assert.equal(
        (await readFile(workerPath, "utf8")).includes(app.root),
        false,
        "Worker must not depend on checkout paths",
      );
      assert.deepEqual(
        (await readdir(resolve(app.root, "dist/ssr"))).filter((file) =>
          file.endsWith(".js"),
        ),
        ["index.js"],
        "deployment must not require server-side JS sidecars",
      );
      let worker = await import(pathToFileURL(workerPath).href);
      let response = await worker.default.fetch(
        new Request("https://example.com/store/products/item"),
      );
      assert.equal(response.status, 200);
      let html = await response.text();
      assert.match(html, /first render/);
      assert.match(html, /second island/);
      let hydration = JSON.parse(
        html.match(/<script[^>]*id="rmx-data"[^>]*>([\s\S]*?)<\/script>/)![1]!,
      );
      let records = Object.values(hydration.h) as Array<{
        moduleUrl: string;
        exportName: string;
      }>;
      assert.deepEqual(records.map((record) => record.exportName).sort(), [
        "First",
        "Second",
      ]);
      let preloads = linkHrefs(html, "modulepreload");
      let client = resolve(app.root, "dist/client");
      let publicHref = (url: string) =>
        "/store/" + relative(client, fileURLToPath(url)).replaceAll("\\", "/");
      for (let record of records) {
        let module = await import(
          pathToFileURL(
            resolve(client, record.moduleUrl.replace(/^\/store\//, "")),
          ).href
        );
        assert.equal(
          typeof module[record.exportName],
          "function",
          `missing export ${record.exportName}`,
        );
        assert.ok(preloads.includes(record.moduleUrl));
        assert.ok(
          preloads.includes(publicHref(module.sharedHref)),
          "shared static dependency must be preloaded",
        );
        let lazy = await module.loadLazy();
        assert.equal(
          preloads.includes(publicHref(lazy.href)),
          false,
          "dynamic-only dependency must not be preloaded",
        );
      }
    } finally {
      await app.cleanup();
    }
  });

  it("rejects server-only and test files as browser roots", async () => {
    for (let key of ["app/server.tsx", "app/public/counter.test.tsx"]) {
      let app = await fixture();
      try {
        await assert.rejects(async () => {
          let builder = await createBuilder({
            configFile: false,
            root: app.root,
            logLevel: "silent",
            plugins: [
              oxygen({ entry: "./app/server.tsx", env: {} }),
              remixOxygen({
                serverEntry: "app/server.tsx",
                clientEntry: "app/public/entry.ts",
                include: [key],
              }),
            ],
          });
          await builder.buildApp();
        }, /must live under app\/\*\*\/public/);
      } finally {
        await app.cleanup();
      }
    }
  });

  it("updates rendered styles and module-level data after development edits", async () => {
    let app = await fixture();
    let server: Awaited<ReturnType<typeof createServer>> | undefined;
    try {
      server = await createServer({
        configFile: false,
        root: app.root,
        logLevel: "silent",
        plugins: app.plugins(),
        server: { port: 0, host: "127.0.0.1" },
      });
      await server.listen();
      let address = server.httpServer!.address();
      assert.ok(address && typeof address === "object");
      let url = `http://127.0.0.1:${address.port}/`;
      let response = await fetch(url);
      assert.equal(response.status, 200);
      let html = await response.text();
      assert.match(html, /first render/);
      assert.match(html, /app\/public\/server\.css/);
      let serverSource = app.files["app/server.tsx"]!.replace(
        "./public/server.css",
        "./public/next.css",
      );
      await writeFile(resolve(app.root, "app/server.tsx"), serverSource);
      await until(
        url,
        (html) =>
          html.includes("first render") &&
          html.includes("app/public/next.css") &&
          !html.includes("app/public/server.css"),
      );
      await writeFile(
        resolve(app.root, "app/public/dependency.ts"),
        'export const message="updated render";',
      );
      await until(url, (html) => html.includes("updated render"));
      await writeFile(
        resolve(app.root, "app/server.tsx"),
        serverSource.replace('import "./public/next.css";', ""),
      );
      await until(
        url,
        (html) =>
          html.includes("updated render") &&
          !html.includes("app/public/next.css"),
      );
    } finally {
      await server?.close();
      await app.cleanup();
    }
  });
});

async function until(url: string, matches: (html: string) => boolean) {
  let deadline = Date.now() + 10_000;
  do {
    let response = await fetch(url);
    let html = await response.text();
    if (response.ok && matches(html)) return;
    // Poll observable responses, not an assumed HMR completion time.
    await setTimeout(20);
  } while (Date.now() < deadline);
  throw new Error("Development response did not reflect the source edit.");
}
