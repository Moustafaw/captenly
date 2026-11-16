"use client";

import React, { useEffect, useState } from "react";
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] border border-[#0F172A]/8 text-xs font-bold transition-colors"
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

  useEffect(() => {
    setBio(currentPersona.bioAr || "");
    setFacebook(currentPersona.socialLinks?.facebook || "");
    setInstagram(currentPersona.socialLinks?.instagram || "");
    setXHandle(currentPersona.socialLinks?.x || "");
    setThreads(currentPersona.socialLinks?.threads || "");
  }, [currentPersona.id, currentPersona.bioAr, currentPersona.socialLinks]);

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
      className={`bg-white rounded-[24px] ${
        compact ? "p-4" : "p-6"
      } shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-4`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-card-title text-[#0F172A] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center shrink-0">
              <Icon name="edit_note" className="text-[18px]" />
            </span>
            <span>النبذة التعريفية (Bio) وحسابات التواصل</span>
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            تظهر هذه الروابط في بطاقة حسابك لتسهيل التعارف داخل مجتمع السباحة
          </p>
        </div>
        {savedNotice && (
          <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 text-xs font-bold">
            تم الحفظ ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[#0F172A]">النبذة التعريفية (Bio)</label>
        <textarea
          rows={3}
          maxLength={220}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="سبّاح حرة وفراشة 50م • أسعى لتحسين رقمي إلى تحت 31 ثانية"
          className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] focus:bg-white transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <SocialChannelGlyph kind="facebook" className="w-3.5 h-3.5 text-[#1877F2]" />
            <span>Facebook</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/username"
            className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] focus:bg-white text-left transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <SocialChannelGlyph kind="instagram" className="w-3.5 h-3.5 text-[#E1306C]" />
            <span>Instagram</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/username"
            className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] focus:bg-white text-left transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <SocialChannelGlyph kind="x" className="w-3.5 h-3.5 text-[#0F172A]" />
            <span>X (Twitter)</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
            placeholder="https://x.com/username"
            className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] focus:bg-white text-left transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
            <SocialChannelGlyph kind="threads" className="w-3.5 h-3.5 text-[#0F172A]" />
            <span>Threads</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={threads}
            onChange={(e) => setThreads(e.target.value)}
            placeholder="https://threads.net/@username"
            className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] focus:bg-white text-left transition-colors"
          />
        </label>
      </div>

      <button
        type="submit"
        className="self-start px-6 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-badge-label text-xs shadow-sm transition-colors"
      >
        حفظ النبذة وروابط التواصل ✓
      </button>
    </form>
  );
}
