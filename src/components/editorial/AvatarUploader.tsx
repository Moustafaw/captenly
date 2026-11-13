"use client";

import React, { useEffect, useRef, useState } from "react";
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
 * Renders the zoomed & panned image into a 320x320 square JPEG data URL
 * so avatars remain crisp and lightweight in localStorage & Supabase.
 */
async function renderCroppedAvatarDataUrl(
  imgSrc: string,
  zoom: number,
  offsetX: number,
  offsetY: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("img_failed"));
    img.onload = () => {
      const canvasSize = 320;
      const previewSize = 240;
      const canvas = document.createElement("canvas");
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas_failed"));

      const baseScale = Math.max(canvasSize / img.width, canvasSize / img.height);
      const effectiveScale = baseScale * zoom;
      const drawW = img.width * effectiveScale;
      const drawH = img.height * effectiveScale;
      const ratio = canvasSize / previewSize;

      const centerX = canvasSize / 2 + offsetX * ratio;
      const centerY = canvasSize / 2 + offsetY * ratio;

      ctx.fillStyle = "#141A1C";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = imgSrc;
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

  // Interactive cropper state
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 320, h: 320 });
  const [zoom, setZoom] = useState<number>(1.05);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const activeUrl = initialUrl !== undefined ? initialUrl : currentPersona.avatarUrl;
  const boxClass = size === "lg" ? "w-20 h-20" : "w-14 h-14";

  useEffect(() => {
    if (!rawImageSrc) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setRawImageSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawImageSrc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("يرجى اختيار ملف صورة (JPG / PNG / WebP).");
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        setNaturalSize({ w: probe.width || 320, h: probe.height || 320 });
        setZoom(1.05);
        setOffset({ x: 0, y: 0 });
        setRawImageSrc(src);
      };
      probe.onerror = () => setErrorMsg("تعذر قراءة ملف الصورة.");
      probe.src = src;
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleApplyCrop = async () => {
    if (!rawImageSrc) return;
    setBusy(true);
    try {
      const dataUrl = await renderCroppedAvatarDataUrl(rawImageSrc, zoom, offset.x, offset.y);
      if (onLocalSelect) {
        onLocalSelect(dataUrl);
      } else {
        updateCurrentPersonaAvatar(dataUrl);
      }
      setRawImageSrc(null);
    } catch {
      setErrorMsg("تعذر قص وحفظ الصورة، جرب صورة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const previewSize = 240;
  const baseScale = Math.max(previewSize / naturalSize.w, previewSize / naturalSize.h);
  const previewW = naturalSize.w * baseScale * zoom;
  const previewH = naturalSize.h * baseScale * zoom;

  return (
    <>
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
          {busy ? "جاري الحفظ..." : labelAr}
        </button>

        {errorMsg && <span className="text-[10px] text-status-danger font-bold">{errorMsg}</span>}
      </div>

      {rawImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-surface-card rounded-3xl p-6 shadow-2xl border border-surface-container flex flex-col gap-4 text-dark-slate">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-card-title text-dark-slate">ضبط وتكبير الصورة الشخصية</h3>
                <p className="text-[11px] text-text-muted">
                  اسحب الصورة لتحديد الإطار واستخدم شريط التكبير/التصغير
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRawImageSrc(null)}
                className="w-8 h-8 rounded-full bg-surface-snow text-text-muted hover:text-dark-slate flex items-center justify-center"
                aria-label="إغلاق"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <div className="flex justify-center">
              <div
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  dragRef.current = {
                    active: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: offset.x,
                    origY: offset.y,
                  };
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.startX;
                  const dy = e.clientY - dragRef.current.startY;
                  setOffset({
                    x: Math.max(-140, Math.min(140, dragRef.current.origX + dx)),
                    y: Math.max(-140, Math.min(140, dragRef.current.origY + dy)),
                  });
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                }}
                onPointerCancel={() => {
                  dragRef.current.active = false;
                }}
                style={{ width: previewSize, height: previewSize }}
                className="relative rounded-2xl overflow-hidden bg-dark-slate border-2 border-deep-olive cursor-grab active:cursor-grabbing select-none touch-none"
              >
                <img
                  src={rawImageSrc}
                  alt="معاينة الصورة"
                  draggable={false}
                  style={{
                    width: previewW,
                    height: previewH,
                    maxWidth: "none",
                    maxHeight: "none",
                    position: "absolute",
                    left: previewSize / 2 + offset.x - previewW / 2,
                    top: previewSize / 2 + offset.y - previewH / 2,
                  }}
                />
                {/* Circular avatar guide */}
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-electric-volt/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-surface-snow rounded-2xl px-4 py-2.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.15).toFixed(2))))}
                className="w-8 h-8 rounded-full bg-surface-card text-dark-slate border border-surface-container flex items-center justify-center font-bold"
                aria-label="تصغير"
              >
                -
              </button>
              <input
                type="range"
                min={0.85}
                max={2.6}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-deep-olive"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.15).toFixed(2))))}
                className="w-8 h-8 rounded-full bg-surface-card text-dark-slate border border-surface-container flex items-center justify-center font-bold"
                aria-label="تكبير"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setZoom(1.05);
                  setOffset({ x: 0, y: 0 });
                }}
                className="px-4 py-2.5 rounded-full bg-surface-snow text-text-muted hover:text-dark-slate text-xs font-bold"
              >
                إعادة ضبط
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleApplyCrop}
                className="flex-1 py-2.5 rounded-full bg-dark-slate text-electric-volt font-card-title-sm text-sm hover:opacity-95"
              >
                {busy ? "جاري الحفظ..." : "اعتماد وحفظ الصورة ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
