"use client";

import React from "react";

interface CaptenlyLogoProps {
  variant?: "horizontal" | "stacked" | "mark";
  theme?: "dark" | "light";
  size?: "sm" | "md" | "lg";
}

export function CaptenlyLogo({
  variant = "horizontal",
  theme = "dark",
  size = "md",
}: CaptenlyLogoProps) {
  const isDarkBg = theme === "dark";
  const textColor = isDarkBg ? "#FFFFFF" : "#2C3437";
  const dotColor = isDarkBg ? "#B0FE09" : "#3F6212";
  const kickColor = "#B0FE09";

  const iconSizes = {
    sm: 32,
    md: 42,
    lg: 56,
  };
  const px = iconSizes[size];

  const KineticMark = () => (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <rect
        width="120"
        height="120"
        rx="28"
        fill={isDarkBg ? "#1A1F21" : "#2C3437"}
        stroke="#B0FE09"
        strokeWidth="3"
        strokeOpacity={isDarkBg ? "0.4" : "0.8"}
      />
      {/* Kinetic Head Dot (1x Reference Grid Unit) */}
      <circle cx="74" cy="26" r="11" fill="#B0FE09" />
      {/* Forward 45° Momentum Arm */}
      <path
        d="M40 52C48 43 60 42 71 47L82 53"
        stroke="#FFFFFF"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {/* Open 'C' Core Body */}
      <path
        d="M80 55C67 48 51 54 51 68C51 82 67 87 80 79"
        stroke="#FFFFFF"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* 45° Kinetic Axis Leg */}
      <path
        d="M52 73L34 93"
        stroke={kickColor}
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === "mark") {
    return <KineticMark />;
  }

  if (variant === "stacked") {
    return (
      <div className="inline-flex flex-col items-center gap-1.5 select-none">
        <KineticMark />
        <div className="flex flex-col items-center leading-none">
          <span
            className="font-inter font-extrabold tracking-tight text-xl"
            style={{ color: textColor }}
          >
            capten<span style={{ color: dotColor }}>l</span>y
          </span>
          <span
            className="font-cairo font-bold text-sm mt-0.5"
            style={{ color: isDarkBg ? "#B0FE09" : "#3F6212" }}
          >
            كابتنلي
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 select-none" dir="ltr">
      <KineticMark />
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center">
          <span
            className={`font-inter font-black tracking-tight ${
              size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl"
            }`}
            style={{ color: textColor }}
          >
            capten
          </span>
          {/* Highlighting the 'L' to enforce the Anti-Confusion Protocol vs Capteny */}
          <span
            className={`font-inter font-black tracking-tight underline decoration-2 underline-offset-4 ${
              size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl"
            }`}
            style={{
              color: isDarkBg ? "#B0FE09" : "#3F6212",
              textDecorationColor: "#B0FE09",
            }}
          >
            l
          </span>
          <span
            className={`font-inter font-black tracking-tight ${
              size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl"
            }`}
            style={{ color: textColor }}
          >
            y
          </span>
        </div>
        <span
          className="font-cairo font-bold text-xs tracking-wide mt-0.5 text-right"
          style={{ color: isDarkBg ? "#ECFCCB" : "#3F6212" }}
        >
          كابتنـلـي
        </span>
      </div>
    </div>
  );
}
