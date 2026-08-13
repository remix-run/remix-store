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
    let title = backInStock ? "Notify me when it’s back" : undefined;
    return (
      <section aria-label={title} mix={formSectionStyle}>
        {title ? <h2>{title}</h2> : null}
        {backInStock ? (
          <p>
            Enter your email and we’ll let you know when this option returns.
          </p>
        ) : null}
        <form
          action={handle.props.action}
          method="post"
          aria-busy={pending ? "true" : undefined}
          mix={[
            formStyle,
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
          <label for={backInStock ? "back-in-stock-email" : "subscribe-email"}>
            Email address
          </label>
          <div mix={controlsStyle}>
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
              mix={on("input", () => {
                if (!result) return;
                result = undefined;
                handle.update();
              })}
            />
            <button type="submit" disabled={pending || complete}>
              {pending
                ? "Subscribing…"
                : result?.success
                  ? "Subscribed ✓"
                  : backInStock
                    ? "Notify me"
                    : "Subscribe"}
            </button>
          </div>
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
          {backInStock ? (
            <>
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
          ) : null}
          {result?.success ? (
            <p role="status" mix={successStyle}>
              {result.message}
            </p>
          ) : result?.error ? (
            <p role="alert" mix={errorStyle}>
              {result.error}
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
  "& h2, & p": { margin: 0 },
});
const formStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  "& > label:first-child": {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
});
const controlsStyle = css({
  display: "grid",
  gap: "8px",
  "@media (min-width: 540px)": { gridTemplateColumns: "minmax(0, 1fr) auto" },
  "& input": {
    background: "transparent",
    border: "3px solid var(--color-white)",
    borderRadius: "54px",
    color: "var(--color-white)",
    fontSize: "1rem",
    minHeight: "56px",
    padding: "12px 20px",
  },
  "& button": {
    background: "var(--color-white)",
    borderRadius: "54px",
    color: "var(--color-black)",
    fontSize: "1rem",
    fontWeight: 700,
    minHeight: "56px",
    padding: "12px 24px",
  },
  "& button:disabled": { opacity: 0.6 },
});
const consentStyle = css({
  alignItems: "start",
  display: "flex",
  fontSize: "0.875rem",
  gap: "8px",
  lineHeight: 1.4,
  "& input": { marginTop: "3px" },
});
const successStyle = css({ color: "var(--color-green-brand)", margin: 0 });
const errorStyle = css({ color: "var(--color-red-brand)", margin: 0 });
