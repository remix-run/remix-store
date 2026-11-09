import { css, Frame, type Handle } from "remix/component";

import { frames } from "../../routes.ts";
import { PageTitle } from "../../assets/public/page-title.tsx";
import { Document } from "../../ui/document.tsx";

export function SubscribePage(
  handle: Handle<{ canonicalUrl: string; src: string }>,
) {
  return () => (
    <Document
      canonicalUrl={handle.props.canonicalUrl}
      title="Subscribe"
      description="Subscribe for new products, special offers, and store news."
    >
      <main>
        <PageTitle title="Subscribe" />
        <div mix={contentStyle}>
          <p>
            Stay up to date with our latest products, special offers, and news.
            Enter your email below to subscribe.
          </p>
          <Frame name={frames.subscribe} src={handle.props.src} />
        </div>
      </main>
    </Document>
  );
}

const contentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  margin: "0 auto",
  maxWidth: "700px",
  padding: "0 16px 144px",
  "& > p": {
    color: "rgba(255,255,255,.9)",
    fontSize: "1rem",
    lineHeight: 1.4,
    margin: 0,
  },
  "@media (min-width: 1400px)": {
    "& > p": { fontSize: "1.125rem", lineHeight: "1.75rem" },
  },
});
