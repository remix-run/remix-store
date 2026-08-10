import {
  clientEntry,
  css,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/ui";

import type { NavigationMenuData } from "../data/storefront.ts";

const FOOTER_GRADIENT_STRIP_COUNT = 33;
const FOOTER_GRADIENT_STAGGER_MS = 80;

const SOCIALS = [
  { href: "https://github.com/remix-run", name: "github", label: "GitHub" },
  { href: "https://x.com/remix_run", name: "x-logo", label: "X" },
  {
    href: "https://www.youtube.com/c/Remix-Run",
    name: "youtube",
    label: "YouTube",
  },
  { href: "https://rmx.as/discord", name: "discord", label: "Discord" },
] as const;

interface FooterProps extends SerializableObject {
  menu: NavigationMenuData;
}

export const Footer = clientEntry(
  import.meta.url,
  function Footer(handle: Handle<FooterProps>) {
    return () => (
      <footer
        data-storefront-footer="true"
        data-visible="true"
        mix={[
          footerStyle,
          ref((element, signal) => {
            let observer: IntersectionObserver | undefined;
            let motionPreference = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            );

            function setVisible(visible: boolean) {
              if (visible) element.setAttribute("data-visible", "true");
              else element.removeAttribute("data-visible");
            }

            function observe() {
              observer?.disconnect();
              observer = undefined;

              if (
                motionPreference.matches ||
                !("IntersectionObserver" in window)
              ) {
                setVisible(true);
                return;
              }

              observer = new IntersectionObserver(
                ([entry]) =>
                  setVisible(Boolean(entry && entry.intersectionRatio >= 0.35)),
                { threshold: [0, 0.35, 1] },
              );
              observer.observe(element);
            }

            observe();
            motionPreference.addEventListener("change", observe);
            signal.addEventListener("abort", () => {
              observer?.disconnect();
              motionPreference.removeEventListener("change", observe);
            });
          }),
        ]}
      >
        <FooterGradientStrips />
        <div data-footer-content="true" mix={footerContentStyle}>
          <div mix={footerInnerStyle}>
            <div mix={catalogStyle}>
              <a href="/collections/all">Remix Soft Wear Catalog V.1.4</a>
              <p>Designed in USA</p>
            </div>

            <div mix={brandStyle}>
              <svg
                aria-label="Remix Logo"
                role="img"
                viewBox="0 0 1280 126"
                mix={brandLogoStyle}
              >
                <use href="/sprites.svg#remix-logo" />
              </svg>

              <div mix={brandGlyphGroupStyle}>
                <div mix={runnerCircleStyle}>
                  <div data-runner-border="true" />
                  <img
                    data-runner-static="true"
                    src="/brand/remix-runner.svg"
                    alt=""
                    aria-hidden="true"
                    width="326"
                    height="206"
                    loading="eager"
                  />
                  <img
                    data-runner-animated="true"
                    src="/brand/remix-runner-animated.svg"
                    alt=""
                    aria-hidden="true"
                    width="326"
                    height="206"
                    loading="eager"
                  />
                </div>
                <svg aria-hidden="true" viewBox="0 0 146 70" mix={glyphsStyle}>
                  <use href="/sprites.svg#remix-glyphs" />
                </svg>
              </div>
            </div>

            <div mix={footerLinksStyle}>
              <div mix={statementColumnStyle}>
                <p>Remix is for everyone</p>
                <p>Remix is an engineering team</p>
                <p>Remix builds tools for a better web</p>

                <nav aria-label="Remix community" mix={socialNavStyle}>
                  <a
                    href="https://www.remix.run"
                    target="_blank"
                    rel="noopener noreferrer"
                    mix={remixLinkStyle}
                  >
                    remix.run
                  </a>
                  {SOCIALS.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      aria-label={social.label}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-social-link="true"
                    >
                      <FooterIcon name={social.name} />
                    </a>
                  ))}
                </nav>
              </div>

              <nav aria-label="Store policies" mix={policyNavStyle}>
                {handle.props.menu.items.map((item) => {
                  let external = /^https?:\/\//i.test(item.url);
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                    >
                      {item.title}
                    </a>
                  );
                })}
              </nav>
            </div>

            <div mix={copyrightStyle}>
              <p>Docs and Examples licensed under MIT</p>
              <p mix={copyrightLineStyle}>
                <span aria-hidden="true">©</span>
                <span>{new Date().getFullYear()} Shopify, Inc.</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  },
);

