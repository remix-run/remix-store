import * as form from "@remix-run/ui/form";
import { clientEntry, css, on, type Handle } from "remix/component";
import type { FormSubmission } from "remix/data-schema/experimental/form";

import {
  SubscriptionForm,
  type SubscriptionProduct,
} from "../../lib/public/subscription.ts";
import { Icon } from "../../ui/public/icon.tsx";

export type SubscribeFormProps = {
  /** Where the form posts. */
  action: string;
  /** The confirmation, once the signup has succeeded. */
  message?: string;
  /** Makes this a back-in-stock signup for the product's variant. */
  product?: SubscriptionProduct;
  /** What the last submission left behind: values to restore and errors. */
  submission?: FormSubmission;
};

const FAILED_MESSAGE = "Something went wrong. Please try again.";

/**
 * Newsletter and back-in-stock signup. Without JavaScript it is a native
 * form. With it, submitting reloads the frame the form is in with the form's
 * data, and the server answers with the form again, showing what happened.
 */
export const SubscribeForm = clientEntry(
  import.meta.url,
  function SubscribeForm(handle: Handle<SubscribeFormProps>) {
    let pending = false;
    let failed = false;
    // Editing the email after a signup starts a new one.
    let editedAfterSuccess = false;

    async function submit(
      event: SubmitEvent & { currentTarget: HTMLFormElement },
    ) {
      event.preventDefault();
      if (pending) return;
      let body = new FormData(event.currentTarget, event.submitter);
      pending = true;
      failed = false;
      handle.update();
      try {
        await handle.frame.reload({
          src: handle.props.action,
          method: "post",
          body,
        });
        editedAfterSuccess = false;
      } catch {
        failed = true;
      }
      if (handle.signal.aborted) return;
      pending = false;
      handle.update();
    }

    return () => {
      let { action, message, product, submission } = handle.props;
      let complete = message !== undefined && !editedAfterSuccess;

      return (
        <form.Context
          id={handle.id}
          schema={SubscriptionForm}
          submission={submission}
        >
          {({ errors, fields }) => {
            let emailErrors = fields.email.errors;
            // Everything else the server had to say: failures of the whole
            // request, and fields people can't edit.
            let otherErrors = failed
              ? [FAILED_MESSAGE]
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
                aria-label={product ? "Notify me when it’s back" : undefined}
                aria-busy={pending ? "true" : undefined}
                mix={[
                  product ? backInStockStyle : newsletterStyle,
                  form.root(),
                  on("submit", submit),
                ]}
              >
                <label mix={[visuallyHiddenStyle, form.label(fields.email)]}>
                  {product
                    ? "Email address for stock notifications"
                    : "Email address"}
                </label>
                <div mix={rowStyle}>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    placeholder="run@remix.run"
                    // Read-only, not disabled, so focus stays put while saving.
                    readOnly={pending}
                    mix={[
                      inputStyle,
                      complete ? successInputStyle : undefined,
                      form.control(fields.email),
                      on("input", () => {
                        if (!complete) return;
                        editedAfterSuccess = true;
                        handle.update();
                      }),
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
                      product ? (
                        "Signing up…"
                      ) : (
                        "Subscribing…"
                      )
                    ) : product ? (
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
                {product ? (
                  <>
                    <input
                      type="hidden"
                      value={product.handle}
                      mix={form.control(fields.productHandle)}
                    />
                    <input
                      type="hidden"
                      value={product.variantId}
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
                ) : product ? (
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
