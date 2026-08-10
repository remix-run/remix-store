import { clientEntry, css, ref, type Handle } from "remix/ui";

export const PageTitle = clientEntry(
  import.meta.url,
  function PageTitle(handle: Handle<{ title: string }>) {
    return () => (
      <div
        mix={[
          titleStageStyle,
          ref((element, signal) => {
            let animationFrame = 0;
            let motionPreference = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            );

            function updateSpread() {
              animationFrame = 0;
              if (motionPreference.matches) {
                element.style.setProperty("--title-spread", "0%");
                return;
              }

              let progress = Math.min(
                Math.max(
                  -element.getBoundingClientRect().top / element.offsetHeight,
                  0,
                ),
                1,
              );
              element.style.setProperty(
                "--title-spread",
                `${Math.round(progress * 80)}%`,
              );
            }

            function requestUpdate() {
              if (!animationFrame) {
                animationFrame = requestAnimationFrame(updateSpread);
              }
            }

            updateSpread();
            window.addEventListener("scroll", requestUpdate, { passive: true });
            window.addEventListener("resize", requestUpdate, { passive: true });
            motionPreference.addEventListener("change", requestUpdate);
            signal.addEventListener("abort", () => {
              window.removeEventListener("scroll", requestUpdate);
              window.removeEventListener("resize", requestUpdate);
              motionPreference.removeEventListener("change", requestUpdate);
              if (animationFrame) cancelAnimationFrame(animationFrame);
            });
          }),
        ]}
      >
        <div mix={titleStackStyle}>
          <h1>{handle.props.title}</h1>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-pink-brand)",
              transform: "translateY(var(--title-spread))",
              zIndex: 40,
            }}
          >
            {handle.props.title}
          </span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-red-brand)",
              transform: "translateY(calc(var(--title-spread) * 2))",
            }}
          >
            {handle.props.title}
          </span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-yellow-brand)",
              transform: "translateY(calc(var(--title-spread) * -1))",
              zIndex: 30,
            }}
          >
            {handle.props.title}
          </span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-green-brand)",
              transform: "translateY(calc(var(--title-spread) * -2))",
              zIndex: 20,
            }}
          >
            {handle.props.title}
          </span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--color-blue-brand)",
              transform: "translateY(calc(var(--title-spread) * -3))",
              zIndex: 10,
            }}
          >
            {handle.props.title}
          </span>
        </div>
      </div>
    );
  },
);

const titleStageStyle = css({
  "--title-spread": "0%",
  alignItems: "center",
  background: "var(--color-black)",
  display: "grid",
  height: "200px",
  overflow: "hidden",
  placeItems: "center",
  position: "relative",
  "@media (min-width: 810px)": { height: "360px" },
  "@media (min-width: 1400px)": { height: "400px" },
  "@media (min-width: 1640px)": { height: "480px" },
  "@media (min-width: 2000px)": { height: "540px" },
});

const titleStackStyle = css({
  fontFamily: "var(--font-title)",
  fontSize: "1.5rem",
  fontWeight: 900,
  isolation: "isolate",
  letterSpacing: "-0.23em",
  lineHeight: 0.8,
  position: "relative",
  textAlign: "center",
  textTransform: "uppercase",
  userSelect: "none",
  whiteSpace: "nowrap",
  width: "100%",
  "& h1, & span": {
    background: "var(--color-black)",
    inset: 0,
    margin: 0,
    position: "absolute",
  },
  "& h1": {
    color: "var(--color-white)",
    fontSize: "inherit",
    fontWeight: "inherit",
    position: "relative",
    userSelect: "text",
    zIndex: 50,
  },
  "@media (min-width: 810px)": { fontSize: "3rem" },
  "@media (min-width: 1400px)": { fontSize: "4.5rem" },
  "@media (prefers-reduced-motion: reduce)": {
    "& span": { transform: "none !important" },
  },
});
