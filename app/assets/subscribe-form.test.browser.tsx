import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/component/test";

import { SubscribeForm } from "./public/subscribe-form.tsx";

// Submitting reloads the form's frame, which needs a mounted app and server.
// These tests cover what the form renders for each state the server sends.
describe("subscribe form", () => {
  it("renders progressive fields and verified product identifiers", async (t) => {
    let { $, act, cleanup } = render(
      <SubscribeForm
        action="/subscribe"
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

  it("renders a completed subscription as confirmed and disabled", async (t) => {
    let view = render(
      <SubscribeForm action="/subscribe" message="Already subscribed" />,
    );
    t.after(view.cleanup);
    await flushAsync(view.act);

    assert.equal(view.$('[role="status"]')?.textContent, "Already subscribed");
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, true);
    assert.equal(button.querySelector("svg") instanceof SVGElement, true);
    let email = view.$('input[name="email"]');
    assert.ok(email instanceof HTMLInputElement);
    assert.equal(email.readOnly, true);
  });

  it("waits for a submit attempt before showing client validation", async (t) => {
    let view = render(<SubscribeForm action="/subscribe" />);
    t.after(view.cleanup);
    await flushAsync(view.act);

    let email = view.$('input[name="email"]');
    assert.ok(email instanceof HTMLInputElement);
    await view.act(() => {
      email.focus();
      email.value = "not-an-email";
      email.dispatchEvent(new Event("input", { bubbles: true }));
      email.blur();
    });
    await flushAsync(view.act);
    assert.equal(view.$('[role="alert"]'), null);
    assert.equal(email.getAttribute("aria-invalid"), "false");

    // The browser blocks this submit, so only `invalid` fires.
    await view.act(() => {
      let form = view.$("form");
      assert.ok(form instanceof HTMLFormElement);
      form.requestSubmit();
    });
    await flushAsync(view.act);
    assert.match(
      view.$('[role="alert"]')?.textContent ?? "",
      /valid email address/,
    );
    assert.equal(email.getAttribute("aria-invalid"), "true");
  });

  it("restores the email and shows the error after a failed submission", async (t) => {
    let view = render(
      <SubscribeForm
        action="/subscribe"
        submission={{
          errors: { fields: {}, form: ["Please try later."] },
          values: { email: "member@example.com" },
        }}
      />,
    );
    t.after(view.cleanup);
    await flushAsync(view.act);

    let email = view.$('input[name="email"]');
    assert.ok(email instanceof HTMLInputElement);
    assert.equal(email.value, "member@example.com");
    assert.equal(view.$('[role="alert"]')?.textContent, "Please try later.");
    let button = view.$("button");
    assert.ok(button instanceof HTMLButtonElement);
    assert.equal(button.disabled, false);
  });
});

type Act = ReturnType<typeof render>["act"];

async function flushAsync(act: Act) {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
