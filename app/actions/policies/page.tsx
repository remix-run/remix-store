import { css, type Handle } from "remix/ui";

import { PageTitle } from "../../assets/public/page-title.tsx";
import type { PolicyData } from "../../data/policies.ts";
import { sanitizePolicyHtml } from "../../lib/policy-html.ts";
import { Document } from "../../ui/document.tsx";

export function PolicyPage(
  handle: Handle<{ canonicalUrl: string; policy: PolicyData }>,
) {
  return () => (
    <Document
      canonicalUrl={handle.props.canonicalUrl}
      title={handle.props.policy.title}
    >
      <main>
        <PageTitle title={handle.props.policy.title} />
        <article
          mix={policyContentStyle}
          innerHTML={sanitizePolicyHtml(handle.props.policy.body)}
        />
      </main>
    </Document>
  );
}

const policyContentStyle = css({
  margin: "0 auto",
  maxWidth: "700px",
  padding: "40px 20px 144px",
  overflowWrap: "anywhere",
  "& h2, & h3, & h4, & h5, & h6": {
    fontFamily: "var(--font-sans)",
    lineHeight: 1.2,
    margin: "2em 0 0.75em",
  },
  "& h2": { fontSize: "1.75rem" },
  "& h3": { fontSize: "1.375rem" },
  "& p, & li, & blockquote": { lineHeight: 1.65 },
  "& p, & blockquote, & ol, & ul, & pre, & table": {
    margin: "0 0 1.25em",
  },
  "& ol, & ul": { paddingLeft: "1.5em" },
  "& a": {
    color: "var(--color-blue-brand)",
    textDecoration: "underline",
    textUnderlineOffset: "0.2em",
  },
  "& blockquote": {
    borderLeft: "3px solid var(--color-gray-600)",
    marginLeft: 0,
    paddingLeft: "1.25em",
  },
  "& table": { borderCollapse: "collapse", width: "100%" },
  "& th, & td": {
    border: "1px solid var(--color-gray-600)",
    padding: "0.625rem",
    textAlign: "left",
    verticalAlign: "top",
  },
  "& pre": { overflowX: "auto", whiteSpace: "pre-wrap" },
  "@media (min-width: 810px)": { paddingTop: "64px" },
});
