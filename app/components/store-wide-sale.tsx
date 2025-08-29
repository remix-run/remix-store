import { Fragment } from "react";
import { useRouteLoaderData } from "react-router";
import { clsx } from "clsx";
import type { RootLoader } from "~/root";

export function useStoreWideSale() {
  const data = useRouteLoaderData<RootLoader>("root");

  return data?.header.storeWideSale;
}

function formatEndDate(dateString: string) {
  const date = new Date(dateString);
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    .replace(" ", ".");
}

export function StoreWideSaleMarquee() {
  const saleData = useStoreWideSale();

  if (!saleData) return null;

  const marqueeText = `${saleData.description}${saleData.endDateTime ? ` now thru ${formatEndDate(saleData.endDateTime)}` : ""}`;

  return (
    <div className="fixed top-0 left-0 z-20 overflow-hidden bg-black">
      <div
        className="bg-red-brand/25 flex h-12 w-full items-center whitespace-nowrap"
        role="marquee"
        aria-label={marqueeText}
      >
        <div
          className={clsx(
            "animate-marquee text-red-brand relative left-2 flex items-center gap-8 font-mono text-sm tracking-wide uppercase md:text-base lg:-left-4 lg:gap-12",
            "animation-duration-[60s] md:animation-duration-[45s] lg:animation-duration-[30s]",
          )}
          aria-hidden="true"
        >
          {/* Repeat the text multiple times to ensure seamless scrolling */}
          {Array.from({ length: 10 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key -- chill React
            <Fragment key={i}>
              <span>{saleData.description}</span>
              {saleData.endDateTime ? (
                <span>{`now thru ${formatEndDate(saleData.endDateTime)}`}</span>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
