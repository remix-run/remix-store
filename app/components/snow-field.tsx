import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { usePrefersReducedMotion } from "~/lib/hooks";

type Particle = {
  x: number;
  y: number;
  radius: number;
  vy: number;
  vx: number;
  alpha: number;
};

/**
 * Lightweight canvas snow effect tuned for gentle, low-cost particles.
 */
const DENSITY = 0.00008;
const SIZE_RANGE: [number, number] = [0.8, 2.2];
const SPEED_RANGE: [number, number] = [0.18, 0.5];
const OPACITY_RANGE: [number, number] = [0.25, 0.9];
const DRIFT = 0.1;

export function SnowField({ className }: { className?: string }) {
  let canvasRef = useRef<HTMLCanvasElement>(null);
  let prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let canvas = canvasRef.current;
    if (!canvas) return;

    let ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    let resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let targetCount = Math.max(12, Math.floor(width * height * DENSITY));

      if (particles.length > targetCount) {
        particles.length = targetCount;
      } else {
        while (particles.length < targetCount) {
          particles.push(createParticle({ width, height }));
        }
      }
    };

    let drawParticles = (move = false) => {
      ctx.clearRect(0, 0, width, height);

      for (let p of particles) {
        if (move) {
          p.y += p.vy;
          p.x += p.vx;

          if (p.y - p.radius > height) {
            resetParticle(p, { width });
          }

          if (p.x < -p.radius) p.x = width + p.radius;
          else if (p.x > width + p.radius) p.x = -p.radius;
        }

        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
      }
    };

    let render = () => {
      drawParticles(true);
      frameId = window.requestAnimationFrame(render);
    };

    resize();
    let resizeObserver = new ResizeObserver(() => {
      resize();
      if (prefersReducedMotion) {
        drawParticles(false);
      }
    });
    resizeObserver.observe(canvas);

    if (prefersReducedMotion) {
      drawParticles(false);
    } else {
      frameId = window.requestAnimationFrame(render);
    }

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx("absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
    />
  );
}

function createParticle({
  width,
  height,
}: {
  width: number;
  height: number;
}): Particle {
  return {
    x: rand(0, width),
    y: rand(0, height),
    radius: rand(SIZE_RANGE[0], SIZE_RANGE[1]),
    vy: rand(SPEED_RANGE[0], SPEED_RANGE[1]),
    vx: rand(-DRIFT, DRIFT),
    alpha: rand(OPACITY_RANGE[0], OPACITY_RANGE[1]),
  };
}

function resetParticle(p: Particle, { width }: { width: number }) {
  p.x = rand(0, width);
  p.y = -p.radius;
  p.vy = rand(SPEED_RANGE[0], SPEED_RANGE[1]);
  p.vx = rand(-DRIFT, DRIFT);
  p.alpha = rand(OPACITY_RANGE[0], OPACITY_RANGE[1]);
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
