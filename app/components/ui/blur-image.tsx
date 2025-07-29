import { useLayoutEffect, useRef, useState } from "react";
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
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<"pending" | "loaded" | "error">(
    "pending",
  );

  // Add ?width=32 for a tiny preview
  const url = data.url;
  const previewUrl = url.includes("?") ? `${url}&width=32` : `${url}?width=32`;

  useLayoutEffect(() => {
    const node = imageRef.current;
    if (!node) return;
    if (loadState !== "pending") return;

    if (node.complete) {
      setLoadState("loaded");
      return;
    }

    node.onload = () => {
      setLoadState("loaded");
    };

    node.onerror = () => {
      setLoadState("error");
    };

    return () => {
      node.onload = null;
      node.onerror = null;
    };
  }, [loadState]);

  return (
    <div className={clsx("relative h-full w-full", className)}>
      {/* Blurred preview image */}
      <img
        src={previewUrl}
        alt={alt}
        className={clsx(
          "absolute inset-0 size-full object-cover blur-2xl transition-opacity duration-750",
          loadState === "loaded" ? "opacity-0" : "opacity-100",
        )}
        draggable={false}
        aria-hidden={true}
      />
      {/* Full image */}
      <HydrogenImage
        ref={imageRef}
        data={data}
        {...props}
        className={clsx(
          "relative h-full w-full object-cover transition-all duration-750",
          loadState === "loaded" ? "blur-none" : "blur-2xl",
        )}
      />
    </div>
  );
}
