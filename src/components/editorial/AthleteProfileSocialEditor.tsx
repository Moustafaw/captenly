"use client";

import React, { useState } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { SocialChannelGlyph } from "@/components/editorial/ContactChannelsBar";
import { normalizeSocialUrl } from "@/lib/contactChannels";
import { Icon } from "@/components/Icon";

export function ProfileSocialPillsRow() {
  const { currentPersona } = useCaptenly();
  const links = currentPersona.socialLinks;
  if (!links) return null;

  const entries: { key: "facebook" | "instagram" | "x" | "threads"; label: string; url?: string }[] = [
    { key: "facebook", label: "Facebook", url: normalizeSocialUrl(links.facebook, "facebook") },
    { key: "instagram", label: "Instagram", url: normalizeSocialUrl(links.instagram, "instagram") },
    { key: "x", label: "X", url: normalizeSocialUrl(links.x, "x") },
    { key: "threads", label: "Threads", url: normalizeSocialUrl(links.threads, "threads") },
  ];

  const active = entries.filter((item) => Boolean(item.url));
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {active.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-electric-volt hover:text-dark-slate text-surface-card text-xs font-bold transition-colors"
        >
          <SocialChannelGlyph kind={item.key} className="w-3.5 h-3.5" />
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
}

export function AthleteProfileSocialEditor({ compact = false }: { compact?: boolean }) {
  const { currentPersona, updateCurrentPersonaProfile } = useCaptenly();
  const [bio, setBio] = useState(currentPersona.bioAr || "");
  const [facebook, setFacebook] = useState(currentPersona.socialLinks?.facebook || "");
  const [instagram, setInstagram] = useState(currentPersona.socialLinks?.instagram || "");
  const [xHandle, setXHandle] = useState(currentPersona.socialLinks?.x || "");
  const [threads, setThreads] = useState(currentPersona.socialLinks?.threads || "");
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentPersonaProfile({
      bioAr: bio.trim(),
      socialLinks: {
        facebook: normalizeSocialUrl(facebook, "facebook") || "",
        instagram: normalizeSocialUrl(instagram, "instagram") || "",
        x: normalizeSocialUrl(xHandle, "x") || "",
        threads: normalizeSocialUrl(threads, "threads") || "",
      },
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <form
      onSubmit={handleSave}
      className={`bg-surface-card rounded-2xl ${
        compact ? "p-4" : "p-6"
      } shadow-sm border border-surface-container flex flex-col gap-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-card-title text-dark-slate flex items-center gap-2">
            <Icon name="edit_note" className="text-[20px] text-deep-olive" />
            <span>النبذة التعريفية (Bio) وحسابات التواصل</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            تظهر هذه الروابط في بطاقة حسابك لتسهيل التعارف داخل مجتمع السباحة
          </p>
        </div>
        {savedNotice && (
          <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
            تم الحفظ ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-dark-slate">النبذة التعريفية (Bio)</label>
        <textarea
          rows={2}
          maxLength={220}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="سبّاح حرة وفراشة 50م • المحلة الكبرى • أسعى لتحسين رقمي إلى تحت 31 ثانية"
          className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
            <SocialChannelGlyph kind="facebook" className="w-3.5 h-3.5 text-[#1877F2]" />
            <span>Facebook</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/username"
            className="rounded-xl bg-surface-snow px-3.5 py-2 text-xs outline-none border border-surface-container focus:border-deep-olive text-right"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
            <SocialChannelGlyph kind="instagram" className="w-3.5 h-3.5 text-[#E1306C]" />
            <span>Instagram</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/username"
            className="rounded-xl bg-surface-snow px-3.5 py-2 text-xs outline-none border border-surface-container focus:border-deep-olive text-right"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
            <SocialChannelGlyph kind="x" className="w-3.5 h-3.5 text-dark-slate" />
            <span>X (Twitter)</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
            placeholder="https://x.com/username"
            className="rounded-xl bg-surface-snow px-3.5 py-2 text-xs outline-none border border-surface-container focus:border-deep-olive text-right"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
            <SocialChannelGlyph kind="threads" className="w-3.5 h-3.5 text-dark-slate" />
            <span>Threads</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={threads}
            onChange={(e) => setThreads(e.target.value)}
            placeholder="https://threads.net/@username"
            className="rounded-xl bg-surface-snow px-3.5 py-2 text-xs outline-none border border-surface-container focus:border-deep-olive text-right"
          />
        </label>
      </div>

      <button
        type="submit"
        className="self-start px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs hover:opacity-95 transition-opacity"
      >
        حفظ النبذة وروابط التواصل ✓
      </button>
    </form>
  );
}
