import * as assert from "remix/assert";
import type {
  FrameHandle,
  FrameReloadOptions,
  Handle,
  RemixNode,
} from "remix/component";
import { render } from "remix/component/test";
import { describe, it, type TestContext } from "remix/test";

import { SubscribeForm } from "./public/subscribe-form.tsx";

const VARIANT_ID = "gid://shopify/ProductVariant/222";

describe("subscribe form", () => {
  it("renders progressive fields and verified product identifiers", async (t) => {
    let { $, act } = renderForm(
      t,
      <SubscribeForm
        action="/subscribe"
        product={{ handle: "test-product", variantId: VARIANT_ID }}
      />,
    );
    await act(() => {});

    assert.equal($("form")?.getAttribute("method"), "post");
    assert.equal($("form")?.getAttribute("action"), "/subscribe");
    assert.equal(
      $('input[name="product-handle"]')?.getAttribute("value"),
      "test-product",
    );
    assert.equal(
      $('input[name="variant-id"]')?.getAttribute("value"),
      VARIANT_ID,
    );
    assert.equal($('input[name="consent"]')?.getAttribute("type"), "hidden");
    assert.equal($('input[name="consent"]')?.getAttribute("value"), "yes");
    assert.equal(emailInput($).required, true);
  });

  it("posts through its frame and shows pending until the frame renders", async (t) => {
    let server = pendingServer(t);
    let { $, act } = renderForm(
      t,
      <SubscribeForm action="/subscribe?product-handle=a" />,
      server,
    );
    await act(() => {});
    let email = emailInput($);
    await act(() => type(email, "member@example.com"));

    await act(() => form($).requestSubmit());
    assert.equal(server.requests.length, 1);
    let [request] = server.requests;
    assert.equal(request?.src, "/subscribe?product-handle=a");
    assert.equal(request?.method, "post");
    assert.equal(request?.body?.get("email"), "member@example.com");
    assert.equal(request?.body?.get("consent"), "yes");
    assert.equal(form($).getAttribute("aria-busy"), "true");
    assert.equal(email.readOnly, true);
    assert.equal(button($).textContent, "Subscribing…");

    // A second submit while saving sends nothing.
    await act(() => form($).requestSubmit());
    assert.equal(server.requests.length, 1);

    // Once the frame renders the server's answer, the form is idle again.
    await act(() => server.respond());
    assert.equal(form($).hasAttribute("aria-busy"), false);
    assert.equal(email.readOnly, false);
  });

  it("restores the controls with an error when the request fails", async (t) => {
    let server = pendingServer(t);
    let { $, act } = renderForm(
      t,
      <SubscribeForm action="/subscribe" />,
      server,
    );
    await act(() => {});
    await act(() => type(emailInput($), "member@example.com"));

    await act(() => form($).requestSubmit());
    await act(() => server.fail(new TypeError("Failed to fetch")));

    assert.equal(
      $('[role="alert"]')?.textContent,
      "Something went wrong. Please try again.",
    );
    assert.equal(button($).textContent, "Subscribe");
    assert.equal(emailInput($).readOnly, false);
    assert.equal(emailInput($).value, "member@example.com");
  });

  it("restores the email and shows the server's error", async (t) => {
    let { $, act } = renderForm(
      t,
      <SubscribeForm
        action="/subscribe"
        submission={{
          errors: { fields: {}, form: ["Please try later."] },
          values: { email: "member@example.com" },
        }}
      />,
    );
    await act(() => {});

    assert.equal(emailInput($).value, "member@example.com");
    assert.equal($('[role="alert"]')?.textContent, "Please try later.");
    assert.equal(button($).disabled, false);
  });

  it("shows email errors once the field is left, and links them to it", async (t) => {
    let { $, act } = renderForm(t, <SubscribeForm action="/subscribe" />);
    await act(() => {});
    let email = emailInput($);

    await act(() => {
      email.focus();
      type(email, "not-an-email");
    });
    assert.equal($('[role="alert"]'), null);

    await act(() => email.blur());
    let alert = $('[role="alert"]');
    assert.match(alert?.textContent ?? "", /valid email address/);
    assert.equal(email.getAttribute("aria-invalid"), "true");
    assert.equal(email.getAttribute("aria-describedby"), alert?.id);
  });

  it("confirms a signup, and editing the email starts a new one", async (t) => {
    let { $, act } = renderForm(
      t,
      <SubscribeForm
        action="/subscribe"
        message="Thanks for subscribing!"
        submission={{
          errors: { fields: {} },
          values: { email: "member@example.com" },
        }}
      />,
    );
    await act(() => {});

    assert.equal($('[role="status"]')?.textContent, "Thanks for subscribing!");
    assert.equal(button($).disabled, true);
    assert.ok(button($).querySelector("svg"));
    assert.equal(emailInput($).value, "member@example.com");

    await act(() => type(emailInput($), "other@example.com"));
    assert.equal($('[role="status"]'), null);
    assert.equal(button($).disabled, false);
    assert.equal(button($).textContent, "Subscribe");
  });
});

/**
 * Renders the form in a test root. With `server`, the frame the form is in
 * hands its reloads to the test instead of the network.
 */
function renderForm(
  t: TestContext,
  node: JSX.Element,
  server?: ReturnType<typeof pendingServer>,
) {
  let view = render(
    server ? <FrameSpy onFrame={server.attach}>{node}</FrameSpy> : node,
  );
  t.after(view.cleanup);
  return view;
}

function FrameSpy(
  handle: Handle<{ children: RemixNode; onFrame(frame: FrameHandle): void }>,
) {
  handle.props.onFrame(handle.frame);
  return () => handle.props.children;
}

type Query = ReturnType<typeof render>["$"];

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function form($: Query): HTMLFormElement {
  let element = $("form");
  assert.ok(element instanceof HTMLFormElement);
  return element;
}

function emailInput($: Query): HTMLInputElement {
  let element = $('input[name="email"]');
  assert.ok(element instanceof HTMLInputElement);
  return element;
}

function button($: Query): HTMLButtonElement {
  let element = $('button[type="submit"]');
  assert.ok(element instanceof HTMLButtonElement);
  return element;
}

/** Frame reloads that wait for the test to answer them. */
function pendingServer(t: TestContext) {
  let requests: FrameReloadOptions[] = [];
  let answer = Promise.withResolvers<AbortSignal>();
  return {
    requests,
    attach(frame: FrameHandle) {
      t.mock.method(frame, "reload", (options: FrameReloadOptions = {}) => {
        requests.push(options);
        return answer.promise;
      });
    },
    respond: () => answer.resolve(new AbortController().signal),
    fail: (error: Error) => answer.reject(error),
  };
}
