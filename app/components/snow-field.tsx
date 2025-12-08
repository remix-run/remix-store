import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { usePrefersReducedMotion } from "~/lib/hooks";

type SnowFieldProps = {
  density?: number;
  sizeRange?: [number, number];
  speedRange?: [number, number];
  opacityRange?: [number, number];
  drift?: number;
  className?: string;
};

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
export function SnowField({
  density = 0.00008,
  sizeRange = [0.8, 2.2],
  speedRange = [0.25, 0.7],
  opacityRange = [0.25, 0.9],
  drift = 0.15,
  className,
}: SnowFieldProps) {
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
    let dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    let rand = (min: number, max: number) => Math.random() * (max - min) + min;

    let createParticle = (): Particle => ({
      x: rand(0, width),
      y: rand(0, height),
      radius: rand(sizeRange[0], sizeRange[1]),
      vy: rand(speedRange[0], speedRange[1]),
      vx: rand(-drift, drift),
      alpha: rand(opacityRange[0], opacityRange[1]),
    });

    let resetParticle = (p: Particle, fromTop = false) => {
      p.x = rand(0, width);
      p.y = fromTop ? -p.radius : rand(0, height);
      p.vy = rand(speedRange[0], speedRange[1]);
      p.vx = rand(-drift, drift);
      p.alpha = rand(opacityRange[0], opacityRange[1]);
    };

    let resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let targetCount = Math.max(
        12,
        Math.floor(width * height * density),
      );

      if (particles.length > targetCount) {
        particles.length = targetCount;
      } else {
        while (particles.length < targetCount) {
          particles.push(createParticle());
        }
      }
    };

    let render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let p of particles) {
        p.y += p.vy;
        p.x += p.vx;

        if (p.y - p.radius > height) {
          resetParticle(p, true);
        }

        if (p.x < -p.radius) p.x = width + p.radius;
        else if (p.x > width + p.radius) p.x = -p.radius;

        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
      }

      frameId = window.requestAnimationFrame(render);
    };

    resize();

    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    let resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    frameId = window.requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [density, sizeRange, speedRange, opacityRange, drift, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx("absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
    />
  );
}

