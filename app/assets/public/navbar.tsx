import {
  clientEntry,
  css,
  on,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/component";

import type { NavigationMenuData } from "../../data/storefront.ts";

export const RemixLogo = clientEntry(
  import.meta.url,
  function RemixLogo(handle: Handle) {
    let expanded = false;

    return () => (
      <svg
        aria-hidden="true"
        viewBox="0 0 1280 126"
        fill="none"
        data-expanded={expanded || undefined}
        mix={[
          logoStyle,
          ref((_element, signal) => {
            let animationFrame = 0;

            function update() {
              animationFrame = 0;
              let nextExpanded = window.scrollY > 20;
              if (nextExpanded === expanded) return;
              expanded = nextExpanded;
              handle.update();
            }

            function requestUpdate() {
              if (!animationFrame)
                animationFrame = requestAnimationFrame(update);
            }

            update();
            window.addEventListener("scroll", requestUpdate, { passive: true });
            signal.addEventListener("abort", () => {
              window.removeEventListener("scroll", requestUpdate);
              if (animationFrame) cancelAnimationFrame(animationFrame);
            });
          }),
        ]}
      >
        <path
          data-logo-mark="true"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M237.117 0.142578L237.114 0.145508V0.148438C270.246 0.148438 293.134 15.0176 288.241 33.3604L284.926 45.7803C280.032 64.123 249.21 78.9922 216.078 78.9922H212.688L282.282 124.627H170.547L114.289 81.2012C112.037 79.7571 109.423 78.9902 106.751 78.9902H12.7041L21.5664 45.7764H186.293C192.486 45.7764 198.251 42.9954 199.167 39.5654H199.17C200.085 36.1354 195.804 33.3545 189.608 33.3545H24.8799L33.7402 0.142578H237.117ZM90.877 90.4551C93.9979 90.4551 96.2711 93.4278 95.4629 96.4561L87.9492 124.623H0.53125L9.64648 90.4551H90.877Z"
        />
        <path
          data-logo-letter="true"
          fill="var(--color-pink-brand)"
          d="M895.661 125.247L928.962 0.976562H1016.89L983.381 125.247H895.661Z"
        />
        <path
          data-logo-letter="true"
          fill="var(--color-yellow-brand)"
          d="M564.053 0.976807H848.738C886.912 0.976807 913.31 18.0335 907.624 39.1513L884.476 125.247H796.755L808.736 80.7778L815.64 55.3958L818.279 45.6491C819.904 39.3544 811.985 34.0749 800.41 34.0749H775.435C775.232 35.6994 775.232 37.3238 774.622 39.1513L751.677 125.247H663.754L675.734 80.7778L682.638 55.3958L685.278 45.6491C686.902 39.3544 678.983 34.0749 667.409 34.0749H643.042L618.472 125.247H530.752L564.053 0.976807Z"
        />
        <path
          data-logo-letter="true"
          fill="var(--color-red-brand)"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1147.53 21.5391L1177.72 1.72852H1279.7L1187.2 62.4297L1247.28 124.354H1145.3L1124.89 103.32L1092.84 124.354H990.856L1085.22 62.4297L1026.33 1.72852H1128.31L1147.53 21.5391Z"
        />
        <path
          data-logo-letter="true"
          fill="var(--color-green-brand)"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M545.101 34.0745H403.164C403.031 34.0745 402.898 34.0759 402.765 34.0774H382.405L379.167 46.4348H379.211L379.205 46.4612H541.649L532.917 79.762H370.27L370.067 80.7776C368.24 87.0722 376.159 92.1487 387.733 92.1487H529.465L520.532 125.246H339.406C301.231 125.246 274.833 108.189 280.519 87.2747L293.312 39.1506C293.598 38.0866 293.961 37.0332 294.396 35.9915L303.571 0.976807H372.569C372.615 0.976757 372.661 0.97583 372.706 0.97583H553.832L545.101 34.0745Z"
        />
      </svg>
    );
  },
);

interface MobileMenuProps extends SerializableObject {
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
              if (event.newState !== "closed") return;
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
              document.addEventListener(
                "pointerdown",
                () => armed.abort(),
                options,
              );
              setTimeout(() => armed.abort());
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
                <a href={item.url}>{item.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  },
);

function hide(popover: HTMLElement) {
  if (popover.matches(":popover-open")) popover.hidePopover();
}

const logoStyle = css({
  display: "block",
  height: "15px",
  overflow: "visible",
  width: "153px",
  "& [data-logo-mark]": {
    fill: "var(--color-white)",
    transition: "fill 300ms ease-in-out",
  },
  "& [data-logo-letter]": {
    opacity: 0,
    transform: "translateY(-140px)",
    transition: "opacity 300ms ease-in-out, transform 300ms ease-in-out",
  },
  "&[data-expanded] [data-logo-mark]": { fill: "var(--color-blue-brand)" },
  "&[data-expanded] [data-logo-letter]": {
    opacity: 1,
    transform: "translateY(0)",
  },
  "@media (min-width: 430px)": { height: "20px", width: "203px" },
});

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
  "&:hover": { background: "var(--color-gray-100)" },
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
  "& li a:hover": {
    background: "rgba(255,255,255,.06)",
    color: "var(--color-blue-brand)",
  },
});
