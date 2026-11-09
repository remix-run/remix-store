import * as form from "@remix-run/ui/form";
import {
  clientEntry,
  css,
  on,
  type FrameReloadStartEvent,
  type Handle,
} from "remix/component";
import type { FormSubmission } from "remix/data-schema/experimental/form";

import { SubscriptionForm } from "../../lib/public/subscription-form.ts";
import { Icon } from "../../ui/public/icon.tsx";

export type SubscribeFormProps = {
  /** Where the form posts: its frame's source, without any outcome. */
  action: string;
  /** The confirmation, once the signup has succeeded. */
  message?: string;
  /** With `variantId`, makes this a back-in-stock signup for that product. */
  productHandle?: string;
  /** What a failed submission left behind: values to restore and messages. */
  submission?: FormSubmission;
  variantId?: string;
};

/**
 * Newsletter and back-in-stock signup. Without scripts it is a native form.
 * With them, submitting reloads the frame it is in with the form's data, and
 * the server answers with the form again, showing what happened.
 */
export const SubscribeForm = clientEntry(
  import.meta.url,
  function SubscribeForm(handle: Handle<SubscribeFormProps>) {
    // The frame reloading is the pending state, however it was started.
    let activeReload: FrameReloadStartEvent | undefined;
    let failed = false;
    // Listen once mounted: setup also runs while rendering on the server.
    handle.queueTask(() => {
      handle.frame.addEventListener(
        "reloadStart",
        async (event) => {
          activeReload = event;
          failed = false;
          handle.update();
          try {
            await event.finished;
          } catch {
            if (activeReload === event) failed = true;
          }
          if (handle.signal.aborted || activeReload !== event) return;
          activeReload = undefined;
          handle.update();
        },
        { signal: handle.signal },
      );
    });

    // Client feedback waits for a blocked submit, so people aren't told their
    // email is wrong just for tabbing past the field.
    let attempted = false;

    return () => {
      let { action, message, productHandle, submission, variantId } =
        handle.props;
      let backInStock = Boolean(productHandle && variantId);
      let complete = message !== undefined;
      let pending = activeReload !== undefined;

      return (
        <form.Context
          id={handle.id}
          schema={SubscriptionForm}
          submission={submission}
        >
          {({ errors, fields }) => {
            let showEmailErrors =
              attempted || Boolean(submission?.errors.fields.email?.length);
            let emailErrors = showEmailErrors ? fields.email.errors : [];
            // Everything else the server had to say: failures that belong to
            // the whole request, and fields people can't edit.
            let otherErrors = failed
              ? ["Something went wrong. Please try again."]
              : [
                  ...(errors.form ?? []),
                  ...fields.consent.errors,
                  ...fields.productHandle.errors,
                  ...fields.variantId.errors,
                ];

            return (
              <form
                action={action}
                method="post"
                aria-label={
                  backInStock ? "Notify me when it’s back" : undefined
                }
                aria-busy={pending ? "true" : undefined}
                mix={[
                  backInStock ? backInStockStyle : newsletterStyle,
                  form.root(),
                  // A blocked submit fires `invalid` on the control, not `submit`.
                  on(
                    "invalid",
                    () => {
                      attempted = true;
                      handle.update();
                    },
                    true,
                  ),
                  on("submit", (event) => {
                    event.preventDefault();
                    if (pending || complete) return;
                    let body = new FormData(
                      event.currentTarget,
                      event.submitter,
                    );
                    // reloadStart owns pending state and reports failures.
                    void handle.frame
                      .reload({ method: "post", body })
                      .catch(() => {});
                  }),
                ]}
              >
                <label mix={[visuallyHiddenStyle, form.label(fields.email)]}>
                  {backInStock
                    ? "Email address for stock notifications"
                    : "Email address"}
                </label>
                <div mix={rowStyle}>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="run@remix.run"
                    // Read-only, not disabled, so focus stays put while saving.
                    readOnly={pending || complete}
                    aria-invalid={emailErrors.length > 0 ? "true" : "false"}
                    mix={[
                      inputStyle,
                      complete ? successInputStyle : undefined,
                      form.control(fields.email),
                    ]}
                  />
                  <button
                    type="submit"
                    disabled={complete}
                    aria-disabled={pending ? "true" : undefined}
                    mix={[
                      buttonStyle,
                      complete ? successButtonStyle : undefined,
                    ]}
                  >
                    {complete ? (
                      <Icon name="check" />
                    ) : pending ? (
                      backInStock ? (
                        "Signing up…"
                      ) : (
                        "Subscribing…"
                      )
                    ) : backInStock ? (
                      "Notify me"
                    ) : (
                      "Subscribe"
                    )}
                  </button>
                </div>
                <input
                  type="hidden"
                  value="yes"
                  mix={form.control(fields.consent)}
                />
                {backInStock ? (
                  <>
                    <input
                      type="hidden"
                      value={productHandle}
                      mix={form.control(fields.productHandle)}
                    />
                    <input
                      type="hidden"
                      value={variantId}
                      mix={form.control(fields.variantId)}
                    />
                  </>
                ) : null}
                {complete ? (
                  <p role="status" mix={[noteStyle, successStyle]}>
                    {message}
                  </p>
                ) : emailErrors.length > 0 ? (
                  <p
                    role="alert"
                    mix={[noteStyle, errorStyle, form.error(fields.email)]}
                  >
                    {emailErrors.join(" ")}
                  </p>
                ) : otherErrors.length > 0 ? (
                  <p role="alert" mix={[noteStyle, errorStyle]}>
                    {otherErrors.join(" ")}
                  </p>
                ) : backInStock ? (
                  <p mix={[noteStyle, helperStyle]}>
                    This size is currently out of stock. Sign up to be notified
                    by email when restock this size.
                  </p>
                ) : null}
              </form>
            );
          }}
        </form.Context>
      );
    };
  },
);

const newsletterStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});
const backInStockStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: 0,
});
const rowStyle = css({
  display: "grid",
  gap: "16px",
  minWidth: 0,
  "@media (min-width: 1400px)": {
    gap: "12px",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
});
const visuallyHiddenStyle = css({
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});
const inputStyle = css({
  background: "transparent",
  border: "3px solid var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-white)",
  fontSize: "1.125rem",
  fontWeight: 600,
  minHeight: "64px",
  outline: "none",
  padding: "16px 24px",
  width: "100%",
  "&::placeholder": {
    color: "rgba(255,255,255,.6)",
    fontSize: "1.25rem",
  },
  "@media (min-width: 1400px)": {
    gridColumn: "span 2",
    minHeight: "66px",
  },
});
const successInputStyle = css({
  borderColor: "var(--color-green-brand)",
  color: "var(--color-green-brand)",
});
const buttonStyle = css({
  alignItems: "center",
  background: "var(--color-white)",
  border: 0,
  borderRadius: "54px",
  color: "var(--color-black)",
  display: "flex",
  fontSize: "1.25rem",
  fontWeight: 600,
  height: "64px",
  justifyContent: "center",
  minHeight: "64px",
  overflow: "hidden",
  padding: 0,
  whiteSpace: "nowrap",
  width: "100%",
  "&:disabled, &[aria-disabled='true']": {
    background: "rgba(255,255,255,.2)",
    color: "rgba(255,255,255,.8)",
    cursor: "not-allowed",
  },
  "& svg": {
    animation: "add-to-cart-check 400ms var(--ease-snap) 200ms both",
    display: "block",
    height: "32px",
    width: "32px",
  },
  "@media (min-width: 1400px)": { height: "66px", minHeight: "66px" },
});
const successButtonStyle = css({
  background: "var(--color-green-brand)",
  color: "var(--color-white)",
  "&:disabled": {
    background: "var(--color-green-brand)",
    color: "var(--color-white)",
    cursor: "default",
  },
});
const noteStyle = css({
  fontSize: ".75rem",
  gridColumn: "1 / -1",
  margin: 0,
  "@media (min-width: 1400px)": { fontSize: ".875rem" },
});
const helperStyle = css({ color: "rgba(255,255,255,.6)", lineHeight: 1.4 });
const successStyle = css({ color: "var(--color-green-brand)" });
const errorStyle = css({ color: "var(--color-red-brand)" });
