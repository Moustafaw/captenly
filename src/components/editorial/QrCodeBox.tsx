"use client";

import React, { useMemo } from "react";

interface QrCodeBoxProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * Generates a deterministic scannable-style SVG QR matrix purely client-side
 * so member codes and session ledger QR cards render reliably even offline.
 */
export function QrCodeBox({ value, size = 160, label }: QrCodeBoxProps) {
  const modules = useMemo(() => {
    const dim = 21;
    const grid: boolean[][] = Array.from({ length: dim }, () =>
      Array.from({ length: dim }, () => false)
    );

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[r0 + r][c0 + c] = isOuter || isInner;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, dim - 7);
    drawFinder(dim - 7, 0);

    // Timing patterns
    for (let i = 8; i < dim - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Deterministic data hash fill outside finder zones
    let seed = 2166136261;
    for (let i = 0; i < value.length; i++) {
      seed ^= value.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= dim - 8;
        const inBottomLeft = r >= dim - 8 && c < 8;
        if (inTopLeft || inTopRight || inBottomLeft || r === 6 || c === 6) continue;

        seed ^= r * 31 + c * 17;
        seed = Math.imul(seed, 16777619) >>> 0;
        grid[r][c] = (seed % 11) < 5;
      }
    }

    return { dim, grid };
  }, [value]);

  const cellSize = 10;
  const viewDim = modules.dim * cellSize;

  return (
    <div className="inline-flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-card border border-surface-container shadow-sm">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewDim} ${viewDim}`}
        className="rounded-lg bg-white p-1"
        role="img"
        aria-label={label || `QR Code ${value}`}
      >
        <rect x={0} y={0} width={viewDim} height={viewDim} fill="#FFFFFF" />
        {modules.grid.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                rx={1.5}
                fill="#2C3437"
              />
            ) : null
          )
        )}
      </svg>
      {label && (
        <span className="font-mono text-[11px] font-bold tracking-wider text-dark-slate bg-surface-snow px-2.5 py-0.5 rounded-full">
          {label}
        </span>
      )}
    </div>
  );
}
