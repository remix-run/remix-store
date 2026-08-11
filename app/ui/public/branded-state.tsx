import { css, type Handle } from "remix/ui";

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
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            style={{
              transform: handle.props.reverseIcon
                ? "rotate(180deg)"
                : undefined,
            }}
          >
            <use href={`/sprites.svg#${handle.props.icon}`} />
          </svg>
          <span>{handle.props.linkLabel}</span>
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
  padding: "0 20px",
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
    lineHeight: 1.05,
    margin: 0,
    textTransform: "uppercase",
  },
  "& p": { fontSize: ".875rem", letterSpacing: "-.025em", margin: 0 },
  "@media (min-width: 810px)": {
    gap: "24px",
    "& h1": { fontSize: "3rem" },
    "& p": { fontSize: "1rem" },
  },
});

const spreadLinkStyle = css({
  alignItems: "center",
  background: "var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-black)",
  display: "flex",
  fontSize: "1rem",
  fontWeight: 600,
  gap: "10px",
  height: "64px",
  justifyContent: "center",
  overflow: "hidden",
  padding: "16px 24px",
  position: "relative",
  textDecoration: "none",
  transition: "gap 300ms ease",
  width: "240px",
  "&:hover, &:focus-visible": { color: "var(--color-black)" },
  "& svg": {
    fill: "currentColor",
    height: "32px",
    transition: "transform 300ms ease",
    width: "32px",
  },
  "&:hover svg, &:focus-visible svg": { transform: "translateX(-4px)" },
});
