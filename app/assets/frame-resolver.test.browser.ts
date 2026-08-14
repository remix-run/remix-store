import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { resolveFrameResponse } from "./public/frame-resolver.ts";

describe("browser frame resolver", () => {
  it("preserves native form submissions and the response metadata", async (t) => {
    let request: Request | undefined;
    let frameResponse = new Response("<!doctype html><h1>Subscribed</h1>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    t.mock.method(globalThis, "fetch", (async (input, init) => {
      request = new Request(input, init);
      return frameResponse;
    }) as typeof globalThis.fetch);
    let formData = new FormData();
    formData.set("email", "runner@example.com");
    formData.set("consent", "yes");

    let response = await resolveFrameResponse(
      new URL("https://store.example/subscribe"),
      {
        encType: "application/x-www-form-urlencoded",
        formData,
        method: "post",
        target: "newsletter",
      },
    );

    assert.equal(response, frameResponse);
    assert.equal(request?.method, "POST");
    assert.equal(request?.headers.get("Accept"), "text/html");
    assert.equal(request?.headers.get("X-Remix-Frame"), "true");
    assert.equal(request?.headers.get("X-Remix-Target"), "newsletter");
    assert.match(
      request?.headers.get("Content-Type") ?? "",
      /^application\/x-www-form-urlencoded/,
    );
    assert.equal(
      await request?.text(),
      "email=runner%40example.com&consent=yes",
    );
  });
});
