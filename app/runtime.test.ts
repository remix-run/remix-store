import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { fetchWithRuntime, getRuntime } from "./runtime.ts";

describe("request runtime", () => {
  it("isolates runtime values by request", async () => {
    let first = new Request("https://example.com/first");
    let second = new Request("https://example.com/second");

    await Promise.all([
      fetchWithRuntime(first, { env: { VALUE: "first" } }, async () => {
        await Promise.resolve();
        assert.equal(getRuntime(first).env?.VALUE, "first");
        assert.equal(getRuntime(second).env?.VALUE, "second");
        return new Response("first");
      }),
      fetchWithRuntime(second, { env: { VALUE: "second" } }, async () => {
        await Promise.resolve();
        assert.equal(getRuntime(second).env?.VALUE, "second");
        assert.equal(getRuntime(first).env?.VALUE, "first");
        return new Response("second");
      }),
    ]);
  });

  it("converts unexpected failures to a generic response", async (t) => {
    let logged: Error | undefined;
    t.mock.method(console, "error", (error: Error) => {
      logged = error;
    });
    let failure = new Error("private failure");

    let response = await fetchWithRuntime(
      new Request("https://example.com"),
      {},
      async () => {
        throw failure;
      },
    );

    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Internal Server Error");
    assert.equal(logged, failure);
  });

  it("does not log an expected request abort", async (t) => {
    let logged = false;
    t.mock.method(console, "error", () => {
      logged = true;
    });
    let controller = new AbortController();
    let request = new Request("https://example.com", {
      signal: controller.signal,
    });
    let reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    let response = await fetchWithRuntime(request, {}, async () => {
      throw reason;
    });

    assert.equal(response.status, 500);
    assert.equal(logged, false);
  });
});
