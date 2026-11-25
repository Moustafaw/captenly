"use client";

import React, { useEffect, useState } from "react";

export function ResponsiveScreen({
  desktop,
  phone,
  ssrFallback,
}: {
  desktop: React.ReactNode;
  phone: React.ReactNode;
  ssrFallback?: React.ReactNode;
}) {
  const [mountedViewport, setMountedViewport] = useState<"desktop" | "phone" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setMountedViewport(mq.matches ? "desktop" : "phone");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (mountedViewport === "phone") {
    return <div className="w-full">{phone}</div>;
  }

  if (mountedViewport === "desktop") {
    return <div className="w-full">{desktop}</div>;
  }

  if (ssrFallback) {
    return <div className="w-full">{ssrFallback}</div>;
  }

  return <div className="hidden lg:block w-full">{desktop}</div>;
}
