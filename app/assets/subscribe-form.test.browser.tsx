import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import { SubscribeForm } from "./public/subscribe-form.tsx";

describe("subscribe form", () => {
  it("renders progressive fields and verified product identifiers", async (t) => {
    let { $, act, cleanup } = render(
      <SubscribeForm
        action="/subscribe"
        mode="back-in-stock"
        productHandle="test-product"
        variantId="gid://shopify/ProductVariant/222"
      />,
    );
    t.after(cleanup);
    await flushAsync(act);

    assert.equal($("form")?.getAttribute("method"), "post");
    assert.equal($("form")?.getAttribute("action"), "/subscribe");
    assert.equal(
      $('input[name="product-handle"]')?.getAttribute("value"),
      "test-product",
    );
    assert.equal(
      $('input[name="variant-id"]')?.getAttribute("value"),
      "gid://shopify/ProductVariant/222",
    );
    assert.equal($('input[name="variant-title"]'), null);
    assert.equal($('input[name="consent"]')?.getAttribute("type"), "hidden");
    assert.equal($('input[name="consent"]')?.getAttribute("value"), "yes");
  });

  it("posts the hydrated form and renders pending then success", async (t) => {
    let deferred = createDeferred<Response>();
    let requests: Array<{ body: URLSearchParams; input: string }> = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          body: parseUrlEncodedBody(init?.body),
          input: String(input),
        });
        return deferred.promise;
      },
    );
    let view = render(<SubscribeForm action="/subscribe" mode="newsletter" />);
    t.after(view.cleanup);
    await flushAsync(view.act);
    fillForm(view.$);

    await view.act(() => submit(view.$));
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0]!.input).pathname, "/subscribe");
    assert.equal(requests[0]?.body.get("email"), "member@example.com");
    assert.equal(requests[0]?.body.get("consent"), "yes");
    assert.equal(button.textContent, "Subscribing…");
    assert.equal(button.disabled, true);
    assert.equal(view.$("form")?.getAttribute("aria-busy"), "true");

    deferred.resolve(
      Response.json({ message: "Thanks for subscribing!", success: true }),
    );
    await waitFor(() => view.$('[role="status"]') !== null, view.act);

    button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(
      view.$('[role="status"]')?.textContent,
      "Thanks for subscribing!",
    );
    assert.equal(button.querySelector("svg") instanceof SVGElement, true);
    assert.equal(button.disabled, true);
  });

  it("hydrates a server-rendered success as completed and disabled", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls += 1;
      throw new Error("must not fetch a completed subscription");
    });
    let view = render(
      <SubscribeForm
        action="/subscribe"
        initialResult={{ message: "Already subscribed", success: true }}
        mode="newsletter"
      />,
    );
    t.after(view.cleanup);
    await flushAsync(view.act);

    assert.equal(view.$('[role="status"]')?.textContent, "Already subscribed");
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, true);
    await view.act(() => submit(view.$));
    assert.equal(calls, 0);
  });

  it("guards duplicate submissions while pending and after success", async (t) => {
    let deferred = createDeferred<Response>();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return deferred.promise;
    });
    let view = render(<SubscribeForm action="/subscribe" mode="newsletter" />);
    t.after(view.cleanup);
    await flushAsync(view.act);
    fillForm(view.$);

    await view.act(() => {
      submit(view.$);
      submit(view.$);
    });
    assert.equal(calls, 1);

    deferred.resolve(Response.json({ message: "Subscribed", success: true }));
    await waitFor(() => view.$('[role="status"]') !== null, view.act);
    await view.act(() => submit(view.$));
    assert.equal(calls, 1);

    let email = view.$('input[name="email"]');
    assert.ok(email instanceof HTMLInputElement);
    await view.act(() => {
      email.value = "other@example.com";
      email.dispatchEvent(new Event("input", { bubbles: true }));
    });
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, false);
  });

  it("renders server and network failures and restores controls", async (t) => {
    let responses: Array<Response | Error> = [
      Response.json(
        { error: "Please try later.", success: false },
        { status: 429 },
      ),
      new Error("network detail must not render"),
    ];
    t.mock.method(globalThis, "fetch", async () => {
      let response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw new Error("Unexpected request");
      return response;
    });
    let view = render(<SubscribeForm action="/subscribe" mode="newsletter" />);
    t.after(view.cleanup);
    await flushAsync(view.act);
    fillForm(view.$);

    await view.act(() => submit(view.$));
    await waitFor(
      () => view.$('[role="alert"]')?.textContent === "Please try later.",
      view.act,
    );
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, false);

    await view.act(() => submit(view.$));
    await waitFor(
      () =>
        view
          .$('[role="alert"]')
          ?.textContent?.includes("Something went wrong") === true,
      view.act,
    );
    assert.doesNotMatch(
      view.$('[role="alert"]')?.textContent ?? "",
      /network detail/,
    );
    button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, false);
  });
});

type Query = ReturnType<typeof render>["$"];
type Act = ReturnType<typeof render>["act"];

function parseUrlEncodedBody(
  body: BodyInit | null | undefined,
): URLSearchParams {
  if (body instanceof URLSearchParams) return body;
  throw new Error("Expected a URL-encoded subscription request body");
}

function fillForm($: Query) {
  let email = $('input[name="email"]');
  assert.ok(email instanceof HTMLInputElement);
  email.value = "member@example.com";
}

function submit($: Query) {
  let form = $("form");
  assert.ok(form instanceof HTMLFormElement);
  form.dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushAsync(act: Act) {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitFor(predicate: () => boolean, act: Act) {
  let deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for subscribe form");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await act(() => {});
  }
}
