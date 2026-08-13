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
  maxWidth: "760px",
  minHeight: "45vh",
  padding: "0 20px 112px",
  "& > p": { margin: 0 },
});
