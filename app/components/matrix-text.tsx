import { useEffect, useState } from "react";
import { clsx } from "clsx";

import error404Src from "~/assets/images/matrix-text/error-404.png";
import error500Src from "~/assets/images/matrix-text/error-500.png";
import emptySrc from "~/assets/images/matrix-text/empty.png";
import { usePrefersReducedMotion } from "~/lib/hooks";

interface MatrixTextData {
  text: string;
  /** Flat indices relative to originalString (without newlines) */
  activeCharIndices: number[];
}

// TODO:
// - add a generic error one and a cart one
// - figure out pre-loaded state
const textToImageMap = {
  "404": error404Src,
  "500": error500Src,
  empty: emptySrc,
};

type TextId = keyof typeof textToImageMap;

export function MatrixText({ text }: { text: TextId }) {
  const { dataUrl, scale, matrixTextData } = useMatrixValues(text);

  let wrapperCss =
    "absolute top-1/2 left-1/2 bg-size-[100%_100%] bg-clip-text bg-no-repeat whitespace-pre";

  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden text-center font-mono text-[10px] leading-none font-medium tracking-normal text-transparent select-none">
      <div
        className={clsx(wrapperCss, "blur-xl")}
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          imageRendering: "pixelated",
          backgroundImage: `url(${dataUrl})`,
        }}
      >
        {matrixTextData?.text}
      </div>
      <div
        className={wrapperCss}
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          imageRendering: "pixelated",
          backgroundImage: `url(${dataUrl})`,
        }}
      >
        <GlitchyText {...matrixTextData} />
      </div>
    </div>
  );
}

function GlitchyText(props: MatrixTextData) {
  const glitchedText = useGlitchText(props);
  return <>{glitchedText}</>;
}

// just one of those things we know
const CHAR_WIDTH = 6;
const EMPTY_CHAR = " ";

function useMatrixValues(text: TextId) {
  const [dataUrl, setDataUrl] = useState("");
  const [matrixTextData, setMatrixTextData] = useState<MatrixTextData>({
    text: "",
    activeCharIndices: [],
  });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = textToImageMap[text];
    let targetCanvasWidth: number;
    let targetCanvasHeight: number;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      targetCanvasWidth = img.naturalWidth;
      targetCanvasHeight = img.naturalHeight;

      if (targetCanvasWidth === 0 || targetCanvasHeight === 0) {
        console.error("Image loaded with zero dimensions. Cannot process.");
        return;
      }

      canvas.width = targetCanvasWidth;
      canvas.height = targetCanvasHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get 2D context from canvas");
        return;
      }
      ctx.drawImage(img, 0, 0, targetCanvasWidth, targetCanvasHeight);

      const dataUrl = canvas.toDataURL();
      setDataUrl(dataUrl);

      const imageData = ctx.getImageData(
        0,
        0,
        targetCanvasWidth,
        targetCanvasHeight,
      );
      const pixelData = imageData.data;
      let generatedText = "";
      const activeCharIndices: number[] = [];

      for (let i = 0; i < pixelData.length; i += 4) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];

        const char = getHexCharForPixelBrightness(r, g, b);
        generatedText += char;

        const currentPixelIndexInFlatArray = i / 4;
        if (char !== EMPTY_CHAR) {
          activeCharIndices.push(currentPixelIndexInFlatArray);
        }

        // If we're at the end of a row, add a newline
        if ((currentPixelIndexInFlatArray + 1) % targetCanvasWidth === 0) {
          if (
            currentPixelIndexInFlatArray <
            targetCanvasWidth * targetCanvasHeight - 1
          ) {
            generatedText += "\n";
          }
        }
      }

      setMatrixTextData({
        text: generatedText,
        activeCharIndices,
      });
      //   Good time to set the initial scale
      handleResize();
    };

    img.onerror = (err) => {
      console.error("Failed to load image for GlitchyText:", err);
    };

    const handleResize = () => {
      // good ol' closures
      if (!targetCanvasWidth) return;

      setScale(window.innerWidth / (targetCanvasWidth * CHAR_WIDTH));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [text]);

  return { dataUrl, scale, matrixTextData };
}

/**
 * The maximum hex character value.
 * This is used to limit the number of characters that can be displayed.
 */
const maxHex = 12;

/**
 * The offset to apply to the hex character value to get brighter values to be lower numbers.
 */
const hexOffset = 3;

/**
 * Maps pixel brightness to a hexadecimal character or a space.
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns A character ('0'-'F' or ' ')
 */
function getHexCharForPixelBrightness(
  r: number,
  g: number,
  b: number,
  minBrightness = 3,
): string {
  const averageBrightness = (r + g + b) / 3;

  const stepSizeForFullRange = 255 / 16;

  const invertedBrightnessScore = 255 - averageBrightness;

  // Map this inverted score to get a hex character
  let n = Math.floor(invertedBrightnessScore / stepSizeForFullRange);

  // If the brightness is too low, return a space
  if (n >= maxHex) {
    return EMPTY_CHAR;
  }

  // Ensure charIndex is within the valid bounds [0, numSteps - 1]
  n = Math.max(0, Math.min(maxHex, n) - hexOffset);

  return n.toString(16);
}

function useGlitchText(matrixData: MatrixTextData) {
  const [glitchedText, setGlitchedText] = useState(matrixData.text);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { text, activeCharIndices } = matrixData;

  // RAF Glitching Effect with setTimeout throttling
  useEffect(() => {
    if (prefersReducedMotion || !text || activeCharIndices.length === 0) {
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let animationFrameId: number | null = null; // To cancel RAF if timeout gets cleared first

    const glitchAmountPercent = 0.08;
    const minCharsToGlitch = 1;
    const glitchInterval = 80; // ms
    const numActiveChars = activeCharIndices.length;
    const numToGlitch = Math.max(
      minCharsToGlitch,
      Math.floor(numActiveChars * glitchAmountPercent),
    );

    const animate = () => {
      const chars = text.split("");

      for (let k = 0; k < numToGlitch; k++) {
        if (numActiveChars === 0) break;
        const randomActiveIndex = Math.floor(Math.random() * numActiveChars);
        const flatIndexToGlitch = activeCharIndices[randomActiveIndex];

        let currentFlatIdx = 0;
        let actualStringIdx = -1;
        for (let j = 0; j < text.length; j++) {
          if (text[j] === "\n") continue;
          if (currentFlatIdx === flatIndexToGlitch) {
            actualStringIdx = j;
            break;
          }
          currentFlatIdx++;
        }

        if (
          actualStringIdx !== -1 &&
          chars[actualStringIdx] !== EMPTY_CHAR &&
          chars[actualStringIdx] !== "\n"
        ) {
          const currentHex = chars[actualStringIdx];
          const intValue = parseInt(currentHex, 16);
          if (!isNaN(intValue)) {
            const newValue = (intValue + 1) % 16;
            chars[actualStringIdx] = newValue.toString(16).toUpperCase();
          }
        }
      }

      setGlitchedText(chars.join(""));

      // Schedule the next animation frame after the interval
      timeoutId = setTimeout(() => {
        animationFrameId = requestAnimationFrame(animate);
      }, glitchInterval);
    };

    // Start the first animation frame immediately
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      // Cleanup: clear the timeout and cancel the animation frame
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [text, activeCharIndices, prefersReducedMotion]);

  return glitchedText || text;
}
