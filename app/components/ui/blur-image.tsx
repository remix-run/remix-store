import { useEffect, useState } from "react";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import { clsx } from "clsx";
import type { ProductImageFragment } from "storefrontapi.generated";

// I hate this, why can't I just get the props from HydrogenImage? Why is data optional?
type BlurImageProps = Parameters<typeof HydrogenImage>[0] & {
  data: ProductImageFragment;
};

/**
 * BlurImage shows a blurred, low-res preview while the main image loads.
 * It uses Shopify's CDN to request a tiny version for the preview.
 */
export default function BlurImage({
  className,
  alt,
  data,
  ...props
}: BlurImageProps) {
  const [loadState, setLoadState] = useState<
    "idle" | "pending" | "loaded" | "error"
  >("idle");

  // Add ?width=32 for a tiny preview
  const url = data.url;
  const previewUrl = url.includes("?") ? `${url}&width=32` : `${url}?width=32`;

  useEffect(() => {
    if (loadState !== "idle") return;

    setLoadState("pending");

    let img = new Image();
    img.addEventListener("load", () => setLoadState("loaded"), { once: true });
    img.addEventListener("error", () => setLoadState("error"), { once: true });
    img.src = previewUrl;
  }, [loadState, previewUrl]);

  return (
    <div className={clsx("relative w-full h-full", className)}>
      {/* Blurred preview image */}
      <img
        src={previewUrl}
        alt={alt}
        className={clsx(
          "absolute inset-0 size-full object-cover blur-2xl transition-opacity duration-150",
          loadState === "loaded" ? "opacity-0" : "opacity-100",
        )}
        draggable={false}
        aria-hidden={true}
      />
      {/* Full image */}
      <HydrogenImage
        data={data}
        {...props}
        className={clsx(
          "relative w-full h-full object-cover transition-all duration-750",
          loadState === "loaded" ? "blur-none" : "blur-2xl",
        )}
      />
    </div>
  );
}