function FooterGradientStrips() {
  let centerIndex = Math.floor(FOOTER_GRADIENT_STRIP_COUNT / 2);

  return () => (
    <div aria-hidden="true" mix={gradientLayerStyle}>
      <div data-gradient-black="true" />
      <div data-gradient-top="true" />
      <div data-gradient-field="true">
        <div data-gradient-strips="true">
          {Array.from({ length: FOOTER_GRADIENT_STRIP_COUNT }).map(
            (_, index) => {
              let distanceFromCenter = Math.abs(index - centerIndex);
              return (
                <span
                  key={index}
                  data-gradient-strip="true"
                  style={{
                    animationDelay: `${distanceFromCenter * FOOTER_GRADIENT_STAGGER_MS - 5000}ms`,
                  }}
                />
              );
            },
          )}
          <div data-gradient-shade="true" />
        </div>
      </div>
      <div data-gradient-bottom="true" />
    </div>
  );
}

function FooterIcon(
  handle: Handle<{ name: (typeof SOCIALS)[number]["name"] }>,
) {
  return () => {
    let viewBox =
      handle.props.name === "discord"
        ? "0 0 126.644 96"
        : handle.props.name === "x-logo"
          ? "0 0 1200 1227"
          : "0 0 24 24";

    return (
      <svg aria-hidden="true" viewBox={viewBox}>
        <use href={`/sprites.svg#${handle.props.name}`} />
      </svg>
    );
  };
}

const footerStyle = css({
  background: "var(--color-black)",
  color: "var(--color-white)",
  isolation: "isolate",
  overflow: "hidden",
  position: "relative",
  "& p": { margin: 0 },
  "& a": { color: "inherit", textDecoration: "none" },
  "& a:hover, & a:focus-visible": { color: "inherit" },
  "&:not([data-visible]) [data-footer-content]": { opacity: 0.3 },
  "&:not([data-visible]) [data-gradient-strip]": {
    animationName: "none",
    transform: "scaleY(1)",
  },
  "&:not([data-visible]) [data-gradient-shade]": {
    animationName: "none",
    opacity: 0.85,
  },
  "&:not([data-visible]) [data-runner-border]": {
    animationName: "none",
    borderWidth: "2px",
  },
  "&:not([data-visible]) [data-runner-static]": { display: "block" },
  "&:not([data-visible]) [data-runner-animated]": { display: "none" },
});

const footerContentStyle = css({
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  lineHeight: 1.25,
  opacity: 1,
  padding: "128px 8px 64px",
  position: "relative",
  textTransform: "uppercase",
  transition: "opacity 300ms ease",
  zIndex: 10,
});

const footerInnerStyle = css({
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  gap: "36px",
  margin: "0 auto",
  maxWidth: "calc(100vw - 16px)",
  width: "max-content",
  "@media (min-width: 1024px)": { gap: "48px" },
});

const catalogStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

const brandStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  "@media (min-width: 810px)": { gap: "24px" },
  "@media (min-width: 1024px)": { flexDirection: "row" },
});

const brandLogoStyle = css({
  color: "var(--color-white)",
  display: "block",
  height: "150px",
  width: "168px",
  "@media (min-width: 810px)": { width: "216px" },
  "@media (min-width: 1024px)": { width: "260px" },
});

const brandGlyphGroupStyle = css({
  alignItems: "center",
  display: "flex",
  gap: "4px",
});

