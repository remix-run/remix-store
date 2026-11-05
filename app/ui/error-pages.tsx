import type { Handle } from "remix/component";

import { marketPath } from "../lib/public/market.ts";
import { routes } from "../routes.ts";
import { Document } from "./document.tsx";
import { BrandedState } from "../assets/public/branded-state.tsx";
import { shellMarket } from "./shell-data.tsx";

export function NotFoundPage(handle: Handle) {
  return () => {
    let market = shellMarket(handle);
    return (
      <Document title="Not Found" appendSiteName={false} noIndex>
        <main>
          <BrandedState
            kind="404"
            heading="Page not found"
            copy="Please check the URL and try again"
            href={marketPath(routes.home.href(), market.pathPrefix)}
            icon="fast-forward"
            linkLabel="Back Home"
            reverseIcon
          />
        </main>
      </Document>
    );
  };
}

export function ErrorPage(handle: Handle) {
  return () => {
    let market = shellMarket(handle);
    return (
      <Document title="Something went wrong" appendSiteName={false} noIndex>
        <main>
          <BrandedState
            kind="500"
            heading="Storefront unavailable"
            copy="The storefront could not load. Please try again."
            href={marketPath(routes.home.href(), market.pathPrefix)}
            icon="fast-forward"
            linkLabel="Back Home"
            reverseIcon
          />
        </main>
      </Document>
    );
  };
}
