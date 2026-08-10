import {
  clientEntry,
  css,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/ui";

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
                let characters = originalText.split("");
                let count = Math.max(
                  1,
                  Math.floor(activeCharacterIndices.length * GLITCH_PERCENT),
                );
                for (let index = 0; index < count; index++) {
                  let characterIndex =
                    activeCharacterIndices[
                      Math.floor(Math.random() * activeCharacterIndices.length)
                    ];
                  if (characterIndex === undefined) continue;
                  let value = Number.parseInt(
                    characters[characterIndex] ?? "",
                    16,
                  );
                  if (Number.isFinite(value))
                    characters[characterIndex] = ((value + 1) % 16).toString(
                      16,
                    );
                }
                displayText = characters.join("");
                handle.update();
              }, GLITCH_INTERVAL);
            }

            image.onerror = () => {
              // Matrix art is decorative; keep the stable empty stage when its
              // source cannot be loaded.
            };
            image.onload = async () => {
              if (signal.aborted || !image.naturalWidth || !image.naturalHeight)
                return;
              let canvas = document.createElement("canvas");
              canvas.width = image.naturalWidth;
              canvas.height = image.naturalHeight;
              let context = canvas.getContext("2d", {
                willReadFrequently: true,
              });
              if (!context) return;

              context.drawImage(image, 0, 0);
              let pixels = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              ).data;
              let text = "";
              let active: number[] = [];

              for (let offset = 0; offset < pixels.length; offset += 4) {
                let character = brightnessCharacter(
                  pixels[offset] ?? 0,
                  pixels[offset + 1] ?? 0,
                  pixels[offset + 2] ?? 0,
                );
                if (character !== " ") active.push(text.length);
                text += character;
                let pixelIndex = offset / 4;
                if (
                  (pixelIndex + 1) % canvas.width === 0 &&
                  pixelIndex < canvas.width * canvas.height - 1
                ) {
                  text += "\n";
                }
              }

              imageDataUrl = canvas.toDataURL();
              originalText = text;
              displayText = text;
              activeCharacterIndices = active;
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
            <div
              data-matrix-layer="blur"
              style={{
                backgroundImage: `url(${imageDataUrl})`,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              {displayText}
            </div>
            <div
              data-matrix-layer="text"
              style={{
                backgroundImage: `url(${imageDataUrl})`,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              {displayText}
            </div>
          </>
        ) : null}
      </div>
    );
  },
);

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
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    color: "transparent",
    imageRendering: "pixelated",
    left: "50%",
    position: "absolute",
    top: "50%",
    whiteSpace: "pre",
  },
  '& [data-matrix-layer="blur"]': { filter: "blur(20px)" },
});
