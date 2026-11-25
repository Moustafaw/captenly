"use client";

import React from "react";
import Image, { type ImageProps } from "next/image";

/**
 * Shared responsive image wrapper using next/image with WebP/AVIF optimization
 * for local/HTTPS assets and safe unoptimized pass-through for dynamic API proxies
 * (/api/places/photo, /api/supabase/media) or transient data/blob URLs.
 */
export const CaptenlyImage = React.forwardRef<HTMLImageElement, ImageProps>(function CaptenlyImage(
  { src, alt, unoptimized, ...rest },
  ref
) {
  const srcStr = typeof src === "string" ? src : "";
  const skipOptimizer =
    Boolean(unoptimized) ||
    srcStr.startsWith("data:") ||
    srcStr.startsWith("blob:") ||
    srcStr.startsWith("/api/") ||
    srcStr.startsWith("http://");

  return <Image ref={ref} src={src} alt={alt} unoptimized={skipOptimizer} {...rest} />;
});
