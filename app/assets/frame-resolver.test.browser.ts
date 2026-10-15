import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";

import {
  prefetchFrame,
  resolveFrameResponse,
} from "./public/frame-resolver.ts";

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status,
  });
}

/** Records each request and answers with the next response, then "<p>ok</p>". */
function mockFetch(
  t: TestContext,
  responses: Array<() => Response | Promise<Response>> = [],
) {
  let requests: Request[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return (responses.shift() ?? (() => htmlResponse("<p>ok</p>")))();
    },
  );
  return requests;
}

describe("browser frame resolver", () => {
  it("preserves native form submissions and the response metadata", async (t) => {
    let request: Request | undefined;
    let frameResponse = htmlResponse("<!doctype html><h1>Subscribed</h1>");
    t.mock.method(
      globalThis,
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        request = new Request(input, init);
        return frameResponse;
      },
    );
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

  it("serves one navigation from a prefetched request", async (t) => {
    let requests = mockFetch(t, [() => htmlResponse("<h1>Prefetched</h1>")]);
    let url = new URL("https://store.example/products/served");

    prefetchFrame(url);
    prefetchFrame(url);
    let navigation = await resolveFrameResponse(new URL("#details", url));
    let later = await resolveFrameResponse(url);

    assert.equal(await navigation.text(), "<h1>Prefetched</h1>");
    assert.equal(await later.text(), "<p>ok</p>");
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.headers.get("X-Remix-Frame"), "true");
  });

  it("replaces an unused prefetch with the next one", async (t) => {
    let requests = mockFetch(t);
    let first = new URL("https://store.example/products/first-intent");

    prefetchFrame(first);
    prefetchFrame(new URL("https://store.example/products/second-intent"));
    await resolveFrameResponse(first);

    assert.equal(requests[0]?.signal.aborted, true);
    assert.equal(requests.length, 3);
  });

  it("requests the page again once a prefetch expires", async (t) => {
    let now = Date.now();
    t.mock.method(Date, "now", () => now);
    let requests = mockFetch(t);
    let url = new URL("https://store.example/products/expired");

    prefetchFrame(url);
    now += 30_001;
    await resolveFrameResponse(url);

    assert.equal(requests.length, 2);
  });

  it("requests the page again when a prefetch failed", async (t) => {
    let requests = mockFetch(t, [
      () => Promise.reject(new TypeError("offline")),
    ]);
    let url = new URL("https://store.example/products/offline");

    prefetchFrame(url);
    let response = await resolveFrameResponse(url);

    assert.equal(await response.text(), "<p>ok</p>");
    assert.equal(requests.length, 2);
  });

  it("shows the current page, not a prefetched error page", async (t) => {
    mockFetch(t, [() => htmlResponse("<h1>Unavailable</h1>", 503)]);
    let url = new URL("https://store.example/products/recovered");

    prefetchFrame(url);
    let response = await resolveFrameResponse(url);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<p>ok</p>");
  });

  it("drops the prefetch when a form submits through Remix", async (t) => {
    let requests = mockFetch(t);
    let url = new URL("https://store.example/products/after-submit");

    prefetchFrame(url);
    await resolveFrameResponse(new URL("https://store.example/subscribe"), {
      formData: new FormData(),
      method: "post",
    });
    await resolveFrameResponse(url);

    assert.equal(requests[0]?.signal.aborted, true);
    assert.equal(requests.length, 3);
  });

  it("leaves a prefetch for the page when a named frame loads its URL", async (t) => {
    let requests = mockFetch(t);
    let url = new URL("https://store.example/products/named-frame");

    prefetchFrame(url);
    await resolveFrameResponse(url, { target: "details" });
    await resolveFrameResponse(url);

    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.headers.get("X-Remix-Target"), "details");
  });

  it("cancels the prefetched request when its navigation is cancelled", async (t) => {
    let requests = mockFetch(t);
    let url = new URL("https://store.example/products/cancelled");
    let navigation = new AbortController();

    prefetchFrame(url);
    await resolveFrameResponse(url, { signal: navigation.signal });
    navigation.abort();

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.signal.aborted, true);
  });
});
