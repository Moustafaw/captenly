"use client";

import React, { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

interface AvatarUploaderProps {
  size?: "md" | "lg";
  initialUrl?: string;
  onLocalSelect?: (dataUrl: string) => void;
  labelAr?: string;
  darkSurface?: boolean;
}

/**
 * Compresses an uploaded image to max 320x320 JPEG data URL client-side
 * so it persists safely in localStorage and stays drop-in ready for Supabase Storage.
 */
async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img_failed"));
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas_failed"));

        // Center-crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUploader({
  size = "lg",
  initialUrl,
  onLocalSelect,
  labelAr = "رفع أو تغيير الصورة",
  darkSurface = false,
}: AvatarUploaderProps) {
  const { currentPersona, updateCurrentPersonaAvatar } = useCaptenly();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeUrl = initialUrl !== undefined ? initialUrl : currentPersona.avatarUrl;
  const boxClass = size === "lg" ? "w-20 h-20" : "w-14 h-14";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("يرجى اختيار ملف صورة (JPG / PNG / WebP).");
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (onLocalSelect) {
        onLocalSelect(dataUrl);
      } else {
        updateCurrentPersonaAvatar(dataUrl);
      }
    } catch {
      setErrorMsg("تعذر معالجة الصورة، جرب صورة أخرى.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative group">
        <div
          className={`${boxClass} rounded-full overflow-hidden bg-surface-container-high border-2 border-electric-volt flex items-center justify-center shadow-sm`}
        >
          {activeUrl ? (
            <img
              src={activeUrl}
              alt={currentPersona.fullNameAr}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Icon name="person" className="text-deep-olive text-[32px]" />
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={labelAr}
          aria-label={labelAr}
          className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-dark-slate text-electric-volt border-2 border-white flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer"
        >
          <Icon name={busy ? "sync" : "photo_camera"} className="text-[15px]" />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`text-[11px] font-bold hover:underline ${
          darkSurface ? "text-electric-volt" : "text-deep-olive"
        }`}
      >
        {busy ? "جاري الضغط..." : labelAr}
      </button>

      {errorMsg && <span className="text-[10px] text-status-danger font-bold">{errorMsg}</span>}
    </div>
  );
}
