import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { createAssetResolver, type AssetsManifest } from "./asset-resolver.ts";

const manifest: AssetsManifest = {
  mode: "build",
  entries: {
    "app/public/counter.tsx": {
      kind: "script",
      href: "/assets/counter.js",
      preloads: ["/assets/counter.js", "/assets/shared.js"],
    },
    "app/public/site.css": {
      kind: "style",
      href: "/assets/site.css",
      preloads: [],
    },
  },
  stylesheets: {
    "app/server.tsx": ["/assets/site.css"],
    "app/public/counter.tsx": ["/assets/site.css"],
    "app/public/site.css": ["/assets/site.css"],
  },
  importMap: { imports: {} },
};

describe("asset resolver", () => {
  it("normalizes portable identities and deduplicates shared resource hints", async () => {
    let assets = createAssetResolver(manifest);
    assert.equal(
      (await assets.getScriptEntry("file:app/public/counter.tsx#Counter")).href,
      "/assets/counter.js",
    );
    assert.deepEqual(
      await assets.getPreloads([
        "app/public/counter.tsx",
        "app/public/counter.tsx",
      ]),
      ["/assets/counter.js", "/assets/shared.js"],
    );
    assert.deepEqual(
      await assets.getStylesheets(["app/server.tsx", "app/public/counter.tsx"]),
      ["/assets/site.css"],
    );
  });

  it("does not turn observed server modules or unknown paths into browser outputs", async () => {
    let assets = createAssetResolver(manifest);
    await assert.rejects(
      () => assets.getScriptEntry("app/server.tsx"),
      /no browser output registered/,
    );
    for (let key of ["__proto__", "constructor"]) {
      await assert.rejects(
        () => assets.getHref(key),
        /no browser output registered/,
      );
      await assert.rejects(
        () => assets.getStylesheets(key),
        /unknown source module/,
      );
    }
    await assert.rejects(
      () => assets.getHref("app/missing.ts"),
      /no browser output registered/,
    );
    await assert.rejects(
      () => assets.getStylesheets("app/missing.ts"),
      /unknown source module/,
    );
    await assert.rejects(
      () => assets.getScriptEntry("app/public/site.css"),
      /not a script entry/,
    );
    await assert.rejects(
      () => assets.getHref("file:../secret.ts"),
      /root-relative/,
    );
    await assert.rejects(
      () => assets.getHref("file:///build-machine/app/counter.tsx"),
      /root-relative/,
    );
  });

  it("fails honestly outside Vite instead of fabricating dev URLs", async () => {
    let assets = createAssetResolver({ mode: "unavailable" });
    await assert.rejects(
      () => assets.getScriptEntry("app/public/counter.tsx"),
      /manifest unavailable/,
    );
  });
});
