import {
  clientEntry,
  css,
  on,
  type Handle,
  type SerializableObject,
} from "remix/ui";

export interface SubscribeFormProps extends SerializableObject {
  action: string;
  initialResult?: SubscribeResponse;
  mode: "newsletter" | "back-in-stock";
  productHandle?: string;
  variantId?: string;
}

export interface SubscribeResponse extends SerializableObject {
  error?: string;
  message?: string;
  success?: boolean;
}

export const SubscribeForm = clientEntry(
  import.meta.url,
  SubscribeFormComponent,
);

export function SubscribeFormComponent(handle: Handle<SubscribeFormProps>) {
  let pending = false;
  let result = handle.props.initialResult;
  let submission = 0;

  return () => {
    let backInStock = handle.props.mode === "back-in-stock";
    let complete = result?.success === true;
    return (
      <section
        aria-label={backInStock ? "Notify me when it’s back" : undefined}
        mix={backInStock ? backInStockSectionStyle : formSectionStyle}
      >
        <form
          action={handle.props.action}
          method="post"
          aria-busy={pending ? "true" : undefined}
          mix={[
            backInStock ? backInStockFormStyle : formStyle,
            on("submit", async (event, signal) => {
              event.preventDefault();
              // Capture currentTarget synchronously: browsers clear it after
              // event dispatch, before the first awaited render completes.
              let form = event.currentTarget;
              if (pending || complete) return;
              let body = urlEncodedForm(form);
              let current = ++submission;
              pending = true;
              result = undefined;
              await handle.update();
              try {
                let response = await fetch(form.action, {
                  method: "POST",
                  body,
                  headers: { Accept: "application/json" },
                  signal,
                });
                let next = (await response.json()) as SubscribeResponse;
                if (!isSubscribeResponse(next)) {
                  throw new Error("Invalid subscription response");
                }
                if (current === submission) result = next;
              } catch {
                if (!signal.aborted && current === submission) {
                  result = {
                    error: "Something went wrong. Please try again.",
                    success: false,
                  };
                }
              } finally {
                if (current === submission) {
                  pending = false;
                  await handle.update();
                }
              }
            }),
          ]}
        >
          <label
            for={backInStock ? "back-in-stock-email" : "subscribe-email"}
            mix={visuallyHiddenStyle}
          >
            {backInStock
              ? "Email address for stock notifications"
              : "Email address"}
          </label>
          <div mix={backInStock ? notifyRowStyle : newsletterRowStyle}>
            <input
              id={backInStock ? "back-in-stock-email" : "subscribe-email"}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="run@remix.run"
              required
              disabled={pending}
              mix={[
                backInStock ? backInStockInputStyle : emailInputStyle,
                complete ? successInputStyle : undefined,
                on("input", () => {
                  if (!result) return;
                  result = undefined;
                  handle.update();
                }),
              ]}
            />
            <button
              type="submit"
              disabled={pending || complete}
              mix={backInStock ? notifyButtonStyle : subscribeButtonStyle}
            >
              {pending
                ? backInStock
                  ? "Signing up…"
                  : "Subscribing…"
                : result?.success
                  ? backInStock
                    ? "Notify me"
                    : "Subscribed ✓"
                  : backInStock
                    ? "Notify me"
                    : "Subscribe"}
            </button>
          </div>
          {backInStock ? (
            <>
              <input type="hidden" name="consent" value="yes" />
              <input
                type="hidden"
                name="product-handle"
                value={handle.props.productHandle}
              />
              <input
                type="hidden"
                name="variant-id"
                value={handle.props.variantId}
              />
            </>
          ) : (
            <label mix={consentStyle}>
              <input
                type="checkbox"
                name="consent"
                value="yes"
                required
                disabled={pending || complete}
              />
              <span>
                I agree to receive email updates and marketing from Remix.
              </span>
            </label>
          )}
          {result?.success ? (
            <p role="status" mix={successStyle}>
              {result.message}
            </p>
          ) : result?.error ? (
            <p role="alert" mix={errorStyle}>
              {result.error}
            </p>
          ) : backInStock ? (
            <p mix={helperStyle}>
              This size is currently out of stock. Sign up to be notified by
              email when restock this size.
            </p>
          ) : null}
        </form>
      </section>
    );
  };
}

function urlEncodedForm(form: HTMLFormElement): URLSearchParams {
  let body = new URLSearchParams();
  for (let [name, value] of new FormData(form)) {
    if (typeof value === "string") body.append(name, value);
  }
  return body;
}

function isSubscribeResponse(value: unknown): value is SubscribeResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean"
  );
}

const formSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});
const backInStockSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: 0,
});
const formStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});
const newsletterRowStyle = css({
  display: "grid",
  gap: "8px",
  "@media (min-width: 540px)": { gridTemplateColumns: "minmax(0, 1fr) auto" },
});
const backInStockFormStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: 0,
});
const notifyRowStyle = css({
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
const emailInputStyle = css({
  background: "transparent",
  border: "3px solid var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-white)",
  fontSize: "1rem",
  minHeight: "56px",
  padding: "12px 20px",
  width: "100%",
});
const backInStockInputStyle = css({
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
  "&::placeholder": { color: "rgba(255,255,255,.6)", fontSize: "1.25rem" },
  "@media (min-width: 1400px)": {
    gridColumn: "span 2",
    minHeight: "66px",
  },
});
const successInputStyle = css({
  borderColor: "var(--color-green-brand)",
  color: "var(--color-green-brand)",
});
const subscribeButtonStyle = css({
  background: "var(--color-white)",
  border: 0,
  borderRadius: "54px",
  color: "var(--color-black)",
  fontSize: "1rem",
  fontWeight: 700,
  minHeight: "56px",
  padding: "12px 24px",
  "&:disabled": { opacity: 0.6 },
});
const notifyButtonStyle = css({
  background: "var(--color-white)",
  border: 0,
  borderRadius: "54px",
  color: "var(--color-black)",
  fontSize: "1.25rem",
  fontWeight: 600,
  height: "64px",
  minHeight: "64px",
  padding: "16px 12px",
  whiteSpace: "nowrap",
  width: "100%",
  "&:disabled": {
    background: "rgba(255,255,255,.2)",
    color: "rgba(255,255,255,.8)",
    cursor: "not-allowed",
  },
  "@media (min-width: 1400px)": { height: "66px", minHeight: "66px" },
});
const consentStyle = css({
  alignItems: "start",
  display: "flex",
  fontSize: "0.875rem",
  gap: "8px",
  lineHeight: 1.4,
  "& input": { marginTop: "3px" },
});
const helperStyle = css({
  color: "rgba(255,255,255,.6)",
  fontSize: ".75rem",
  gridColumn: "1 / -1",
  lineHeight: 1.4,
  margin: 0,
  "@media (min-width: 1400px)": { fontSize: ".875rem" },
});
const successStyle = css({
  color: "var(--color-green-brand)",
  fontSize: ".75rem",
  gridColumn: "1 / -1",
  margin: 0,
  "@media (min-width: 1400px)": { fontSize: ".875rem" },
});
const errorStyle = css({
  color: "var(--color-red-brand)",
  fontSize: ".75rem",
  gridColumn: "1 / -1",
  margin: 0,
  "@media (min-width: 1400px)": { fontSize: ".875rem" },
});
