import * as assert from "remix/assert";
import { Frame } from "remix/component";
import { createRouter } from "remix/router";
import { describe, it } from "remix/test";

import { fetchWithRuntime, getRuntime, type Runtime } from "../runtime.ts";
import { render } from "./render.tsx";

function frameRouter() {
  let scriptEntry = {
    href: "/entry.js",
    preloads: [],
    importMap: { imports: {} },
  };
  return createRouter({
    middleware: [
      ...render({
        assets: {
          async getScriptEntry() {
            return scriptEntry;
          },
        },
        documentAssets: {
          scriptEntry,
          stylesheets: [],
          fonts: {
            interItalic: "/font",
            interRoman: "/font",
            jetBrainsMono: "/font",
            lexendZetta: "/font",
          },
        },
      }),
    ],
  });
}

describe("shared renderer runtime dispatch", () => {
  it("keeps env, buyer IP, cache and background work available through redirected and nested frames", async () => {
    let router = frameRouter();
    let scheduled: Promise<unknown>[] = [];
    let releaseFrame = Promise.withResolvers<void>();
    let cache: Pick<Cache, "match"> = {
      async match() {
        return new Response("scoped-cache");
      },
    };
    let runtime: Runtime = {
      env: { MARKER: "bound-runtime" },
      buyerIp: "trusted-ip",
      cache: cache as Cache,
      waitUntil(work) {
        scheduled.push(work);
      },
    };
    router.get("/", (context) =>
      context.render(
        <html>
          <body>
            <Frame src="/redirect" />
          </body>
        </html>,
      ),
    );
    router.get("/redirect", () =>
      Response.redirect("https://store.test/fragment", 302),
    );
    router.get("/fragment", (context) =>
      context.render(<Frame src="/nested" />),
    );
    router.get("/nested", async (context) => {
      await releaseFrame.promise;
      let bindings = getRuntime(context.request);
      let cached = await bindings.cache?.match("https://store.test/cached");
      bindings.waitUntil?.(Promise.resolve("frame-background-work"));
      return context.render(
        <p>
          {bindings.env?.MARKER}|{bindings.buyerIp}|{await cached?.text()}
        </p>,
      );
    });
    let request = new Request("https://store.test/");
    let response = await fetchWithRuntime(request, runtime, () =>
      router.fetch(request),
    );
    // Bindings are read only after the outer runtime boundary has returned.
    releaseFrame.resolve();
    assert.match(
      await response.text(),
      /bound-runtime\|trusted-ip\|scoped-cache/,
    );
    assert.ok((await Promise.all(scheduled)).includes("frame-background-work"));
  });

  it("keeps overlapping streamed requests isolated", async () => {
    let router = frameRouter();
    let barrier = Promise.withResolvers<void>();
    let arrived = 0;
    router.get("/", async (context) => {
      if (++arrived === 2) barrier.resolve();
      await barrier.promise;
      return context.render(
        <html>
          <body>
            <Frame src="/fragment" />
          </body>
        </html>,
      );
    });
    router.get("/fragment", (context) => {
      let bindings = getRuntime(context.request);
      return context.render(
        <p>
          {bindings.env?.MARKER}|{bindings.buyerIp}
        </p>,
      );
    });
    let html = await Promise.all(
      ["first-request", "second-request"].map(async (marker) => {
        let request = new Request("https://store.test/");
        let response = await fetchWithRuntime(
          request,
          { env: { MARKER: marker }, buyerIp: marker },
          () => router.fetch(request),
        );
        return response.text();
      }),
    );
    assert.match(html[0]!, /first-request\|first-request/);
    assert.doesNotMatch(html[0]!, /second-request/);
    assert.match(html[1]!, /second-request\|second-request/);
    assert.doesNotMatch(html[1]!, /first-request/);
  });

  it("does not forward trusted runtime or credentials through cross-origin frame redirects", async () => {
    let router = frameRouter();
    router.get("/", (context) =>
      context.render(
        <html>
          <body>
            <Frame src="/redirect" />
          </body>
        </html>,
      ),
    );
    router.get("/redirect", () =>
      Response.redirect("https://other.test/foreign", 302),
    );
    router.get("/foreign", (context) => {
      let bindings = getRuntime(context.request);
      assert.equal(bindings.env, undefined);
      assert.equal(bindings.buyerIp, undefined);
      assert.equal(bindings.cache, undefined);
      assert.equal(bindings.waitUntil, undefined);
      assert.equal(context.headers.get("Cookie"), null);
      assert.equal(context.headers.get("Authorization"), null);
      return context.render(<p>foreign frame without bindings</p>);
    });
    let request = new Request("https://store.test/", {
      headers: { Cookie: "session=private", Authorization: "fixture-auth" },
    });
    let response = await fetchWithRuntime(
      request,
      {
        env: { MARKER: "private" },
        buyerIp: "trusted-ip",
        cache: {} as Cache,
        waitUntil() {},
      },
      () => router.fetch(request),
    );
    assert.match(await response.text(), /foreign frame without bindings/);
  });
});
