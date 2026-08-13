import { css, type Handle } from "remix/ui";

import type { StoreWideSaleData } from "../data/storefront.ts";
import type { MarketLocale } from "../lib/public/market.ts";

// Two identical groups animate by exactly one group width. Ten compact
// messages per group is enough to cover the storefront's widest viewport.
const MARQUEE_REPETITIONS = 10;

export function StoreWideSaleMarquee(
  handle: Handle<{ locale?: MarketLocale; sale: StoreWideSaleData }>,
) {
  return () => {
    let { sale } = handle.props;
    let endDate = sale.endDateTime
      ? formatSaleEndDate(sale.endDateTime, handle.props.locale)
      : null;
    let accessibleText = `${sale.title}. ${sale.description}.${endDate ? ` Ends ${endDate}.` : ""}`;

    return (
      <aside
        aria-label="Store-wide sale"
        data-store-wide-sale="true"
        mix={marqueeStyle}
      >
        <p mix={screenReaderOnlyStyle}>{accessibleText}</p>
        <div aria-hidden="true" mix={trackStyle}>
          <MarqueeGroup sale={sale} endDate={endDate} />
          <MarqueeGroup sale={sale} endDate={endDate} />
        </div>
      </aside>
    );
  };
}

function MarqueeGroup(
  handle: Handle<{ endDate: string | null; sale: StoreWideSaleData }>,
) {
  return () => (
    <div data-marquee-group="true" mix={groupStyle}>
      {Array.from({ length: MARQUEE_REPETITIONS }, (_, index) => (
        <span key={index} mix={messageStyle}>
          <span>{handle.props.sale.title}</span>
          <span>{handle.props.sale.description}</span>
          {handle.props.endDate ? (
            <span>Now thru {handle.props.endDate}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function formatSaleEndDate(
  value: string,
  locale: MarketLocale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  })
    .format(new Date(value))
    .replace(" ", ".");
}

const marqueeStyle = css({
  background: "rgba(255,81,72,.25)",
  color: "var(--color-red-brand)",
  height: "48px",
  left: 0,
  overflow: "hidden",
  position: "fixed",
  right: 0,
  top: 0,
  width: "100%",
  zIndex: 20,
});

const trackStyle = css({
  alignItems: "center",
  animation: "store-wide-sale-marquee 45s linear infinite",
  display: "flex",
  height: "100%",
  width: "max-content",
  "@media (max-width: 1399px)": {
    animationDuration: "55s",
  },
  "@media (max-width: 809px)": {
    animationDuration: "70s",
  },
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
    transform: "none",
  },
});

const groupStyle = css({
  alignItems: "center",
  display: "flex",
  flex: "none",
  gap: "48px",
  paddingRight: "48px",
  "@media (max-width: 809px)": {
    gap: "32px",
    paddingRight: "32px",
  },
});

const messageStyle = css({
  alignItems: "center",
  display: "flex",
  fontFamily: "var(--font-mono)",
  fontSize: "1rem",
  gap: "48px",
  letterSpacing: ".025em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  "@media (max-width: 809px)": {
    fontSize: ".875rem",
    gap: "32px",
  },
});

const screenReaderOnlyStyle = css({
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});
