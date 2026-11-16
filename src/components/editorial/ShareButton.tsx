"use client";

import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { resolveShareUrl, triggerNativeShare } from "@/lib/shareContent";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  label?: string;
  ariaLabel?: string;
  variant?: "pill" | "icon";
  className?: string;
}

/**
 * Universal Share Button using the device's native OS Share Sheet (`navigator.share`)
 * whenever supported, with an accessible multi-platform Share Sheet fallback modal.
 */
export function ShareButton({
  title,
  text,
  url,
  label = "مشاركة",
  ariaLabel,
  variant = "pill",
  className,
}: ShareButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = resolveShareUrl(url);
  const shareBody = `${title}\n${text}`.trim();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await triggerNativeShare({ title, text, url: shareUrl });
    if (res.status === "fallback") {
      setFallbackOpen(true);
    }
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const targets = [
    {
      id: "whatsapp",
      labelAr: "واتساب",
      bg: "bg-[#15803D] text-white",
      href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${shareUrl}`)}`,
    },
    {
      id: "telegram",
      labelAr: "تيليجرام",
      bg: "bg-[#0088CC] text-white",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
    },
    {
      id: "facebook",
      labelAr: "فيسبوك",
      bg: "bg-[#1877F2] text-white",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: "x",
      labelAr: "X (تويتر)",
      bg: "bg-[#0F172A] text-white",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareBody.slice(0, 140))}`,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel || label}
        className={
          className ||
          (variant === "icon"
            ? "w-9 h-9 rounded-full bg-white/95 text-[#0B1C2E] border border-[#E2E8F0] hover:bg-[#EAF4F8] flex items-center justify-center shadow transition cursor-pointer"
            : "inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] border border-[#E2E8F0] text-xs font-bold shadow-sm transition cursor-pointer")
        }
      >
        <Icon name="share" className={variant === "icon" ? "text-[16px]" : "text-[15px] text-[#1D6E7D]"} />
        {variant === "pill" && <span>{label}</span>}
      </button>

      {fallbackOpen && (
        <div
          className="fixed inset-0 z-[100] bg-[#0B1C2E]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setFallbackOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="خيارات المشاركة"
        >
          <div
            dir="rtl"
            className="w-full max-w-md bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl p-5 flex flex-col gap-4 animate-captenly-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center">
                  <Icon name="share" className="text-[18px]" />
                </span>
                <div>
                  <h3 className="font-black text-sm text-[#0B1C2E]">مشاركة عبر</h3>
                  <p className="text-[11px] text-[#64748B] line-clamp-1">{title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFallbackOpen(false)}
                aria-label="إغلاق نافذة المشاركة"
                className="w-8 h-8 rounded-full bg-[#F7F9FA] text-[#64748B] hover:text-[#0B1C2E] flex items-center justify-center cursor-pointer"
              >
                <Icon name="close" className="text-[17px]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {targets.map((t) => (
                <a
                  key={t.id}
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setFallbackOpen(false)}
                  className={`py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition ${t.bg}`}
                >
                  <span>{t.labelAr}</span>
                  <Icon name="open_in_new" className="text-[14px]" />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-2">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={shareUrl}
                className="flex-1 bg-transparent px-2 text-[11px] font-mono text-[#475569] outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white text-[11px] font-bold shrink-0 transition cursor-pointer"
              >
                {copied ? "تم النسخ ✓" : "نسخ الرابط"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
