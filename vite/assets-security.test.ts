import { readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createBuilder } from "vite";

import { fixture, linkHrefs } from "./testing/asset-fixture.ts";

async function build(app: Awaited<ReturnType<typeof fixture>>) {
  let builder = await createBuilder({
    configFile: false,
    root: app.root,
    logLevel: "silent",
    oxc: { jsx: { development: false } },
    plugins: app.plugins(),
  });
  await builder.buildApp();
}

describe("browser output boundary", () => {
  let cases: Record<string, Record<string, string>> = {
    "imports outside app": {
      "private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/entry.ts":
        'import {secret} from "../../private.ts";console.log(secret);',
    },
    "raw server imports": {
      "app/private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/entry.ts":
        'import source from "../private.ts?raw";console.log(source);',
    },
    "CSS URL assets": {
      "app/private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/site.css": 'body{background:url("../private.ts")}',
    },
    "inlined CSS URL assets": {
      "app/private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/site.css": 'body{background:url("../private.ts?inline")}',
    },
    "CSS image-set assets": {
      "app/private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/site.css":
        'body{background-image:image-set("../private.ts?inline" 1x)}',
    },
    "imported private CSS": {
      "app/private.css": "body{--secret:SERVER_ONLY_SENTINEL}",
      "app/public/site.css": '@import "../private.css";',
    },
  };
  for (let [name, files] of Object.entries(cases)) {
    it(`rejects ${name} before publishing browser output`, async () => {
      let app = await fixture(files);
      try {
        await assert.rejects(() => build(app), /Server-only file/);
      } finally {
        await app.cleanup();
      }
    });
  }

  it("rejects public symlinks that resolve to server-only sources", async () => {
    let app = await fixture({
      "private.ts": 'export const secret="SERVER_ONLY_SENTINEL";',
      "app/public/entry.ts":
        'import {secret} from "./escape.ts";console.log(secret);',
    });
    try {
      await symlink(
        "../../private.ts",
        resolve(app.root, "app/public/escape.ts"),
      );
      await assert.rejects(() => build(app), /Server-only file/);
    } finally {
      await app.cleanup();
    }
  });

  it("keeps server maps private while serving SSR stylesheet and URL resources", async () => {
    let app = await fixture({
      "app/public/server.css": 'body{background:url("./server-image.svg")}',
      "app/public/server-image.svg":
        '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
    });
    try {
      await writeFile(
        resolve(app.root, "app/server.tsx"),
        app.files["app/server.tsx"] + "\n// SERVER_ONLY_SENTINEL\n",
      );
      // Exercise config-file reloads too: Vite recreates CSS plugins for the
      // client environment while the assets plugin itself remains shared.
      let configFile = resolve(app.root, "vite.config.ts");
      await writeFile(
        configFile,
        `import {oxygen} from "@shopify/mini-oxygen/vite";
import {remixOxygen} from ${JSON.stringify(resolve("vite/remix-oxygen.ts"))};
export default {oxc:{jsx:{development:false}},build:{sourcemap:true},plugins:[
  oxygen({entry:"./app/server.tsx",env:{}}),
  remixOxygen({serverEntry:"app/server.tsx",clientEntry:"app/public/entry.ts",compatibilityDate:"2026-04-01"})
]};`,
      );
      let builder = await createBuilder({
        configFile,
        root: app.root,
        logLevel: "silent",
      });
      await builder.buildApp();
      let client = resolve(app.root, "dist/client");
      await assert.rejects(
        () => readFile(resolve(client, "oxygen.json")),
        /ENOENT/,
      );
      let serverMap = await readFile(
        resolve(app.root, "dist/server/index.js.map"),
        "utf8",
      );
      assert.ok(
        serverMap.includes("SERVER_ONLY_SENTINEL"),
        "diagnostic server sources remain server-side",
      );
      for (let file of await readdir(client, { recursive: true })) {
        if (!/\.(js|map|css|json)$/.test(file)) continue;
        let source = await readFile(resolve(client, file), "utf8");
        assert.equal(
          source.includes("SERVER_ONLY_SENTINEL"),
          false,
          `server source leaked in ${file}`,
        );
      }
      let worker = await import(
        pathToFileURL(resolve(app.root, "dist/server/index.js")).href
      );
      let html = await (
        await worker.default.fetch(new Request("https://store.test/"))
      ).text();
      let stylesheets = linkHrefs(html, "stylesheet");
      let imageFound = false;
      for (let href of stylesheets) {
        let css = await readFile(resolve(client, href.slice(1)), "utf8");
        let image = css.match(/url\(["']?([^)'"\s]+\.svg)["']?\)/)?.[1];
        if (image) {
          imageFound = true;
          assert.match(
            await readFile(resolve(client, image.slice(1)), "utf8"),
            /<svg/,
          );
        }
      }
      assert.ok(imageFound, "SSR CSS must retain a deployable image resource");
    } finally {
      await app.cleanup();
    }
  });
});
