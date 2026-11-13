import React from "react";

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

const ACCENT = "#84CC16";

/**
 * Captenly Custom Studio Icon System
 * Modeled after Reference Icon artwork:
 * - Smooth organic rounded strokes (2.15px on 24x24 grid)
 * - Open athletic contours (intentional dynamic gaps)
 * - Signature lime-olive accent dot / secondary stroke (#84CC16)
 */
export function Icon({ name, className = "", style }: IconProps) {
  const cleanName = (name || "").trim().toLowerCase();

  // Honor Tailwind text-[Npx] OR w-N/h-N sizing if supplied; fallback to 18x18px
  const hasTextPx = /text-\[\d+px\]/.test(className);
  const hasBoxSize = /\b[wh]-\d+/.test(className);
  const sizeAttr = hasTextPx
    ? { width: "1.08em", height: "1.08em" }
    : hasBoxSize
    ? {}
    : { width: 18, height: 18 };

  const svgProps: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: `inline-block shrink-0 align-middle ${className}`,
    style,
    "aria-hidden": true,
    ...sizeAttr,
  };

  const s = {
    stroke: "currentColor",
    strokeWidth: 2.15,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (cleanName) {
    // ── Home ──────────────────────────────────────────────────────────
    case "home":
      return (
        <svg {...svgProps}>
          <path
            d="M4.5 10.5L12 4.5L19.5 10.5V18.5C19.5 19.6 18.6 20.5 17.5 20.5H6.5C5.4 20.5 4.5 19.6 4.5 18.5V10.5Z"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path d="M4 10.2L11.3 4.3C11.7 4 12.3 4 12.7 4.3L20 10.2" {...s} />
          <path d="M5.5 12V18.2C5.5 19.3 6.4 20.2 7.5 20.2H16.5C17.6 20.2 18.5 19.3 18.5 18.2V14.5" {...s} />
          <path d="M10 20.2V15.5C10 14.7 10.7 14 11.5 14H12.5C13.3 14 14 14.7 14 15.5V20.2" {...s} />
          <circle cx="18.5" cy="11.2" r="1.7" fill={ACCENT} />
        </svg>
      );

    // ── Explore / Compass ─────────────────────────────────────────────
    case "explore":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.07" />
          <path d="M18.8 7.5A8.5 8.5 0 1 0 20.2 14.2" {...s} />
          <path
            d="M15.4 8.6L13.5 13.5L8.6 15.4L10.5 10.5L15.4 8.6Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.14"
          />
          <circle cx="19.3" cy="10.2" r="1.8" fill={ACCENT} />
        </svg>
      );

    // ── Compare / Dual Motion Arrows ──────────────────────────────────
    case "compare_arrows":
    case "swap_vert":
    case "scale":
      return (
        <svg {...svgProps}>
          <path d="M4.5 8.5H16.5L13.5 5.5" {...s} />
          <path d="M19.5 15.5H7.5L10.5 18.5" {...s} />
          <circle cx="19.2" cy="8.5" r="1.7" fill={ACCENT} />
          <circle cx="4.8" cy="15.5" r="1.5" fill={ACCENT} fillOpacity="0.8" />
        </svg>
      );

    // ── QR Ledger (Reference Icon #1: ring-notebook / QR + lime dots) ──
    case "qr_code_2":
    case "qr_code":
    case "qr_code_scanner":
      return (
        <svg {...svgProps}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" {...s} />
          <rect x="6.4" y="6.4" width="1.7" height="1.7" rx="0.5" fill={ACCENT} />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" {...s} />
          <rect x="15.9" y="6.4" width="1.7" height="1.7" rx="0.5" fill="currentColor" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" {...s} />
          <rect x="6.4" y="15.9" width="1.7" height="1.7" rx="0.5" fill="currentColor" />
          <path d="M14 14H16.5M14 19.5H19.5V16.5" {...s} />
          <circle cx="19" cy="13.8" r="1.7" fill={ACCENT} />
          <circle cx="14.5" cy="16.8" r="1.2" fill={ACCENT} />
        </svg>
      );

    // ── Verified Shield (Reference Icon #2: open shield + bold check + dot) ──
    case "verified":
    case "verified_user":
    case "security":
    case "health_and_safety":
    case "policy":
    case "shield_lock":
    case "phonelink_lock":
      return (
        <svg {...svgProps}>
          <path
            d="M12 3.5L18.5 6.2V11.8C18.5 16.4 12 20.5 12 20.5C12 20.5 5.5 16.4 5.5 11.8V6.2L12 3.5Z"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path d="M15.4 4.9L12 3.5L5.5 6.2V11.8C5.5 16.4 12 20.5 12 20.5C12 20.5 18.5 16.4 18.5 11.8V9.8" {...s} />
          <path d="M9.3 12.2L11.4 14.3L15.6 10.1" {...s} />
          <circle cx="18.6" cy="5.8" r="2" fill={ACCENT} />
        </svg>
      );

    case "shield":
    case "gshield":
      return (
        <svg {...svgProps}>
          <path
            d="M14.8 4.7L12 3.5L5.5 6.2V11.8C5.5 16.4 12 20.5 12 20.5C12 20.5 18.5 16.4 18.5 11.8V9.5"
            {...s}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <circle cx="18.5" cy="5.8" r="1.9" fill={ACCENT} />
        </svg>
      );

    // ── Progress / Analytics Chart (Reference Icon #3: ascending pills + dot) ──
    case "insights":
    case "monitoring":
    case "bar_chart":
      return (
        <svg {...svgProps}>
          <rect x="4" y="14" width="3.4" height="6" rx="1.7" fill="currentColor" fillOpacity="0.45" />
          <rect x="10.3" y="10.5" width="3.4" height="9.5" rx="1.7" fill="currentColor" fillOpacity="0.75" />
          <rect x="16.6" y="7.8" width="3.4" height="12.2" rx="1.7" fill="currentColor" />
          <circle cx="18.3" cy="4.3" r="1.9" fill={ACCENT} />
        </svg>
      );

    // ── Momentum / Score / Speed (Reference Icon #4: curved arrow + dot) ──
    case "sports_score":
    case "workspace_premium":
    case "military_tech":
      return (
        <svg {...svgProps}>
          <path d="M4.5 17.5C7 14 9 11 11 11C13 11 12.5 15.5 14.5 15.5C16.2 15.5 17.8 11.5 19.5 8" {...s} />
          <path d="M15.8 7.5H19.8V11.5" {...s} />
          <circle cx="14.2" cy="6.2" r="2" fill={ACCENT} />
        </svg>
      );

    // ── Fitness / Gym (Reference Icon #5: tilted barbell + orbital dot) ──
    case "fitness_center":
      return (
        <svg {...svgProps}>
          <path d="M6.8 17.2L17.2 6.8" {...s} />
          <path d="M4.8 13.8L10.2 19.2" {...s} />
          <path d="M13.8 4.8L19.2 10.2" {...s} />
          <path d="M3.8 16.2L7.8 20.2" {...s} />
          <path d="M16.2 3.8L20.2 7.8" {...s} />
          <circle cx="17.8" cy="16.5" r="2" fill={ACCENT} />
        </svg>
      );

    // ── Swimming / Waves (Reference Icon #6: flowing twin waves + swimmer spark) ──
    case "pool":
    case "water":
    case "water_ec":
    case "waves":
      return (
        <svg {...svgProps}>
          <path d="M4 11.5C6.8 8 10 8 12.5 11.2" {...s} />
          <path d="M3.5 15.2C5.7 13.7 7.9 13.7 10.1 15.2C12.3 16.7 14.5 16.7 16.7 15.2C18.2 14.2 19.5 14 20.5 14.5" {...s} />
          <path d="M3.5 18.8C5.7 17.3 7.9 17.3 10.1 18.8C12.3 20.3 14.5 20.3 16.7 18.8C18.2 17.8 19.5 17.6 20.5 18.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeOpacity="0.65" />
          <circle cx="16.5" cy="9.2" r="2.2" fill={ACCENT} />
          <circle cx="19.8" cy="11.5" r="1" fill={ACCENT} />
        </svg>
      );

    // ── Search ────────────────────────────────────────────────────────
    case "search":
      return (
        <svg {...svgProps}>
          <circle cx="11" cy="11" r="6.5" fill="currentColor" fillOpacity="0.06" />
          <path d="M16.8 8.2A6.5 6.5 0 1 0 14.8 16.1" {...s} />
          <path d="M16.2 16.2L20 20" {...s} />
          <circle cx="17.2" cy="11.8" r="1.5" fill={ACCENT} />
        </svg>
      );

    // ── User / Person ─────────────────────────────────────────────────
    case "person":
    case "account_circle":
    case "face":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="8.2" r="3.4" {...s} fill="currentColor" fillOpacity="0.1" />
          <path d="M5.5 19.5C5.5 16.3 8.4 14 12 14C15.6 14 18.5 16.3 18.5 19.5" {...s} />
          <circle cx="17.8" cy="6.2" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "groups":
    case "group":
    case "family_restroom":
      return (
        <svg {...svgProps}>
          <circle cx="9.2" cy="8.5" r="3" {...s} fill="currentColor" fillOpacity="0.1" />
          <path d="M3.8 19.2C3.8 16.3 6.2 14.2 9.2 14.2C12.2 14.2 14.6 16.3 14.6 19.2" {...s} />
          <path d="M15.2 6.8C16.7 7.1 17.8 8.3 17.8 9.9C17.8 11.2 16.9 12.3 15.8 12.6" {...s} />
          <path d="M17.2 14.8C19 15.5 20.2 17.1 20.2 19.2" {...s} />
          <circle cx="18.2" cy="5.5" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "child_care":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="7.2" {...s} fill="currentColor" fillOpacity="0.08" />
          <circle cx="9.6" cy="11.2" r="1" fill="currentColor" />
          <circle cx="14.4" cy="11.2" r="1" fill="currentColor" />
          <path d="M9.5 14.4C10.3 15.4 11.2 15.8 12 15.8C12.8 15.8 13.7 15.4 14.5 14.4" {...s} />
          <circle cx="17.8" cy="5.8" r="1.6" fill={ACCENT} />
        </svg>
      );

    // ── Location / Pins / Navigation ──────────────────────────────────
    case "location_on":
    case "pin_drop":
    case "add_location_alt":
      return (
        <svg {...svgProps}>
          <path
            d="M12 20.5C12 20.5 18 14.8 18 10A6 6 0 1 0 6 10C6 14.8 12 20.5 12 20.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.1"
          />
          <circle cx="12" cy="10" r="2.2" fill={ACCENT} />
        </svg>
      );

    case "near_me":
    case "navigation":
    case "directions":
      return (
        <svg {...svgProps}>
          <path
            d="M19.5 4.5L11.8 20L9.8 14.2L4 12.2L19.5 4.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.12"
          />
          <circle cx="19.2" cy="4.8" r="1.8" fill={ACCENT} />
        </svg>
      );

    // ── Notifications ─────────────────────────────────────────────────
    case "notifications":
    case "notifications_active":
      return (
        <svg {...svgProps}>
          <path
            d="M6.5 10.5A5.5 5.5 0 0 1 17.5 10.5C17.5 14.2 19 16 19.5 16.5H4.5C5 16 6.5 14.2 6.5 10.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.09"
          />
          <path d="M10.2 19.3A2 2 0 0 0 13.8 19.3" {...s} />
          <circle cx="17.8" cy="6.2" r="2" fill={ACCENT} />
        </svg>
      );

    // ── Bookmarks / Save ──────────────────────────────────────────────
    case "bookmark":
      return (
        <svg {...svgProps}>
          <path
            d="M7 4.8C7 4.1 7.6 3.5 8.3 3.5H15.7C16.4 3.5 17 4.1 17 4.8V20L12 16.6L7 20V4.8Z"
            {...s}
            fill="currentColor"
          />
          <circle cx="12" cy="9.2" r="1.8" fill={ACCENT} />
        </svg>
      );

    case "bookmark_border":
      return (
        <svg {...svgProps}>
          <path
            d="M17 9.5V20L12 16.6L7 20V4.8C7 4.1 7.6 3.5 8.3 3.5H14.2"
            {...s}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <circle cx="17.2" cy="5.5" r="1.8" fill={ACCENT} />
        </svg>
      );

    // ── Star ──────────────────────────────────────────────────────────
    case "star":
      return (
        <svg {...svgProps}>
          <path
            d="M12 3.8L14.5 8.8L20 9.6L16 13.5L16.9 19L12 16.4L7.1 19L8 13.5L4 9.6L9.5 8.8L12 3.8Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );

    // ── Chat / WhatsApp / Support ─────────────────────────────────────
    case "chat":
    case "forum":
      return (
        <svg {...svgProps}>
          <path
            d="M19.5 11.5C19.5 15.6 16.1 19 12 19C10.5 19 9.1 18.6 7.9 17.8L4.5 19L5.7 15.7C4.9 14.5 4.5 13 4.5 11.5C4.5 7.4 7.9 4 12 4C16.1 4 19.5 7.4 19.5 11.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.09"
          />
          <circle cx="9.2" cy="11.5" r="1.1" fill={ACCENT} />
          <circle cx="12.2" cy="11.5" r="1.1" fill="currentColor" />
          <circle cx="15.2" cy="11.5" r="1.1" fill="currentColor" />
        </svg>
      );

    // ── Checks / Completion ───────────────────────────────────────────
    case "check":
      return (
        <svg {...svgProps}>
          <path d="M5.5 12.5L9.8 16.8L18.5 7.5" {...s} />
          <circle cx="18.6" cy="7.4" r="1.5" fill={ACCENT} />
        </svg>
      );

    case "check_circle":
    case "task_alt":
    case "done_all":
    case "all_done":
    case "check_box":
      return (
        <svg {...svgProps}>
          <path d="M18.6 8.2A7.8 7.8 0 1 0 19.7 13.4" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M8.8 12.4L11.2 14.8L16.5 9.2" {...s} />
          <circle cx="18.8" cy="6.2" r="1.9" fill={ACCENT} />
        </svg>
      );

    case "check_box_outline_blank":
      return (
        <svg {...svgProps}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" {...s} />
        </svg>
      );

    // ── Tune / Filters / Sliders ──────────────────────────────────────
    case "tune":
    case "filter_list":
    case "sliders":
      return (
        <svg {...svgProps}>
          <path d="M4.5 7.5H19.5M4.5 12H19.5M4.5 16.5H19.5" {...s} />
          <circle cx="9" cy="7.5" r="2.2" fill={ACCENT} stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15.5" cy="12" r="2.2" fill="currentColor" />
          <circle cx="8.5" cy="16.5" r="2.2" fill={ACCENT} stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    // ── Thermostat / Heated Pool ──────────────────────────────────────
    case "thermostat":
    case "heat":
      return (
        <svg {...svgProps}>
          <path
            d="M14 14.4V5.8A2 2 0 1 0 10 5.8V14.4A3.8 3.8 0 1 0 14 14.4Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.09"
          />
          <circle cx="12" cy="17.2" r="1.8" fill={ACCENT} />
          <path d="M17.5 7.5H19.5M17.5 11H19.2" {...s} />
        </svg>
      );

    // ── Clock / Schedule / Hours ──────────────────────────────────────
    case "schedule":
    case "access_time":
    case "timer":
    case "hourglass_top":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.08" />
          <path d="M18.6 7.5A8 8 0 1 0 20 12" {...s} />
          <path d="M12 8.2V12.2L15 13.8" {...s} />
          <circle cx="18.6" cy="6.2" r="1.7" fill={ACCENT} />
        </svg>
      );

    case "calendar_month":
    case "calendar_today":
    case "event_available":
      return (
        <svg {...svgProps}>
          <rect x="4.5" y="5.5" width="15" height="14.5" rx="3" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M8.5 3.5V6.5M15.5 3.5V6.5M4.5 10H19.5" {...s} />
          <circle cx="15" cy="14.5" r="1.8" fill={ACCENT} />
        </svg>
      );

    // ── Payments / Card / 0% Commission ───────────────────────────────
    case "payments":
    case "request_quote":
    case "price_check":
      return (
        <svg {...svgProps}>
          <rect x="3.5" y="6" width="17" height="12" rx="3" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M3.5 10.2H20.5" {...s} />
          <path d="M7.5 14.4H11" {...s} />
          <circle cx="16.5" cy="14.4" r="1.7" fill={ACCENT} />
        </svg>
      );

    // ── Magazine / Books / Docs ───────────────────────────────────────
    case "menu_book":
    case "bookmarks":
    case "article":
    case "description":
    case "receipt_long":
    case "picture_as_pdf":
      return (
        <svg {...svgProps}>
          <path
            d="M4.5 6.5C4.5 5.4 5.4 4.5 6.5 4.5H10.5C11.3 4.5 12 5.2 12 6V18.8C11.4 18.2 10.6 17.8 9.7 17.8H6.5C5.4 17.8 4.5 16.9 4.5 15.8V6.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path
            d="M19.5 6.5C19.5 5.4 18.6 4.5 17.5 4.5H13.5C12.7 4.5 12 5.2 12 6V18.8C12.6 18.2 13.4 17.8 14.3 17.8H17.5C18.6 17.8 19.5 16.9 19.5 15.8V6.5Z"
            {...s}
          />
          <circle cx="15.8" cy="9.5" r="1.5" fill={ACCENT} />
        </svg>
      );

    case "file_download_done":
    case "assignment_turned_in":
      return (
        <svg {...svgProps}>
          <path
            d="M7 4H14.5L18.5 8V18.5C18.5 19.6 17.6 20.5 16.5 20.5H7.5C6.4 20.5 5.5 19.6 5.5 18.5V5.5C5.5 4.7 6.2 4 7 4Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path d="M9.5 13.5L11.5 15.5L15.2 11.5" {...s} />
          <circle cx="17.8" cy="5.5" r="1.7" fill={ACCENT} />
        </svg>
      );

    // ── Facilities / Clubs / Stadium ──────────────────────────────────
    case "stadium":
    case "domain":
    case "roofing":
      return (
        <svg {...svgProps}>
          <path
            d="M4.5 10.5L12 5L19.5 10.5V19C19.5 19.8 18.8 20.5 18 20.5H6C5.2 20.5 4.5 19.8 4.5 19V10.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path d="M9 14H15M9 17.5H12.5" {...s} />
          <circle cx="12" cy="9.5" r="1.7" fill={ACCENT} />
        </svg>
      );

    // ── Trophy / Badge / Awards ───────────────────────────────────────
    case "trophy":
    case "badge":
    case "celebration":
      return (
        <svg {...svgProps}>
          <path
            d="M7.5 4.5H16.5V9.5A4.5 4.5 0 0 1 7.5 9.5V4.5Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.1"
          />
          <path d="M7.5 6H4.8C4.8 8.5 5.8 10 7.5 10M16.5 6H19.2C19.2 8.5 18.2 10 16.5 10M12 14V19M8.5 19.5H15.5" {...s} />
          <circle cx="12" cy="8.2" r="1.6" fill={ACCENT} />
        </svg>
      );

    // ── Medical / Compliance ──────────────────────────────────────────
    case "medical_services":
    case "gavel":
      return (
        <svg {...svgProps}>
          <rect x="4" y="6.5" width="16" height="13" rx="3.2" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M9.5 6.5V5C9.5 4.2 10.2 3.5 11 3.5H13C13.8 3.5 14.5 4.2 14.5 5V6.5" {...s} />
          <path d="M12 10.2V15.8M9.2 13H14.8" {...s} />
          <circle cx="18.2" cy="5.2" r="1.6" fill={ACCENT} />
        </svg>
      );

    // ── Radar / Sensors / Campaign ────────────────────────────────────
    case "radar":
    case "sensors":
    case "campaign":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" {...s} strokeDasharray="3 3" strokeOpacity="0.6" />
          <circle cx="12" cy="12" r="4.5" {...s} />
          <circle cx="12" cy="12" r="1.8" fill={ACCENT} />
        </svg>
      );

    // ── Camera / Upload / Share / Copy / Download ─────────────────────
    case "photo_camera":
    case "camera":
    case "camera_alt":
      return (
        <svg {...svgProps}>
          <path
            d="M4.5 9.2C4.5 8.1 5.4 7.2 6.5 7.2H8.4L9.7 5.2H14.3L15.6 7.2H17.5C18.6 7.2 19.5 8.1 19.5 9.2V17.5C19.5 18.6 18.6 19.5 17.5 19.5H6.5C5.4 19.5 4.5 18.6 4.5 17.5V9.2Z"
            {...s}
            fill="currentColor"
            fillOpacity="0.09"
          />
          <circle cx="12" cy="13.2" r="2.8" {...s} />
          <circle cx="17" cy="10" r="1.2" fill={ACCENT} />
        </svg>
      );

    case "cloud_upload":
      return (
        <svg {...svgProps}>
          <path d="M7.5 17.5H17C19 17.5 20.5 16 20.5 14C20.5 12.2 19.2 10.7 17.4 10.5C16.7 7.6 14.1 5.5 11 5.5C7.6 5.5 4.8 8.2 4.6 11.6C3.9 12.2 3.5 13.1 3.5 14.1C3.5 16 5.3 17.5 7.5 17.5Z" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M12 15V10.5M9.8 12.5L12 10.2L14.2 12.5" {...s} />
          <circle cx="16.5" cy="7.5" r="1.5" fill={ACCENT} />
        </svg>
      );

    case "share":
      return (
        <svg {...svgProps}>
          <path d="M8.5 11L15.2 7.2M8.5 13L15.2 16.8" {...s} />
          <circle cx="6.2" cy="12" r="2.3" {...s} fill="currentColor" fillOpacity="0.1" />
          <circle cx="17.2" cy="6.2" r="2.3" fill={ACCENT} stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17.2" cy="17.8" r="2.3" {...s} fill="currentColor" fillOpacity="0.1" />
        </svg>
      );

    case "content_copy":
      return (
        <svg {...svgProps}>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" {...s} fill="currentColor" fillOpacity="0.09" />
          <path d="M15 8.5V6.5C15 5.4 14.1 4.5 13 4.5H6.5C5.4 4.5 4.5 5.4 4.5 6.5V13C4.5 14.1 5.4 15 6.5 15H8.5" {...s} />
          <circle cx="16.2" cy="11.8" r="1.4" fill={ACCENT} />
        </svg>
      );

    case "download":
      return (
        <svg {...svgProps}>
          <path d="M12 4.5V14.5M8.5 11.2L12 14.8L15.5 11.2" {...s} />
          <path d="M5 17.5V18.5C5 19.3 5.7 20 6.5 20H17.5C18.3 20 19 19.3 19 18.5V17.5" {...s} />
          <circle cx="16.8" cy="6.2" r="1.5" fill={ACCENT} />
        </svg>
      );

    // ── Auth / Security / Offline / Status ────────────────────────────
    case "lock":
    case "lock_reset":
      return (
        <svg {...svgProps}>
          <rect x="5" y="10.5" width="14" height="9.5" rx="3" {...s} fill="currentColor" fillOpacity="0.09" />
          <path d="M8.5 10.5V7.8A3.5 3.5 0 1 1 15.5 7.8V10.5" {...s} />
          <circle cx="12" cy="15.2" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "wifi_off":
      return (
        <svg {...svgProps}>
          <path d="M4.5 4.5L19.5 19.5" {...s} />
          <path d="M16.8 11.8A8.5 8.5 0 0 0 10.4 9M19.8 8.8A12.5 12.5 0 0 0 6.8 6.8" {...s} />
          <path d="M7.5 14.8A5 5 0 0 1 13.8 14.2" {...s} />
          <circle cx="12" cy="18.2" r="1.7" fill={ACCENT} />
        </svg>
      );

    case "info":
    case "help":
    case "help_outline":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8.5" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M12 11.2V16" {...s} />
          <circle cx="12" cy="8.2" r="1.4" fill={ACCENT} />
        </svg>
      );

    case "warning":
      return (
        <svg {...svgProps}>
          <path d="M12 4.2L20 18.8H4L12 4.2Z" {...s} fill="currentColor" fillOpacity="0.09" />
          <path d="M12 9.8V13.5" {...s} />
          <circle cx="12" cy="16.2" r="1.2" fill={ACCENT} />
        </svg>
      );

    // ── Directional / Controls ────────────────────────────────────────
    case "arrow_back":
      return (
        <svg {...svgProps}>
          <path d="M19 12H5.5M11 6.5L5.2 12L11 17.5" {...s} />
          <circle cx="19" cy="12" r="1.4" fill={ACCENT} />
        </svg>
      );

    case "arrow_forward":
      return (
        <svg {...svgProps}>
          <path d="M5 12H18.5M13 6.5L18.8 12L13 17.5" {...s} />
          <circle cx="5" cy="12" r="1.4" fill={ACCENT} />
        </svg>
      );

    case "chevron_left":
      return (
        <svg {...svgProps}>
          <path d="M14.5 6.5L9 12L14.5 17.5" {...s} />
        </svg>
      );

    case "chevron_right":
      return (
        <svg {...svgProps}>
          <path d="M9.5 6.5L15 12L9.5 17.5" {...s} />
        </svg>
      );

    case "arrow_drop_down":
    case "expand_more":
      return (
        <svg {...svgProps}>
          <path d="M6.5 9.5L12 15L17.5 9.5" {...s} />
        </svg>
      );

    case "expand_less":
      return (
        <svg {...svgProps}>
          <path d="M6.5 14.5L12 9L17.5 14.5" {...s} />
        </svg>
      );

    case "close":
    case "clear":
      return (
        <svg {...svgProps}>
          <path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" {...s} />
        </svg>
      );

    case "add":
    case "add_circle":
      return (
        <svg {...svgProps}>
          <path d="M12 5.5V18.5M5.5 12H18.5" {...s} />
          <circle cx="17.8" cy="6.2" r="1.4" fill={ACCENT} />
        </svg>
      );

    case "remove":
      return (
        <svg {...svgProps}>
          <path d="M5.5 12H18.5" {...s} />
        </svg>
      );

    case "sync":
    case "refresh":
    case "restart_alt":
      return (
        <svg {...svgProps}>
          <path d="M19.5 12A7.5 7.5 0 0 0 6.8 6.6L4.5 8.8M4.5 5.2V8.8H8.1" {...s} />
          <path d="M4.5 12A7.5 7.5 0 0 0 17.2 17.4L19.5 15.2M19.5 18.8V15.2H15.9" {...s} />
          <circle cx="12" cy="12" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "visibility":
      return (
        <svg {...svgProps}>
          <path d="M3.5 12C5.6 8.1 8.6 6.2 12 6.2C15.4 6.2 18.4 8.1 20.5 12C18.4 15.9 15.4 17.8 12 17.8C8.6 17.8 5.6 15.9 3.5 12Z" {...s} fill="currentColor" fillOpacity="0.08" />
          <circle cx="12" cy="12" r="2.6" fill={ACCENT} stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    case "visibility_off":
      return (
        <svg {...svgProps}>
          <path d="M4.5 4.5L19.5 19.5" {...s} />
          <path d="M9.8 6.6C10.5 6.4 11.2 6.2 12 6.2C15.4 6.2 18.4 8.1 20.5 12C19.6 13.7 18.4 15.1 17 16.1" {...s} />
          <path d="M6.5 8.5C5.3 9.5 4.3 10.6 3.5 12C5.6 15.9 8.6 17.8 12 17.8C13 17.8 13.9 17.6 14.8 17.2" {...s} />
        </svg>
      );

    case "edit":
      return (
        <svg {...svgProps}>
          <path d="M14.5 5.5L18.5 9.5L8.5 19.5H4.5V15.5L14.5 5.5Z" {...s} fill="currentColor" fillOpacity="0.09" />
          <circle cx="18.2" cy="5.8" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "delete":
      return (
        <svg {...svgProps}>
          <path d="M5.5 7.5H18.5M9 7.5V5.5C9 4.8 9.6 4.2 10.3 4.2H13.7C14.4 4.2 15 4.8 15 5.5V7.5M7 7.5L7.8 18.5C7.9 19.3 8.5 20 9.3 20H14.7C15.5 20 16.1 19.3 16.2 18.5L17 7.5" {...s} />
        </svg>
      );

    case "login":
      return (
        <svg {...svgProps}>
          <path d="M14 5H17.5C18.6 5 19.5 5.9 19.5 7V17C19.5 18.1 18.6 19 17.5 19H14" {...s} />
          <path d="M4.5 12H14.5M11 8.5L14.8 12L11 15.5" {...s} />
          <circle cx="4.8" cy="12" r="1.5" fill={ACCENT} />
        </svg>
      );

    case "logout":
      return (
        <svg {...svgProps}>
          <path d="M10 5H6.5C5.4 5 4.5 5.9 4.5 7V17C4.5 18.1 5.4 19 6.5 19H10" {...s} />
          <path d="M19.5 12H9.5M16 8.5L19.8 12L16 15.5" {...s} />
        </svg>
      );

    case "call":
    case "phone":
      return (
        <svg {...svgProps}>
          <path d="M6.8 4.8H9.8L11.2 8.4L9.2 9.8C10.3 12 12 13.7 14.2 14.8L15.6 12.8L19.2 14.2V17.2C19.2 18.3 18.3 19.2 17.2 19.2C10.4 18.8 5.2 13.6 4.8 6.8C4.8 5.7 5.7 4.8 6.8 4.8Z" {...s} fill="currentColor" fillOpacity="0.09" />
          <circle cx="17.8" cy="6.5" r="1.7" fill={ACCENT} />
        </svg>
      );

    case "mail":
    case "email":
    case "send":
      return (
        <svg {...svgProps}>
          <rect x="4" y="6" width="16" height="12" rx="2.8" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M5 7.5L12 12.5L19 7.5" {...s} />
          <circle cx="18.2" cy="6.2" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "school":
    case "graduation":
      return (
        <svg {...svgProps}>
          <path d="M12 5L20 9L12 13L4 9L12 5Z" {...s} fill="currentColor" fillOpacity="0.1" />
          <path d="M7.5 11.5V16C7.5 17.5 9.5 18.8 12 18.8C14.5 18.8 16.5 17.5 16.5 16V11.5" {...s} />
          <circle cx="19.2" cy="14" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "settings":
    case "engineering":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="3" {...s} fill="currentColor" fillOpacity="0.1" />
          <path d="M12 4.5V6.2M12 17.8V19.5M4.5 12H6.2M17.8 12H19.5M6.7 6.7L7.9 7.9M16.1 16.1L17.3 17.3M17.3 6.7L16.1 7.9M7.9 16.1L6.7 17.3" {...s} />
          <circle cx="18.2" cy="5.8" r="1.6" fill={ACCENT} />
        </svg>
      );

    case "female":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="9" r="4.5" {...s} fill="currentColor" fillOpacity="0.09" />
          <path d="M12 13.5V20M9.2 17.2H14.8" {...s} />
          <circle cx="17.2" cy="5.8" r="1.5" fill={ACCENT} />
        </svg>
      );

    case "sports":
    case "reduce_capacity":
    case "straighten":
    case "translate":
    case "layers":
    default:
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="7.5" {...s} fill="currentColor" fillOpacity="0.08" />
          <path d="M9.5 12H14.5" {...s} />
          <circle cx="17.8" cy="6.2" r="1.8" fill={ACCENT} />
        </svg>
      );
  }
}
