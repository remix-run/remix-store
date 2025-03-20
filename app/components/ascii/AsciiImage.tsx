import { useEffect, useRef, useState } from "react";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import type { HydrogenImageProps } from "../ui/image";

type AsciiImageProps = {
  data: HydrogenImageProps["data"];
  className?: string;
  asciiDensity?: number; // Controls the resolution of ASCII grid
  characters?: string[];
  style?: React.CSSProperties;
};

const WIDTH = 100;

export function AsciiImage({
  data,
  className = "",
  asciiDensity = 0.35, // Lower number = more detailed
  characters = ["█", "▓", "▒", "░", " "],
  style,
}: AsciiImageProps) {
  const [asciiArt, setAsciiArt] = useState<string[]>([]);
  const [scale, setScale] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Function to generate ASCII art from image
    const generateAscii = async () => {
      if (!data?.url) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const image = new Image();
      image.crossOrigin = "Anonymous";
      image.src = `${data.url}?w=${WIDTH}`;

      image.onload = () => {
        if (!canvasRef.current || !containerRef.current) {
          setIsLoading(false);
          return;
        }

        const asciiWidth = WIDTH;
        const asciiHeight = (image.height / image.width) * WIDTH;

        // Set canvas dimensions
        const canvas = canvasRef.current;
        canvas.width = asciiWidth;
        canvas.height = asciiHeight;

        // Draw image on canvas
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setIsLoading(false);
          return;
        }

        ctx.drawImage(image, 0, 0, asciiWidth, asciiHeight);

        try {
          // Get image data
          const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
          const pixelData = imageData.data;

          // Generate ASCII art
          const asciiRows: string[] = [];
          for (let y = 0; y < asciiHeight; y++) {
            let row = "";
            for (let x = 0; x < asciiWidth; x++) {
              // Get pixel index
              const pixelIndex = (y * asciiWidth + x) * 4;

              // Get pixel color values
              const r = pixelData[pixelIndex];
              const g = pixelData[pixelIndex + 1];
              const b = pixelData[pixelIndex + 2];

              // Calculate brightness (0-255)
              const brightness = (r + g + b) / 3;

              // Map brightness to character index
              // Divide brightness into characters.length groups
              const characterIndex = Math.floor(
                (brightness / 255) * (characters.length - 1),
              );
              //   const characterIndex = Math.min(
              //     Math.floor(brightness / (255 / characters.length)),
              //     characters.length - 1,
              //   );

              // Add character to row
              row += characters[characters.length - 1 - characterIndex];
            }
            asciiRows.push(row);
          }

          setAsciiArt(asciiRows);
          setDimensions({ width: asciiWidth, height: asciiHeight });
        } catch (error) {
          console.error("Error generating ASCII art:", error);
        } finally {
          setIsLoading(false);
        }
      };

      image.onerror = () => {
        console.error("Error loading image for ASCII conversion");
        setIsLoading(false);
      };
    };

    function scaleImage() {
      const containerWidth =
        containerRef.current?.offsetWidth ?? window.innerWidth;

      setScale(containerWidth / 60);
    }

    generateAscii();
    scaleImage();

    // Resize handler with debounce
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      scaleImage();

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        generateAscii();
      }, 300); // 300ms debounce
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [data, asciiDensity, characters]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div
        className="absolute top-1/2 left-1/2 h-fit w-fit text-center font-mono text-[1px] leading-[1em] font-light tracking-[0em] whitespace-pre text-white select-none"
        style={{
          //   backgroundImage: `url(${data?.url}?w=${WIDTH})`,
          //   background: `linear-gradient(0deg, rgba(57, 146, 255, 0.6), rgba(0, 0, 0, 0.6)), url(${data?.url}?w=${WIDTH})`,
          //   boxShadow: "inset 0 0 0 2000px rgba(57, 146, 255, 0.7)",
          //   backgroundRepeat: "no-repeat",
          //   backgroundSize: "100% 100%",
          //   backgroundClip: "text",

          // TODO: scale changes with screen size, need to fix
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <canvas ref={canvasRef} className="hidden" />
        {asciiArt.join("\n")}
      </div>
    </div>
  );
}
