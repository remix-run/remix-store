import {
  clientEntry,
  css,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/component";

const MATRIX_SOURCES = {
  "404": "/brand/matrix/error-404.png",
  "500": "/brand/matrix/error-500.png",
  empty: "/brand/matrix/empty.png",
} as const;

export type MatrixTextKind = keyof typeof MATRIX_SOURCES;

interface MatrixTextProps extends SerializableObject {
  kind: MatrixTextKind;
}

const CHARACTER_WIDTH = 6;
const GLITCH_INTERVAL = 80;
const GLITCH_PERCENT = 0.08;

export const MatrixText = clientEntry(
  import.meta.url,
  function MatrixText(handle: Handle<MatrixTextProps>) {
    let source = MATRIX_SOURCES[handle.props.kind];
    let imageDataUrl: string = source;
    let originalText = "";
    let displayText = "";
    let activeCharacterIndices: number[] = [];
    let scale = 1;
    let ready = false;

    return () => (
      <div
        aria-hidden="true"
        data-matrix-ready={ready || undefined}
        mix={[
          matrixStyle,
          ref((element, signal) => {
            let image = new Image();
            let interval = 0;
            let motionPreference = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            );

            function updateScale(width: number) {
              let nextScale = element.clientWidth / (width * CHARACTER_WIDTH);
              if (
                !Number.isFinite(nextScale) ||
                nextScale <= 0 ||
                nextScale === scale
              )
                return;
              scale = nextScale;
              handle.update();
            }

            function stopGlitch() {
              if (interval) window.clearInterval(interval);
              interval = 0;
              displayText = originalText;
            }

            function startGlitch() {
              stopGlitch();
              if (
                motionPreference.matches ||
                !originalText ||
                activeCharacterIndices.length === 0
              ) {
                handle.update();
                return;
              }

              interval = window.setInterval(() => {
                displayText = glitchText(originalText, activeCharacterIndices);
                handle.update();
              }, GLITCH_INTERVAL);
            }

            image.onerror = () => {
              // Matrix art is decorative; keep the stable empty stage when its
              // source cannot be loaded.
            };
            image.onload = async () => {
              if (signal.aborted) return;
              let canvas = drawToCanvas(image);
              let pixels = canvas
                ?.getContext("2d", { willReadFrequently: true })
                ?.getImageData(0, 0, canvas.width, canvas.height).data;
              if (!canvas || !pixels) return;

              let matrix = matrixFromPixels(pixels, canvas.width);
              imageDataUrl = canvas.toDataURL();
              originalText = matrix.text;
              displayText = matrix.text;
              activeCharacterIndices = matrix.activeIndices;
              ready = true;
              updateScale(canvas.width);
              await handle.update();
              startGlitch();
            };

            image.src = source;
            let resizeObserver = new ResizeObserver(() => {
              if (image.naturalWidth) updateScale(image.naturalWidth);
            });
            resizeObserver.observe(element);
            motionPreference.addEventListener("change", startGlitch);
            signal.addEventListener("abort", () => {
              image.onerror = null;
              image.onload = null;
              stopGlitch();
              resizeObserver.disconnect();
              motionPreference.removeEventListener("change", startGlitch);
            });
          }),
        ]}
      >
        {ready ? (
          <>
            <MatrixLayer
              imageUrl={imageDataUrl}
              layer="blur"
              scale={scale}
              text={originalText}
            />
            <MatrixLayer
              imageUrl={imageDataUrl}
              layer="text"
              scale={scale}
              text={displayText}
            />
          </>
        ) : null}
      </div>
    );
  },
);

function MatrixLayer(
  handle: Handle<{
    imageUrl: string;
    layer: "blur" | "text";
    scale: number;
    text: string;
  }>,
) {
  return () => {
    let { imageUrl, layer, scale, text } = handle.props;
    return (
      <div
        data-matrix-layer={layer}
        style={{
          backgroundImage: `url(${imageUrl})`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {text}
      </div>
    );
  };
}

function drawToCanvas(image: HTMLImageElement): HTMLCanvasElement | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  let canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  let context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  return canvas;
}

/**
 * One hex character per RGBA pixel, a row per line. `activeIndices` are the
 * text offsets of the visible (non-space) characters, which the glitch cycles.
 */
export function matrixFromPixels(
  pixels: ArrayLike<number>,
  width: number,
): { activeIndices: number[]; text: string } {
  let rows: string[] = [];
  let activeIndices: number[] = [];
  let offset = 0;
  for (let start = 0; start < pixels.length; start += width * 4) {
    let row = "";
    for (
      let pixel = start;
      pixel < Math.min(start + width * 4, pixels.length);
      pixel += 4
    ) {
      let character = brightnessCharacter(
        pixels[pixel] ?? 0,
        pixels[pixel + 1] ?? 0,
        pixels[pixel + 2] ?? 0,
      );
      if (character !== " ") activeIndices.push(offset + row.length);
      row += character;
    }
    rows.push(row);
    offset += row.length + 1;
  }
  return { activeIndices, text: rows.join("\n") };
}

/** Steps a few random active hex characters to their next value. */
export function glitchText(
  text: string,
  activeIndices: number[],
  random: () => number = Math.random,
): string {
  let characters = text.split("");
  let count = Math.max(1, Math.floor(activeIndices.length * GLITCH_PERCENT));
  for (let step = 0; step < count; step++) {
    let index = activeIndices[Math.floor(random() * activeIndices.length)];
    if (index === undefined) continue;
    let value = Number.parseInt(characters[index] ?? "", 16);
    if (Number.isFinite(value)) {
      characters[index] = ((value + 1) % 16).toString(16).toUpperCase();
    }
  }
  return characters.join("");
}

function brightnessCharacter(red: number, green: number, blue: number): string {
  let average = (red + green + blue) / 3;
  let value = Math.floor((255 - average) / (255 / 16));
  if (value >= 12) return " ";
  value = Math.max(0, Math.min(12, value) - 3);
  return value.toString(16);
}

const matrixStyle = css({
  aspectRatio: "3 / 1",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  fontWeight: 500,
  lineHeight: 1,
  overflow: "hidden",
  position: "relative",
  textAlign: "center",
  userSelect: "none",
  width: "100%",
  "& [data-matrix-layer]": {
    backgroundClip: "text",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    color: "transparent",
    imageRendering: "pixelated",
    left: "50%",
    position: "absolute",
    top: "50%",
    whiteSpace: "pre",
  },
  '& [data-matrix-layer="blur"]': { filter: "blur(24px)" },
});
