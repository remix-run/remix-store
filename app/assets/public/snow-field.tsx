import { clientEntry, css, ref } from "remix/ui";

type Particle = {
  alpha: number;
  radius: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

const DENSITY = 0.00008;
const SIZE_RANGE = [0.8, 2.2] as const;
const SPEED_RANGE = [0.18, 0.5] as const;
const OPACITY_RANGE = [0.25, 0.9] as const;
const DRIFT = 0.1;

/** A progressively enhanced, decorative snow overlay. */
export const SnowField = clientEntry(import.meta.url, function SnowField() {
  return () => (
    <div
      aria-hidden="true"
      data-seasonal-snow="true"
      mix={[
        snowFieldStyle,
        ref((element, signal) => {
          let canvasElement = element.querySelector("canvas");
          if (!(canvasElement instanceof HTMLCanvasElement)) return;
          let canvas: HTMLCanvasElement = canvasElement;

          let motionPreference = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          );
          let context: CanvasRenderingContext2D | null = null;
          let particles: Particle[] = [];
          let resizeObserver: ResizeObserver | null = null;
          let frameId: number | null = null;
          let active = false;
          let width = 0;
          let height = 0;

          function syncMotionPreference() {
            element.toggleAttribute(
              "data-snow-reduced-motion",
              motionPreference.matches,
            );
          }

          function stopCanvas() {
            active = false;
            element.removeAttribute("data-snow-canvas-ready");
            if (frameId !== null) {
              window.cancelAnimationFrame(frameId);
              frameId = null;
            }
            resizeObserver?.disconnect();
            resizeObserver = null;
            window.removeEventListener("resize", resize);
            context = null;
            particles = [];
          }

          function resize() {
            if (!active || !context) return;
            try {
              // The canvas stays `display: none` until it is ready, so it has
              // no box. Size from the visible overlay instead.
              width = element.clientWidth;
              height = element.clientHeight;
              if (!width || !height) return;

              let dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
              canvas.width = Math.round(width * dpr);
              canvas.height = Math.round(height * dpr);
              context.setTransform(dpr, 0, 0, dpr, 0, 0);

              let targetCount = Math.max(
                12,
                Math.floor(width * height * DENSITY),
              );
              particles.length = Math.min(particles.length, targetCount);
              while (particles.length < targetCount) {
                particles.push(createParticle(width, height));
              }
              drawParticles(false);
              element.setAttribute("data-snow-canvas-ready", "true");
            } catch {
              stopCanvas();
            }
          }

          function drawParticles(move: boolean) {
            if (!context) return;
            context.clearRect(0, 0, width, height);
            for (let particle of particles) {
              if (move) {
                particle.y += particle.vy;
                particle.x += particle.vx;
                if (particle.y - particle.radius > height) {
                  resetParticle(particle, width);
                }
                if (particle.x < -particle.radius) {
                  particle.x = width + particle.radius;
                } else if (particle.x > width + particle.radius) {
                  particle.x = -particle.radius;
                }
              }

              context.globalAlpha = particle.alpha;
              context.beginPath();
              context.arc(
                particle.x,
                particle.y,
                particle.radius,
                0,
                Math.PI * 2,
              );
              context.fillStyle = "white";
              context.fill();
            }
            context.globalAlpha = 1;
          }

          function animate() {
            frameId = null;
            if (!active || signal.aborted || motionPreference.matches) return;
            try {
              drawParticles(true);
              frameId = window.requestAnimationFrame(animate);
            } catch {
              stopCanvas();
            }
          }

          function startCanvas() {
            if (active || signal.aborted || motionPreference.matches) return;
            try {
              context = canvas.getContext("2d");
              if (!context) return;
              active = true;
              window.addEventListener("resize", resize, { passive: true });
              if (globalThis.ResizeObserver) {
                resizeObserver = new globalThis.ResizeObserver(resize);
                resizeObserver.observe(element);
              }
              resize();
              if (!active) return;
              frameId = window.requestAnimationFrame(animate);
            } catch {
              stopCanvas();
            }
          }

          function onMotionChange() {
            syncMotionPreference();
            if (motionPreference.matches) stopCanvas();
            else startCanvas();
          }

          motionPreference.addEventListener("change", onMotionChange);
          signal.addEventListener("abort", () => {
            stopCanvas();
            motionPreference.removeEventListener("change", onMotionChange);
          });
          syncMotionPreference();
          startCanvas();
        }),
      ]}
    >
      <div data-snow-static="true" />
      <canvas aria-hidden="true" />
    </div>
  );
});

function createParticle(width: number, height: number): Particle {
  return {
    alpha: random(OPACITY_RANGE[0], OPACITY_RANGE[1]),
    radius: random(SIZE_RANGE[0], SIZE_RANGE[1]),
    vx: random(-DRIFT, DRIFT),
    vy: random(SPEED_RANGE[0], SPEED_RANGE[1]),
    x: random(0, width),
    y: random(0, height),
  };
}

function resetParticle(particle: Particle, width: number) {
  particle.alpha = random(OPACITY_RANGE[0], OPACITY_RANGE[1]);
  particle.vx = random(-DRIFT, DRIFT);
  particle.vy = random(SPEED_RANGE[0], SPEED_RANGE[1]);
  particle.x = random(0, width);
  particle.y = -particle.radius;
}

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

const snowFieldStyle = css({
  inset: 0,
  pointerEvents: "none",
  position: "fixed",
  zIndex: 20,
  "& canvas, & [data-snow-static]": {
    display: "none",
    height: "100%",
    inset: 0,
    position: "absolute",
    width: "100%",
  },
  "&[data-snow-canvas-ready] canvas": { display: "block" },
  "& [data-snow-static]": {
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,.55) 0 1px, transparent 1.4px), radial-gradient(circle, rgba(255,255,255,.3) 0 1.2px, transparent 1.8px)",
    backgroundPosition: "18px 28px, 96px 84px",
    backgroundSize: "220px 260px, 310px 340px",
  },
  "&[data-snow-reduced-motion] [data-snow-static]": { display: "block" },
  "@media (prefers-reduced-motion: reduce)": {
    "& canvas": { display: "none" },
    "& [data-snow-static]": { display: "block" },
  },
});
