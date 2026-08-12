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
  margin: "-48px auto 0",
  maxWidth: "700px",
  overflowWrap: "anywhere",
  padding: "0 36px 144px",
  "& h2, & h3, & h4, & h5, & h6": {
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    lineHeight: 1.25,
    margin: "48px 0 0",
  },
  "& h2": { fontSize: "1.5rem" },
  "& h3": { fontSize: "1.25rem" },
  "& h4, & h5, & h6": { fontSize: "1rem" },
  "& p": {
    fontSize: "0.875rem",
    lineHeight: 1.5,
    margin: "24px 0 0",
  },
  "& a": {
    color: "var(--color-blue-brand)",
    textDecoration: "none",
    transition: "none",
  },
  "& a:hover": { textDecoration: "underline" },
  "& blockquote": {
    background: "var(--color-gray-800)",
    margin: "24px 0 0",
    padding: "24px",
  },
  "& blockquote p:first-child": { marginTop: 0 },
  "& ol, & ul": { margin: "24px 0 0", paddingLeft: "24px" },
  "& ol": { listStyle: "decimal" },
  "& ul": { listStyle: "disc" },
  "& li": { lineHeight: 1.5, marginTop: "16px" },
  "& pre, & table": { margin: "24px 0 0" },
  "& table": { borderCollapse: "collapse", width: "100%" },
  "& th, & td": {
    border: "1px solid var(--color-gray-600)",
    padding: "0.625rem",
    textAlign: "left",
    verticalAlign: "top",
  },
  "& pre": { overflowX: "auto", whiteSpace: "pre-wrap" },
  "@media (min-width: 810px)": {
    "& h2": { fontSize: "2.25rem" },
    "& h3": { fontSize: "1.75rem" },
  },
  "@media (min-width: 1400px)": {
    "& h2": { fontSize: "2.5rem" },
    "& h3": { fontSize: "2rem" },
    "& p": { fontSize: "1rem" },
  },
});
