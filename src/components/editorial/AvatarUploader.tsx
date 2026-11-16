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

const RECOMMENDED_AVATAR_PX = 400;
const MIN_RECOMMENDED_PX = 200;

/**
 * Renders the zoomed & panned image into a 400x400 square JPEG data URL
 * so avatars remain crisp on Retina displays while staying compact for Supabase.
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
      const canvasSize = RECOMMENDED_AVATAR_PX;
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
      resolve(canvas.toDataURL("image/jpeg", 0.88));
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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive cropper state
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({
    w: RECOMMENDED_AVATAR_PX,
    h: RECOMMENDED_AVATAR_PX,
  });
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
      if (ev.key === "Escape" && !busy) setRawImageSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawImageSrc, busy]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("يرجى اختيار ملف صورة (JPG / PNG / WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("الحد الأقصى لحجم الصورة 5 ميجابايت.");
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        setNaturalSize({
          w: probe.width || RECOMMENDED_AVATAR_PX,
          h: probe.height || RECOMMENDED_AVATAR_PX,
        });
        setZoom(1.05);
        setOffset({ x: 0, y: 0 });
        setUploadProgress(0);
        setUploadStatusText("");
        setRawImageSrc(src);
      };
      probe.onerror = () => setErrorMsg("تعذر قراءة ملف الصورة.");
      probe.src = src;
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleApplyCrop = async () => {
    if (!rawImageSrc || busy) return;
    setBusy(true);
    setUploadProgress(18);
    setUploadStatusText("جاري معالجة الأبعاد (400×400 بكسل)...");
    const startedAt = Date.now();

    try {
      const dataUrl = await renderCroppedAvatarDataUrl(rawImageSrc, zoom, offset.x, offset.y);
      setUploadProgress(56);
      setUploadStatusText("جاري رفع الصورة وتحديث الملف الشخصي...");

      // Ensure smooth, visible 1.2s–1.6s upload progress indicator as requested
      await new Promise((r) => setTimeout(r, 480));
      setUploadProgress(86);

      if (onLocalSelect) {
        onLocalSelect(dataUrl);
      } else {
        updateCurrentPersonaAvatar(dataUrl);
      }

      const elapsed = Date.now() - startedAt;
      const remainingMs = Math.max(250, 1450 - elapsed);
      await new Promise((r) => setTimeout(r, remainingMs));

      setUploadProgress(100);
      setUploadStatusText("تم رفع وحفظ الصورة بنجاح ✓");

      await new Promise((r) => setTimeout(r, 250));
      setRawImageSrc(null);
      setUploadProgress(0);
      setUploadStatusText("");
    } catch {
      setErrorMsg("تعذر قص وحفظ الصورة، جرب صورة أخرى.");
      setUploadProgress(0);
      setUploadStatusText("");
    } finally {
      setBusy(false);
    }
  };

  const previewSize = 240;
  const baseScale = Math.max(previewSize / naturalSize.w, previewSize / naturalSize.h);
  const previewW = naturalSize.w * baseScale * zoom;
  const previewH = naturalSize.h * baseScale * zoom;
  const isSmallResolution = naturalSize.w < MIN_RECOMMENDED_PX || naturalSize.h < MIN_RECOMMENDED_PX;

  return (
    <>
      <div className="inline-flex flex-col items-center gap-1.5 shrink-0">
        <div className="relative group">
          <div
            className={`${boxClass} rounded-full overflow-hidden bg-[#EAF4F8] border-2 border-[#1D6E7D] flex items-center justify-center shadow-sm`}
          >
            {activeUrl ? (
              <img
                src={activeUrl}
                alt={currentPersona.fullNameAr}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon name="person" className="text-[#1D6E7D] text-[32px]" />
            )}
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title={labelAr}
            aria-label={labelAr}
            className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white border-2 border-white flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer"
          >
            <Icon name={busy ? "sync" : "photo_camera"} className={`text-[15px] ${busy ? "animate-spin" : ""}`} />
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
          disabled={busy}
          className={`text-[11px] font-bold hover:underline ${
            darkSurface ? "text-white" : "text-[#1D6E7D]"
          }`}
        >
          {busy ? "جاري الرفع..." : labelAr}
        </button>

        <span
          className={`text-[10px] leading-tight text-center ${
            darkSurface ? "text-white/75" : "text-[#64748B]"
          }`}
        >
          المقاس الموصى به: 400×400 بكسل (1:1)
        </span>

        {errorMsg && <span className="text-[10px] text-[#DC2626] font-bold">{errorMsg}</span>}
      </div>

      {rawImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/75 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#0F172A]/10 flex flex-col gap-4 text-[#0F172A]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-card-title text-[#0F172A]">ضبط وتكبير الصورة الشخصية</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  المقاس الموصى به: <strong className="text-[#0F172A]">400×400 بكسل</strong> (مربعة 1:1 — حد أقصى 5 ميجابايت)
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRawImageSrc(null)}
                className="w-8 h-8 rounded-full bg-[#F7F9FA] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center disabled:opacity-40"
                aria-label="إغلاق"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <div
              className={`rounded-xl px-3 py-2 text-[11px] font-bold flex items-center justify-between ${
                isSmallResolution
                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                  : "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20"
              }`}
            >
              <span>
                أبعاد صورتك الحالية: {naturalSize.w}×{naturalSize.h} بكسل
              </span>
              <span>
                {isSmallResolution ? "يفضل صورة بدقة أكبر (≥ 200px)" : "دقة ممتازة ✓ سيتم القص 400×400"}
              </span>
            </div>

            <div className="flex justify-center">
              <div
                onPointerDown={(e) => {
                  if (busy) return;
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
                  if (!dragRef.current.active || busy) return;
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
                className="relative rounded-2xl overflow-hidden bg-[#0F172A] border-2 border-[#1D6E7D] cursor-grab active:cursor-grabbing select-none touch-none"
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
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#38BDF8]/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />

                {busy && (
                  <div className="absolute inset-0 bg-[#0F172A]/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-4">
                    <div className="w-11 h-11 rounded-full border-[3px] border-white/25 border-t-[#38BDF8] animate-spin" />
                    <span className="text-xs font-extrabold text-[#38BDF8]">
                      {uploadProgress}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {busy || uploadProgress > 0 ? (
              <div className="rounded-2xl bg-[#F7F9FA] p-3.5 border border-[#0F172A]/8 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-[#1D6E7D] border-t-transparent animate-spin inline-block" />
                    <span>{uploadStatusText}</span>
                  </span>
                  <span className="font-mono text-[#1D6E7D]">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1D6E7D] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-[#F7F9FA] border border-[#0F172A]/8 rounded-2xl px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.15).toFixed(2))))}
                  className="w-8 h-8 rounded-full bg-white text-[#0F172A] border border-[#0F172A]/10 flex items-center justify-center font-bold"
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
                  className="flex-1 accent-[#1D6E7D]"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.15).toFixed(2))))}
                  className="w-8 h-8 rounded-full bg-white text-[#0F172A] border border-[#0F172A]/10 flex items-center justify-center font-bold"
                  aria-label="تكبير"
                >
                  +
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setZoom(1.05);
                  setOffset({ x: 0, y: 0 });
                }}
                className="px-4 py-2.5 rounded-full bg-[#F7F9FA] text-[#64748B] hover:text-[#0F172A] border border-[#0F172A]/10 text-xs font-bold disabled:opacity-40"
              >
                إعادة ضبط
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleApplyCrop}
                className="flex-1 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm text-sm disabled:opacity-70 flex items-center justify-center gap-2 transition-colors"
              >
                {busy && (
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{busy ? "جاري رفع وحفظ الصورة..." : "اعتماد وحفظ الصورة ✓"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
