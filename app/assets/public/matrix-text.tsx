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

interface LoadedMatrix {
  activeIndices: number[];
  /** The decoded art as a data URL, so the layers never refetch it. */
  imageUrl: string;
  text: string;
  /** Characters per row, which is the image's pixel width. */
  width: number;
}

export const MatrixText = clientEntry(
  import.meta.url,
  function MatrixText(handle: Handle<MatrixTextProps>) {
    let source = MATRIX_SOURCES[handle.props.kind];
    let matrix: LoadedMatrix | null = null;
    let displayText = "";
    let scale = 1;

    function fitToElement(element: HTMLElement) {
      if (!matrix) return;
      let nextScale = element.clientWidth / (matrix.width * CHARACTER_WIDTH);
      if (!Number.isFinite(nextScale) || nextScale <= 0) return;
      if (nextScale === scale) return;
      scale = nextScale;
      handle.update();
    }

    async function mount(element: HTMLElement, signal: AbortSignal) {
      let resizeObserver = new ResizeObserver(() => fitToElement(element));
      resizeObserver.observe(element);
      signal.addEventListener("abort", () => resizeObserver.disconnect());

      let loaded = await loadMatrix(source);
      if (!loaded || signal.aborted) return;
      matrix = loaded;
      displayText = loaded.text;
      fitToElement(element);
      await handle.update();
      if (signal.aborted) return;

      runGlitch(loaded, signal, (text) => {
        displayText = text;
        handle.update();
      });
    }

    return () => (
      <div
        aria-hidden="true"
        data-matrix-ready={matrix ? true : undefined}
        mix={[matrixStyle, ref(mount)]}
      >
        {matrix ? (
          <>
            <MatrixLayer
              imageUrl={matrix.imageUrl}
              layer="blur"
              scale={scale}
              text={matrix.text}
            />
            <MatrixLayer
              imageUrl={matrix.imageUrl}
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

/**
 * Loads and converts the matrix art. Returns null when it cannot load: the
 * art is decorative, so the stage just stays empty.
 */
async function loadMatrix(source: string): Promise<LoadedMatrix | null> {
  let image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    return null;
  }
  let canvas = drawToCanvas(image);
  let pixels = canvas
    ?.getContext("2d", { willReadFrequently: true })
    ?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!canvas || !pixels) return null;
  return {
    ...matrixFromPixels(pixels, canvas.width),
    imageUrl: canvas.toDataURL(),
    width: canvas.width,
  };
}

/**
 * Cycles glitched frames through `render` until `signal` aborts. Reduced
 * motion pauses it on the original text, and it resumes when that changes.
 */
function runGlitch(
  matrix: LoadedMatrix,
  signal: AbortSignal,
  render: (text: string) => void,
) {
  let motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let interval = 0;

  function stop() {
    if (interval) window.clearInterval(interval);
    interval = 0;
  }

  function restart() {
    stop();
    render(matrix.text);
    if (motionPreference.matches || matrix.activeIndices.length === 0) return;
    interval = window.setInterval(() => {
      render(glitchText(matrix.text, matrix.activeIndices));
    }, GLITCH_INTERVAL);
  }

  restart();
  motionPreference.addEventListener("change", restart);
  signal.addEventListener("abort", () => {
    stop();
    motionPreference.removeEventListener("change", restart);
  });
}

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