const runnerCircleStyle = css({
  height: "55px",
  position: "relative",
  width: "55px",
  "& [data-runner-border]": {
    animation: "footer-runner-spin 1000ms linear infinite",
    border: "4px dotted var(--color-white)",
    borderRadius: "50%",
    inset: 0,
    position: "absolute",
  },
  "& img": {
    height: "75%",
    left: "50%",
    objectFit: "contain",
    objectPosition: "center",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "75%",
  },
  "& [data-runner-static]": { display: "none" },
  "& [data-runner-animated]": { display: "block" },
  "@media (min-width: 810px)": { height: "70px", width: "70px" },
  "@media (prefers-reduced-motion: reduce)": {
    "& [data-runner-border]": { animation: "none", borderWidth: "2px" },
    "& [data-runner-static]": { display: "block" },
    "& [data-runner-animated]": { display: "none" },
  },
});

const glyphsStyle = css({
  display: "block",
  height: "55px",
  width: "115px",
  "@media (min-width: 810px)": { height: "70px", width: "146px" },
});

const footerLinksStyle = css({
  alignItems: "flex-start",
  display: "flex",
  gap: "36px",
});

const statementColumnStyle = css({
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  textAlign: "right",
});

const socialNavStyle = css({
  alignItems: "center",
  display: "flex",
  gap: "16px",
  padding: "6px 0",
  "& [data-social-link]": {
    display: "block",
    opacity: 0.5,
    transition: "opacity 300ms ease",
  },
  "& [data-social-link]:hover, & [data-social-link]:focus-visible": {
    opacity: 1,
  },
  "& svg": {
    color: "var(--color-white)",
    display: "block",
    fill: "var(--color-white)",
    height: "16px",
    width: "16px",
  },
});

const remixLinkStyle = css({
  border: "1px solid var(--color-white)",
  borderRadius: "24px",
  padding: "4px 8px",
  transition: "background-color 300ms ease, color 300ms ease",
  "&:hover, &:focus-visible": {
    background: "var(--color-white)",
    color: "var(--color-black) !important",
  },
});

const policyNavStyle = css({
  alignItems: "flex-start",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const copyrightStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

const copyrightLineStyle = css({
  alignItems: "flex-start",
  display: "flex",
  gap: "4px",
  "& span:first-child": { fontSize: "16px", lineHeight: 1 },
});

const gradientLayerStyle = css({
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  zIndex: 0,
  "& [data-gradient-black]": {
    background: "var(--color-black)",
    inset: 0,
    position: "absolute",
  },
  "& [data-gradient-top]": {
    background:
      "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / .9) 50%, transparent 100%)",
    height: "192px",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  "& [data-gradient-field]": {
    bottom: "-18%",
    left: "-18%",
    position: "absolute",
    right: "-18%",
    top: "48px",
  },
  "& [data-gradient-strips]": {
    display: "flex",
    height: "100%",
    justifyContent: "center",
    position: "relative",
  },
  "& [data-gradient-strip]": {
    alignSelf: "flex-end",
    animation:
      "footer-gradient-strip 5000ms cubic-bezier(.8, 0, .2, 1) infinite alternate both",
    background:
      "linear-gradient(0deg, hsl(3 100% 61%) 8%, hsl(313 88% 62%) 22%, hsl(48 94% 62%) 38%, hsl(104 68% 60%) 56%, hsl(202 94% 60%) 78%, var(--color-black) 100%)",
    display: "block",
    flexShrink: 0,
    height: "100%",
    minHeight: "260px",
    position: "relative",
    transform: "scaleY(1)",
    transformOrigin: "bottom",
    width: "clamp(18px, 4vw, 72px)",
    zIndex: 0,
  },
  "& [data-gradient-shade]": {
    animation:
      "footer-gradient-strip-shade 5600ms ease-in-out -5600ms infinite alternate both",
    background:
      "linear-gradient(180deg, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / .82) 100%)",
    inset: 0,
    opacity: 0.85,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 1,
  },
  "& [data-gradient-bottom]": {
    background: "linear-gradient(to top, rgb(0 0 0 / .3), transparent)",
    bottom: 0,
    height: "33.333%",
    left: 0,
    position: "absolute",
    right: 0,
  },
  "@media (prefers-reduced-motion: reduce)": {
    "& [data-gradient-strip]": { animation: "none", transform: "scaleY(1)" },
    "& [data-gradient-shade]": { animation: "none", opacity: 0.58 },
  },
});
