import { css, type Handle, type RemixNode } from "remix/ui";

type PillLinkIcon = "cart" | "fast-forward" | "mail";

export interface PillLinkProps {
  children?: RemixNode;
  expandedText?: string;
  href: string;
  icon?: PillLinkIcon;
  iconPosition?: "left" | "right";
}

export function PillLink(handle: Handle<PillLinkProps>) {
  return () => {
    let {
      children,
      expandedText,
      href,
      icon,
      iconPosition = "left",
    } = handle.props;
    let iconNode = icon ? <PillIcon name={icon} /> : null;

    return (
      <a href={href} mix={pillLinkStyle}>
        {iconPosition === "left" ? iconNode : null}
        <span mix={labelStyle}>
          <span>{children}</span>
          {expandedText ? <span data-expanded>{expandedText}</span> : null}
        </span>
        {iconPosition === "right" ? iconNode : null}
      </a>
    );
  };
}

export function PillIcon(handle: Handle<{ name: PillLinkIcon }>) {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <use href={`/sprites.svg#${handle.props.name}`} />
    </svg>
  );
}

export const pillLinkStyle = css({
  alignItems: "center",
  background: "var(--color-white)",
  borderRadius: "54px",
  color: "var(--color-black)",
  display: "flex",
  fontSize: "1rem",
  fontWeight: 600,
  gap: "8px",
  height: "48px",
  justifyContent: "center",
  lineHeight: 1,
  padding: "8px 20px",
  position: "relative",
  textAlign: "center",
  textDecoration: "none",
  width: "max-content",
  "&:hover, &:focus-visible": { color: "var(--color-black)" },
  "& > svg": {
    flex: "0 0 auto",
    height: "24px",
    marginLeft: "-8px",
    maxWidth: 0,
    opacity: 0,
    transform: "scale(.75)",
    transition:
      "margin 300ms var(--ease-snap), max-width 300ms var(--ease-snap), opacity 300ms ease, transform 300ms var(--ease-snap)",
    width: "24px",
  },
  "&:hover > svg, &:focus-visible > svg": {
    marginLeft: 0,
    maxWidth: "24px",
    opacity: 1,
    transform: "scale(1)",
  },
  "@media (min-width: 810px)": {
    fontSize: "1.25rem",
    gap: "10px",
    height: "64px",
    padding: "16px 24px",
    "& > svg": { height: "32px", marginLeft: "-10px", width: "32px" },
    "&:hover > svg, &:focus-visible > svg": { maxWidth: "32px" },
  },
  "@media (prefers-reduced-motion: reduce)": {
    "& > svg": { transition: "none" },
  },
});

const labelStyle = css({
  display: "flex",
  gap: "0.25em",
  "& [data-expanded]": {
    maxWidth: 0,
    overflow: "hidden",
    transition: "max-width 300ms var(--ease-snap)",
    whiteSpace: "nowrap",
  },
  "a:hover & [data-expanded], a:focus-visible & [data-expanded]": {
    maxWidth: "12ch",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "& [data-expanded]": { transition: "none" },
  },
});
