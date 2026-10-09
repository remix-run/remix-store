import { css, type Handle } from "remix/component";

import {
  MatrixText,
  type MatrixTextKind,
} from "../../assets/public/matrix-text.tsx";

export function BrandedState(
  handle: Handle<{
    copy: string;
    heading: string;
    href: string;
    icon: "cart" | "fast-forward";
    kind: MatrixTextKind;
    linkLabel: string;
    reverseIcon?: boolean;
  }>,
) {
  return () => (
    <section mix={stateStyle}>
      <MatrixText kind={handle.props.kind} />
      <div mix={contentStyle}>
        <div mix={copyStyle}>
          <h1>{handle.props.heading}</h1>
          <p>{handle.props.copy}</p>
        </div>
        <a href={handle.props.href} mix={spreadLinkStyle}>
          <span data-spread="true">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              style={{
                transform: handle.props.reverseIcon
                  ? "rotate(180deg)"
                  : undefined,
              }}
            >
              <use href={`#${handle.props.icon}`} />
            </svg>
            <span>{handle.props.linkLabel}</span>
          </span>
        </a>
      </div>
    </section>
  );
}

const stateStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "140px 0",
  "@media (min-width: 810px)": {
    minHeight: 0,
    padding: "200px 0 240px",
  },
});

const contentStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "36px",
  "@media (min-width: 810px)": { gap: "48px" },
});

const copyStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  textAlign: "center",
  "& h1": {
    fontFamily: "var(--font-title)",
    fontSize: "1.875rem",
    fontWeight: 900,
    letterSpacing: "-.2em",
    lineHeight: "2.25rem",
    margin: 0,
    textTransform: "uppercase",
  },
  "& p": {
    fontSize: ".875rem",
    letterSpacing: "-.025em",
    lineHeight: "1.25rem",
    margin: 0,
  },
  "@media (min-width: 810px)": {
    gap: "24px",
    "& h1": { fontSize: "3rem", lineHeight: 1 },
    "& p": { fontSize: "1rem", lineHeight: "1.4rem" },
  },
});

// On hover or focus the link fills with brand blue and its icon and label
// spread to the edges.
const spreadActiveStyle = {
  background: "var(--color-blue-brand)",
  boxShadow: "inset 0 0 0 1px var(--color-white)",
  color: "var(--color-white)",
  "& [data-spread]": { width: "100%" },
};

const spreadLinkStyle = css({
  alignItems: "center",
  background: "var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-black)",
  display: "flex",
  fontSize: "1.25rem",
  fontWeight: 600,
  height: "64px",
  justifyContent: "center",
  lineHeight: "1.75rem",
  padding: "16px 24px",
  textDecoration: "none",
  transition:
    "background-color 300ms ease, box-shadow 300ms ease, color 300ms ease",
  width: "240px",
  "& [data-spread]": {
    alignItems: "center",
    display: "flex",
    gap: "10px",
    height: "32px",
    justifyContent: "space-between",
    minWidth: "fit-content",
    transition: "width 300ms ease-in-out",
    width: 0,
  },
  "& svg": { fill: "currentColor", height: "32px", width: "32px" },
  "&:focus-visible": spreadActiveStyle,
  "@media (hover: hover)": { "&:hover": spreadActiveStyle },
});
