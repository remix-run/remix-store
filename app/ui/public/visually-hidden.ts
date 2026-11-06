import { css } from "remix/component";

/** Hides content visually while keeping it in the accessibility tree. */
export const visuallyHiddenStyle = css({
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});
