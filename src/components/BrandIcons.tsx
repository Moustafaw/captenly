"use client";

import React from "react";
import Image from "next/image";

interface IconProps {
  size?: number | string;
  className?: string;
  variant?: "vector" | "image";
}

/**
 * 1. Checkmark Inside Shield (الاعتماد والتوثيق الرسمي)
 * Based on Reference Icon: Checkmark_inside_shield_app_icon_f8f0b604_2K.jpg
 */
export function ShieldCheckIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/Checkmark_inside_shield_app_icon_f8f0b604_2K.jpg"
        alt="Shield Check"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      <path
        d="M24 8L36 13V22C36 30 24 38 24 38C24 38 12 30 12 22V13L24 8Z"
        stroke="#B0FE09"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 23L22 27L30 19"
        stroke="#B0FE09"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 2. Minimalist Swimming App Icon (السباحة والمسابح المعتمدة)
 * Based on Reference Icon: Minimalist_swimming_app_icon_da0c3f2f_2K.jpg
 */
export function SwimmerWaveIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/Minimalist_swimming_app_icon_da0c3f2f_2K.jpg"
        alt="Swimmer Wave"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      <circle cx="31" cy="16" r="3.5" fill="#B0FE09" />
      <path
        d="M16 23C19 20 25 18 29 21L33 24"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M12 30C16 27 20 27 24 30C28 33 32 33 36 30"
        stroke="#B0FE09"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M12 36C16 33 20 33 24 36C28 39 32 39 36 36"
        stroke="#B0FE09"
        strokeWidth="2"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3. QR Code Ledger Icon (دفتر الحصص والحضور الفوري)
 * Based on Reference Icon: App_icon_depicting_QR_code_28929396_2K.jpg
 */
export function QrLedgerIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/App_icon_depicting_QR_code_28929396_2K.jpg"
        alt="QR Code"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      {/* Top Left Finder */}
      <rect x="12" y="12" width="10" height="10" rx="2" stroke="#B0FE09" strokeWidth="2" />
      <rect x="15" y="15" width="4" height="4" fill="#B0FE09" />
      {/* Top Right Finder */}
      <rect x="26" y="12" width="10" height="10" rx="2" stroke="#B0FE09" strokeWidth="2" />
      <rect x="29" y="15" width="4" height="4" fill="#B0FE09" />
      {/* Bottom Left Finder */}
      <rect x="12" y="26" width="10" height="10" rx="2" stroke="#B0FE09" strokeWidth="2" />
      <rect x="15" y="29" width="4" height="4" fill="#B0FE09" />
      {/* Data Dots */}
      <rect x="26" y="26" width="4" height="4" rx="1" fill="#FFFFFF" />
      <rect x="32" y="32" width="4" height="4" rx="1" fill="#B0FE09" />
      <rect x="26" y="32" width="4" height="4" rx="1" fill="#FFFFFF" />
      <rect x="32" y="26" width="4" height="4" rx="1" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 4. Minimalist App Icon with Chart (لوحة التحليلات والإحصائيات)
 * Based on Reference Icon: Minimalist_app_icon_with_chart_2c71f702_2K.jpg
 */
export function AnalyticsChartIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/Minimalist_app_icon_with_chart_2c71f702_2K.jpg"
        alt="Chart"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      <rect x="12" y="26" width="5" height="12" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
      <rect x="20" y="20" width="5" height="18" rx="1.5" fill="#FFFFFF" fillOpacity="0.7" />
      <rect x="28" y="14" width="5" height="24" rx="1.5" fill="#B0FE09" />
      <path
        d="M14 22L22 17L31 11L36 14"
        stroke="#B0FE09"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="11" r="2.5" fill="#B0FE09" />
    </svg>
  );
}

/**
 * 5. Minimalist App Icon with Motion (الجواز الرياضي والأزمنة القياسية)
 * Based on Reference Icon: Minimalist_app_icon_with_motion_a0ee9b99_2K.jpg
 */
export function MotionSpeedIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/Minimalist_app_icon_with_motion_a0ee9b99_2K.jpg"
        alt="Motion Speed"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      <path
        d="M12 16H22M10 24H28M14 32H20"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <circle cx="28" cy="24" r="9" stroke="#B0FE09" strokeWidth="2.5" />
      <path
        d="M28 19V24L32 26"
        stroke="#B0FE09"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 6. Minimalist Fitness App Icon (الجيم واللياقة البدنية)
 * Based on Reference Icon: Minimalist_fitness_app_icon_design_87ad5475_2K.jpg
 */
export function DumbbellFitnessIcon({ size = 24, className = "", variant = "vector" }: IconProps) {
  if (variant === "image") {
    return (
      <Image
        src="/images/icons/Minimalist_fitness_app_icon_design_87ad5475_2K.jpg"
        alt="Fitness Dumbbell"
        width={typeof size === "number" ? size : 32}
        height={typeof size === "number" ? size : 32}
        className={`rounded-xl object-cover ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="#2C3437" />
      <path
        d="M13 18V30M18 15V33M30 15V33M35 18V30M18 24H30"
        stroke="#B0FE09"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
