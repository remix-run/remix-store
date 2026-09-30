import type { CartErrorState } from "@shopify/hydrogen";
import { clientEntry, css, on, type Handle } from "remix/ui";

import { getBrowserCartStore, getCartApiPath } from "./cart-store.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";

type ProductAddToCartProps = {
  /** The selected variant's merchandise ID. Empty when no variant is resolved. */
  merchandiseId: string;
  /** Whether the selected variant is purchasable right now. */
  available: boolean;
  /** Button label, e.g. "Add to cart" or the variant's price-aware label. */
  label: string;
  pathPrefix?: MarketPathPrefix;
};

/**
 * Add-to-cart control for the product page. The product page resolves the
 * selected variant server-side (link-based selection), so this is a thin
 * progressively-enhanced form: it posts to the cart API natively without JS,
 * and with JS it routes through the shared cart store.
 *
 * The full interactive product form (client-side variant store, gallery
 * carousel, Shop Pay) is out of scope for the cart port and tracked separately.
 */
export const ProductAddToCart = clientEntry(
  import.meta.url,
  function ProductAddToCart(handle: Handle<ProductAddToCartProps>) {
    let pending = false;
    let submissionError = "";
    let submission = 0;

    return () => {
      let { available, label, merchandiseId } = handle.props;
      let disabled = !available || !merchandiseId || pending;
      let messages = submissionError ? [submissionError] : [];

      return (
        <form
          action={getCartApiPath(handle.props.pathPrefix)}
          method="post"
          aria-busy={pending ? "true" : undefined}
          mix={[
            addFormStyle,
            pending ? pendingStyle : undefined,
            on("submit", async (event) => {
              event.preventDefault();
              if (disabled) return;

              let store = getBrowserCartStore(
                undefined,
                handle.props.pathPrefix,
              );
              if (!store) return;

              let currentSubmission = ++submission;
              let previousQuantity = store.getState().data.totalQuantity;
              submissionError = "";
              pending = true;
              handle.update();

              try {
                await store.handleFormSubmit(event);
                // Standard Actions resolves the request before all listeners'
                // promise callbacks have published their reconciled state.
                await Promise.resolve();
                let state = store.getState();
                if (state.data.totalQuantity <= previousQuantity) {
                  submissionError = getAddErrorMessage(state.errors);
                }
              } catch (error) {
                if (currentSubmission === submission) {
                  submissionError =
                    error instanceof Error
                      ? error.message
                      : "The item could not be added.";
                }
              } finally {
                if (currentSubmission === submission) {
                  pending = false;
                  handle.update();
                }
              }
            }),
          ]}
        >
          <input type="hidden" name="merchandiseId" value={merchandiseId} />
          <input type="hidden" name="quantity" value="1" />
          <button type="submit" disabled={disabled}>
            {pending ? "Adding…" : label}
          </button>
          {messages.length ? (
            <div role="alert" mix={errorStyle}>
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </form>
      );
    };
  },
);

function getAddErrorMessage(errors: CartErrorState): string {
  let messages = [
    ...errors.network.map((error) => error.message),
    ...errors.cart.userErrors.map((error) => error.message),
    ...errors.cart.warnings.map((warning) => warning.message),
  ];
  return messages[0] ?? "The item could not be added.";
}

const addFormStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
  "& button": {
    alignItems: "center",
    background: "var(--color-white)",
    borderRadius: "54px",
    color: "var(--color-black)",
    display: "flex",
    fontSize: "1.25rem",
    fontWeight: 600,
    gap: "10px",
    justifyContent: "center",
    minHeight: "64px",
    padding: "16px 24px",
    width: "100%",
  },
  "& button:disabled": { opacity: 0.5 },
});

const pendingStyle = css({ opacity: 0.7 });

const errorStyle = css({
  color: "var(--color-red-brand)",
  margin: 0,
  "& p": { margin: 0 },
});
