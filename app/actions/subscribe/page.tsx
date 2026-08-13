import { css, type Handle } from "remix/ui";

import { PageTitle } from "../../assets/public/page-title.tsx";
import {
  SubscribeForm,
  type SubscribeResponse,
} from "../../assets/public/subscribe-form.tsx";
import { Document } from "../../ui/document.tsx";

export function SubscribePage(
  handle: Handle<{
    action: string;
    canonicalUrl: string;
    result?: SubscribeResponse;
  }>,
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
          <SubscribeForm
            action={handle.props.action}
            initialResult={handle.props.result}
            mode="newsletter"
          />
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
