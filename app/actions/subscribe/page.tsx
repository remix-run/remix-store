import { css, type Handle, type RemixNode } from "remix/component";

import { PageTitle } from "../../assets/public/page-title.tsx";
import { Document } from "../../ui/document.tsx";

/**
 * The signup page. `children` is the form: usually its frame, or the form
 * itself when a signup without JavaScript renders its outcome.
 */
export function SubscribePage(
  handle: Handle<{
    backInStock?: boolean;
    canonicalUrl: string;
    children: RemixNode;
    productHref?: string;
  }>,
) {
  return () => {
    let { backInStock, canonicalUrl, children, productHref } = handle.props;
    return (
      <Document
        canonicalUrl={canonicalUrl}
        title="Subscribe"
        description="Subscribe for new products, special offers, and store news."
      >
        <main>
          <PageTitle title="Subscribe" />
          <div mix={contentStyle}>
            {backInStock ? (
              <p>
                Get an email when this product is back in stock.
                {productHref ? (
                  <>
                    {" "}
                    <a href={productHref}>Back to the product</a>
                  </>
                ) : null}
              </p>
            ) : (
              <p>
                Stay up to date with our latest products, special offers, and
                news. Enter your email below to subscribe.
              </p>
            )}
            {children}
          </div>
        </main>
      </Document>
    );
  };
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
  "& > p a": { color: "inherit", textDecoration: "underline" },
  "@media (min-width: 1400px)": {
    "& > p": { fontSize: "1.125rem", lineHeight: "1.75rem" },
  },
});
