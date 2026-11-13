"use client";

import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";

export default function Desktop3() {
  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 px-margin lg:px-margin-desktop max-w-[1280px] mx-auto">
      <DemandRadarFallback />
    </div>
  );
}
