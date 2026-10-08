import { clientEntry, css, on, type Handle } from "remix/component";

import { ProductCardSkeleton } from "./product-card.tsx";

const LOADING_PRODUCT_COUNT = 8;

/**
 * The last item of a product grid page. Without JavaScript it is a GET form
 * for the collection document at the next cursor. Enhanced, it reloads its
 * own frame with the next page of server-rendered cards, which ends in the
 * next control.
 */
export const LoadMoreProducts = clientEntry(
  import.meta.url,
  function LoadMoreProducts(
    handle: Handle<{
      action: string;
      cursor: string;
      failed?: boolean;
      src: string;
    }>,
  ) {
    let pending = false;
    let failed = false;

    return () => {
      // A failed page renders this control again with `failed`; the same
      // instance receives it, so derive the status from props on each render.
      let status = pending
        ? "loading"
        : failed || handle.props.failed
          ? "error"
          : "idle";

      return (
        <>
          {status === "loading"
            ? Array.from({ length: LOADING_PRODUCT_COUNT }, (_, index) => (
                <li key={`loading-product-${index}`}>
                  <ProductCardSkeleton />
                </li>
              ))
            : null}
          <li mix={controlStyle}>
            <form
              action={handle.props.action}
              method="get"
              mix={on("submit", async (event, signal) => {
                event.preventDefault();
                let lastProduct =
                  event.currentTarget.closest("li")?.previousElementSibling;
                pending = true;
                failed = false;
                await handle.update();
                try {
                  handle.frame.src = handle.props.src;
                  await handle.frame.reload();
                } catch (error) {
                  if (signal.aborted) return;
                  console.error(
                    "[collection] Unable to load more products",
                    error,
                  );
                  failed = true;
                }

                if (handle.signal.aborted) {
                  // The next page replaced this control. Continue from its
                  // first product without moving the viewport.
                  lastProduct?.nextElementSibling
                    ?.querySelector("a")
                    ?.focus({ preventScroll: true });
                  return;
                }
                pending = false;
                await handle.update();
              })}
            >
              <input type="hidden" name="cursor" value={handle.props.cursor} />
              <button
                type="submit"
                disabled={status === "loading"}
                mix={buttonStyle}
              >
                {status === "loading" ? "Loading…" : "Load more"}
              </button>
              {status === "error" ? (
                <p role="alert" mix={errorStyle}>
                  Products could not be loaded. Please try again.
                </p>
              ) : null}
            </form>
          </li>
        </>
      );
    };
  },
);

// Spans the grid and sits flush below the last row, like a footer.
const controlStyle = css({ gridColumn: "1 / -1" });

const buttonStyle = css({
  background: "var(--color-blue-brand)",
  border: 0,
  borderRadius: 0,
  color: "var(--color-white)",
  cursor: "pointer",
  display: "block",
  fontSize: "1.25rem",
  fontWeight: 700,
  lineHeight: 1.4,
  padding: "36px 20px",
  textAlign: "center",
  transition: "background 180ms ease, color 180ms ease",
  width: "100%",
  "@media (hover: hover)": {
    "&:hover": {
      background: "var(--color-white)",
      color: "var(--color-blue-brand)",
    },
  },
  "&:disabled": {
    background: "rgba(255,255,255,.8)",
    color: "var(--color-blue-brand)",
    cursor: "wait",
  },
});

const errorStyle = css({
  background: "var(--color-red-brand)",
  color: "var(--color-black)",
  fontWeight: 700,
  margin: 0,
  padding: "12px 20px",
  textAlign: "center",
});
