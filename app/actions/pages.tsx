import { css, type Handle } from "remix/ui";

import { Counter } from "../assets/counter.tsx";
import { BrandedState } from "../ui/branded-state.tsx";
import { Document } from "../ui/document.tsx";

export function HomePage(
  handle: Handle<{ description?: string | null; shopName: string }>,
) {
  return () => (
    <Document
      title={handle.props.shopName}
      description={handle.props.description ?? undefined}
    >
      <main mix={mainStyle}>
        <p mix={eyebrowStyle}>Remix 3 + Hydrogen</p>
        <h1 mix={headingStyle}>{handle.props.shopName}</h1>
        <p mix={copyStyle}>
          This minimal storefront proves Oxygen SSR, browser hydration, and a
          live Storefront API query. Shopper-facing features will arrive in
          focused migration PRs.
        </p>
        <Counter initialCount={0} />
      </main>
    </Document>
  );
}

export function NotFoundPage() {
  return () => (
    <Document title="Not found" noIndex>
      <main>
        <BrandedState
          kind="404"
          heading="Page not found"
          copy="The page you requested does not exist."
          href="/"
          icon="fast-forward"
          linkLabel="Return home"
          reverseIcon
        />
      </main>
    </Document>
  );
}

export function ErrorPage() {
  return () => (
    <Document title="Storefront unavailable" noIndex>
      <main>
        <BrandedState
          kind="500"
          heading="Storefront unavailable"
          copy="The storefront could not load. Please try again."
          href="/"
          icon="fast-forward"
          linkLabel="Return home"
          reverseIcon
        />
      </main>
    </Document>
  );
}

const mainStyle = css({
  margin: "0 auto",
  maxWidth: "70rem",
  minHeight: "100vh",
  padding: "clamp(4rem, 12vw, 10rem) 1.5rem",
});

const eyebrowStyle = css({
  color: "#20aaff",
  fontFamily: "ui-monospace, monospace",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const headingStyle = css({
  fontSize: "clamp(3rem, 10vw, 8rem)",
  letterSpacing: "-0.06em",
  lineHeight: 0.9,
  margin: "1rem 0 2rem",
});

const copyStyle = css({
  fontSize: "clamp(1rem, 2vw, 1.35rem)",
  maxWidth: "42rem",
});
