import type { Handle, Props } from "remix/ui";

/** Symbol IDs defined by the sprite sheet inlined in `Document`. */
export type IconName =
  | "bag"
  | "cart"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "circle-check"
  | "circle-minus"
  | "circle-plus"
  | "discord"
  | "fast-forward"
  | "github"
  | "info"
  | "mail"
  | "menu"
  | "remix-glyphs"
  | "remix-logo"
  | "x"
  | "x-logo"
  | "youtube";

interface IconProps extends Omit<Props<"svg">, "children"> {
  name: IconName;
}

/** Renders a decorative icon from the SVG sprite inlined by `Document`. */
export function Icon(handle: Handle<IconProps>) {
  return () => {
    let { name, ...props } = handle.props;

    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
        <use href={`#${name}`} />
      </svg>
    );
  };
}
