"use client";

import React from "react";
import {
  ContactChannelKind,
  ResolvedContactChannel,
  resolveEntityContactChannels,
} from "@/lib/contactChannels";

export function SocialChannelGlyph({
  kind,
  className = "w-4 h-4",
}: {
  kind: ContactChannelKind;
  className?: string;
}) {
  switch (kind) {
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91A9.91 9.91 0 0 0 12.04 2Zm5.77 14.08c-.24.68-1.42 1.3-1.97 1.38-.52.08-1.18.11-1.9-.12-.44-.14-1-.33-1.72-.64-3.03-1.31-5.01-4.37-5.16-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.27-.3.6-.38.8-.38h.57c.18 0 .43-.07.67.51.24.59.83 2.02.9 2.17.07.15.12.33.02.53-.1.2-.15.33-.3.51-.15.18-.32.4-.45.53-.15.15-.31.31-.13.62.18.3.79 1.3 1.7 2.11 1.17 1.04 2.16 1.37 2.46 1.52.3.15.48.13.66-.08.18-.2.76-.88.96-1.18.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.34.08.12.08.7-.16 1.38Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M13.5 22v-8.8h2.95l.44-3.43H13.5V7.58c0-.99.28-1.67 1.7-1.67h1.82V2.84c-.31-.04-1.4-.14-2.66-.14-2.63 0-4.44 1.6-4.44 4.56v2.51H7v3.43h2.92V22h3.58Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case "threads":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M19 12a7 7 0 1 0-2.6 5.45" />
          <path d="M15.5 11.5c0-2.2-1.4-3.5-3.5-3.5-1.9 0-3.3 1.2-3.5 3 .2 2.4 1.7 3.8 3.9 3.8 1.6 0 2.9-.8 3.1-2.5V8.8c0 2.5 1.1 4.2 3 4.2 1.2 0 1.8-.9 1.8-2.2" />
        </svg>
      );
  }
}

interface ContactChannelsBarProps {
  supplyStatus?: "verified_active" | "self_listed_pending" | "seeded_unclaimed";
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  onWhatsappClick?: () => void;
  compact?: boolean;
  fullWidthPrimary?: boolean;
}

export function ContactChannelsBar({
  supplyStatus,
  whatsappNumber,
  facebookUrl,
  instagramUrl,
  onWhatsappClick,
  compact = false,
  fullWidthPrimary = false,
}: ContactChannelsBarProps) {
  const { primary, secondary, hasAny } = resolveEntityContactChannels({
    supplyStatus,
    whatsappNumber,
    facebookUrl,
    instagramUrl,
  });

  if (!hasAny || !primary) return null;

  const renderPrimary = (channel: ResolvedContactChannel) => {
    const sizeCls = compact
      ? "px-3.5 py-2 text-[12px] gap-1.5"
      : "px-4 py-2.5 text-[12.5px] gap-2";
    const widthCls = fullWidthPrimary ? "flex-1 justify-center" : "";

    if (channel.kind === "whatsapp" && onWhatsappClick) {
      return (
        <button
          type="button"
          onClick={onWhatsappClick}
          className={`inline-flex items-center ${sizeCls} ${widthCls} rounded-full ${channel.buttonBgClass} font-badge-label hover:opacity-90 transition-opacity shadow-sm cursor-pointer`}
        >
          <SocialChannelGlyph kind="whatsapp" className="w-4 h-4 shrink-0" />
          <span>{compact ? channel.shortLabelAr : channel.labelAr}</span>
        </button>
      );
    }

    return (
      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center ${sizeCls} ${widthCls} rounded-full ${channel.buttonBgClass} font-badge-label hover:opacity-90 transition-opacity shadow-sm`}
      >
        <SocialChannelGlyph kind={channel.kind} className="w-4 h-4 shrink-0" />
        <span>{compact ? channel.shortLabelAr : channel.labelAr}</span>
      </a>
    );
  };

  return (
    <div className={`flex items-center gap-1.5 ${fullWidthPrimary ? "flex-1" : ""}`}>
      {renderPrimary(primary)}

      {secondary.map((ch) =>
        ch.kind === "whatsapp" && onWhatsappClick ? (
          <button
            key={ch.kind}
            type="button"
            onClick={onWhatsappClick}
            title={ch.labelAr}
            aria-label={ch.labelAr}
            className="w-9 h-9 rounded-full bg-surface-card border border-surface-container hover:scale-105 text-dark-slate flex items-center justify-center transition-transform shadow-sm shrink-0"
          >
            <SocialChannelGlyph kind={ch.kind} className="w-4 h-4" />
          </button>
        ) : (
          <a
            key={ch.kind}
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            title={ch.labelAr}
            aria-label={ch.labelAr}
            className={`w-9 h-9 rounded-full ${ch.buttonBgClass} hover:scale-105 flex items-center justify-center transition-transform shadow-sm shrink-0`}
          >
            <SocialChannelGlyph kind={ch.kind} className="w-4 h-4" />
          </a>
        )
      )}
    </div>
  );
}
