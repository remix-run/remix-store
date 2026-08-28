import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import type { ProductCardData } from "../data/storefront.ts";
import { CollectionProductGrid } from "./public/collection-grid.tsx";

const firstProduct = product("first", "First product");
const secondProduct = product("second", "Second product");

describe("collection grid interactions", () => {
  it("loads, deduplicates, and appends the next page", async (t) => {
    let requestedUrl: URL | undefined;
    let requestedInit: RequestInit | undefined;
    let resolveFetch: ((response: Response) => void) | undefined;
    let fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    let fetchMock: typeof globalThis.fetch = async (input, init) => {
      requestedUrl = new URL(String(input));
      requestedInit = init;
      return fetchPromise;
    };
    t.mock.method(globalThis, "fetch", fetchMock);

    let { $, $$, act, cleanup, container } = render(
      <CollectionProductGrid
        action="/collections/racing"
        products={[firstProduct]}
        pageInfo={{ hasNextPage: true, endCursor: "next-page" }}
      />,
    );
    t.after(cleanup);

    let form = $("form");
    assert.ok(form instanceof HTMLFormElement);
    await act(() =>
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      ),
    );

    let button = $("button");
    let grid = $("ul");
    assert.ok(button instanceof HTMLButtonElement);
    assert.ok(grid instanceof HTMLUListElement);
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, "Loading…");
    assert.equal(grid.getAttribute("aria-busy"), "true");
    assert.equal(requestedUrl?.pathname, "/collections/racing");
    assert.equal(requestedUrl?.searchParams.get("cursor"), "next-page");
    assert.equal(
      new Headers(requestedInit?.headers).get("Accept"),
      "application/json",
    );

    assert.ok(resolveFetch);
    let resolveResponse = resolveFetch;
    let rendered = waitForDom(container, () => $("form") === null, t.signal);
    await act(async () => {
      resolveResponse(
        Response.json({
          products: [firstProduct, secondProduct],
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      );
      await fetchPromise;
      await Promise.resolve();
    });
    await rendered;

    assert.equal($("form"), null);
    assert.equal($$('a[href="/products/first"]').length, 1);
    assert.equal($$('a[href="/products/second"]').length, 1);
  });

  it("shows a retryable error for invalid responses", async (t) => {
    let fetchPromise = Promise.resolve(Response.error());
    t.mock.method(globalThis, "fetch", async () => fetchPromise);
    t.mock.method(console, "error", () => {});

    let { $, act, cleanup, container } = render(
      <CollectionProductGrid
        action="/collections/racing"
        products={[firstProduct]}
        pageInfo={{ hasNextPage: true, endCursor: "next-page" }}
      />,
    );
    t.after(cleanup);

    let form = $("form");
    assert.ok(form instanceof HTMLFormElement);
    let rendered = waitForDom(
      container,
      () => $("[role=alert]") !== null,
      t.signal,
    );
    await act(async () => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      );
      await fetchPromise;
      await Promise.resolve();
    });
    await rendered;

    let alert = $("[role=alert]");
    let button = $("button");
    assert.ok(alert instanceof HTMLParagraphElement);
    assert.ok(button instanceof HTMLButtonElement);
    assert.match(alert.textContent ?? "", /could not be loaded/i);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Load more");
  });
});

function waitForDom(
  container: HTMLElement,
  condition: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  if (condition()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let observer = new MutationObserver(() => {
      if (condition()) finish();
    });
    observer.observe(container, { childList: true, subtree: true });
    signal.addEventListener("abort", abort, { once: true });

    function finish() {
      observer.disconnect();
      signal.removeEventListener("abort", abort);
      resolve();
    }

    function abort() {
      observer.disconnect();
      reject(signal.reason);
    }
  });
}

function product(id: string, title: string): ProductCardData {
  return {
    compareAtPrice: null,
    handle: id,
    id,
    images: [],
    isOnSale: false,
    price: "$20.00",
    title,
  };
}
