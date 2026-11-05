import {
  clientEntry,
  css,
  on,
  type Handle,
  type SerializableObject,
} from "remix/component";

import type { NavigationMenuData } from "../../data/public/types.ts";
import { isCurrentPage } from "../../lib/public/navigation.ts";

interface MobileMenuProps extends SerializableObject {
  currentPath?: string;
  menu: NavigationMenuData;
}

const MOBILE_NAV_ID = "mobile-navigation";

/**
 * A native popover: without JavaScript the browser opens it from the button
 * and dismisses it on Escape or an outside click. Enhanced, it also closes
 * when a link is followed or focus leaves, and returns focus to the button.
 */
export const MobileMenu = clientEntry(
  import.meta.url,
  function MobileMenu(handle: Handle<MobileMenuProps>) {
    return () => (
      <div mix={mobileMenuStyle}>
        <button
          type="button"
          popovertarget={MOBILE_NAV_ID}
          aria-label="Navigation menu"
          mix={menuButtonStyle}
        >
          <svg aria-hidden="true" viewBox="0 0 36 36">
            <use href="#menu" />
          </svg>
        </button>
        <nav
          id={MOBILE_NAV_ID}
          popover="auto"
          aria-label="Mobile navigation"
          mix={[
            mobileNavStyle,
            // Light dismiss closes the menu on pointerup but still delivers the
            // click to whatever is underneath. Swallow that click, which
            // follows in the same task; a new press or task disarms.
            on("beforetoggle", (event) => {
              if (event.newState === "closed") swallowNextClick();
            }),
            // Client navigation keeps this element, so close it explicitly.
            on("click", (event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("a[href]")
              )
                hide(event.currentTarget);
            }),
            on("focusout", (event) => {
              let next = event.relatedTarget;
              if (next instanceof Node && !event.currentTarget.contains(next))
                hide(event.currentTarget);
            }),
            // Browsers restore focus to whatever was focused when the popover
            // opened, but Safari does not focus buttons on click. Never leave
            // focus inside the hidden menu.
            on("toggle", (event) => {
              let popover = event.currentTarget;
              if (
                event.newState === "closed" &&
                popover.contains(document.activeElement)
              )
                document
                  .querySelector<HTMLElement>(
                    `[popovertarget="${MOBILE_NAV_ID}"]`,
                  )
                  ?.focus();
            }),
          ]}
        >
          <ul>
            {handle.props.menu.items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  data-rmx-prefetch={item.prefetch ? "intent" : undefined}
                  aria-current={
                    handle.props.currentPath &&
                    isCurrentPage(item.url, handle.props.currentPath)
                      ? "page"
                      : undefined
                  }
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  },
);

/** Cancels a click that follows in the same task, before any new press. */
function swallowNextClick(): void {
  let armed = new AbortController();
  let options = { capture: true, signal: armed.signal };
  document.addEventListener(
    "click",
    (click) => {
      click.preventDefault();
      click.stopPropagation();
      armed.abort();
    },
    options,
  );
  document.addEventListener("pointerdown", () => armed.abort(), options);
  setTimeout(() => armed.abort());
}

function hide(popover: HTMLElement) {
  if (popover.matches(":popover-open")) popover.hidePopover();
}

const mobileMenuStyle = css({
  display: "block",
  "&:has(> :popover-open) > button": { background: "var(--color-gray-100)" },
  "@media (min-width: 810px)": { display: "none" },
});

const menuButtonStyle = css({
  alignItems: "center",
  anchorName: "--mobile-menu-button",
  background: "var(--color-white)",
  border: "2px solid transparent",
  borderRadius: "54px",
  color: "var(--color-black)",
  cursor: "pointer",
  display: "flex",
  height: "40px",
  justifyContent: "center",
  padding: "8px 12px",
  userSelect: "none",
  "@media (hover: hover)": {
    "&:hover": { background: "var(--color-gray-100)" },
  },
  "& svg": { height: "20px", width: "20px" },
});

const mobileNavStyle = css({
  backdropFilter: "blur(16px)",
  background: "rgba(0,0,0,.92)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: "24px",
  boxShadow: "0 24px 64px rgba(0,0,0,.55)",
  color: "inherit",
  margin: 0,
  minWidth: "240px",
  padding: "8px",
  // The popover sits in the top layer. Without anchor positioning, align it
  // with the fixed header's padding just below the menu button.
  inset: "calc(var(--store-wide-sale-height) + 68px) 16px auto auto",
  "@supports (anchor-name: --a)": {
    positionAnchor: "--mobile-menu-button",
    inset: "calc(anchor(bottom) + 12px) anchor(right) auto auto",
  },
  "& ul": {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  "& li a": {
    border: "1px solid transparent",
    borderRadius: "16px",
    display: "block",
    fontSize: "1.125rem",
    fontWeight: 600,
    padding: "12px 16px",
    textDecoration: "none",
  },
  "@media (hover: hover)": {
    "& li a:hover": {
      background: "rgba(255,255,255,.06)",
      color: "var(--color-blue-brand)",
    },
  },
});
