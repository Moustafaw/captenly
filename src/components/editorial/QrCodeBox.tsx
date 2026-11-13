"use client";

import React, { useMemo } from "react";
import QRCode from "qrcode";

interface QrCodeBoxProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * Generates a standard ISO/IEC 18004 scannable QR code SVG entirely client-side
 * (works offline inside swimming pools and scans cleanly with smartphone cameras & jsQR).
 */
export function QrCodeBox({ value, size = 160, label }: QrCodeBoxProps) {
  const qrMatrix = useMemo(() => {
    const text = (value || "CAPTENLY").trim();
    const generated = QRCode.create(text, { errorCorrectionLevel: "M" });
    const moduleCount = generated.modules.size;
    const quietZone = 3;
    const totalModules = moduleCount + quietZone * 2;
    const pathParts: string[] = [];

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (generated.modules.get(r, c)) {
          const x = c + quietZone;
          const y = r + quietZone;
          pathParts.push(`M${x},${y}h1v1h-1z`);
        }
      }
    }

    return {
      totalModules,
      pathData: pathParts.join(""),
    };
  }, [value]);

  return (
    <div className="inline-flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-card border border-surface-container shadow-sm">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${qrMatrix.totalModules} ${qrMatrix.totalModules}`}
        shapeRendering="crispEdges"
        className="rounded-lg bg-white"
        role="img"
        aria-label={label || `QR Code ${value}`}
      >
        <rect
          x={0}
          y={0}
          width={qrMatrix.totalModules}
          height={qrMatrix.totalModules}
          fill="#FFFFFF"
        />
        <path d={qrMatrix.pathData} fill="#2C3437" />
      </svg>
      {label && (
        <span className="font-mono text-[11px] font-bold tracking-wider text-dark-slate bg-surface-snow px-2.5 py-0.5 rounded-full">
          {label}
        </span>
      )}
    </div>
  );
}
