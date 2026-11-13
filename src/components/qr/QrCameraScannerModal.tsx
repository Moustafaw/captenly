"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import type { SessionLedger } from "@/types/captenly";

interface QrCameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onMemberDetectedForEnroll?: (payload: { memberCode: string; athleteNameAr?: string }) => void;
  onLedgerCheckedIn?: (ledgerId: string, messageAr: string) => void;
}

type ParsedQrResult =
  | { kind: "ledger_qr"; ledgerCode: string; pinCode: string }
  | { kind: "member_qr"; memberCode: string }
  | { kind: "unknown"; raw: string };

function parseCaptenlyQr(raw: string): ParsedQrResult {
  const clean = raw.trim();
  if (clean.toUpperCase().startsWith("CAP-QR:")) {
    const parts = clean.split(":");
    return {
      kind: "ledger_qr",
      ledgerCode: (parts[1] || "").trim().toUpperCase(),
      pinCode: (parts[2] || "").trim(),
    };
  }
  if (clean.toUpperCase().startsWith("CAP-MEMBER:")) {
    return {
      kind: "member_qr",
      memberCode: clean.slice("CAP-MEMBER:".length).trim().toUpperCase(),
    };
  }
  if (/^CAP-[MCF]-\d{3,6}$/i.test(clean)) {
    return { kind: "member_qr", memberCode: clean.toUpperCase() };
  }
  return { kind: "unknown", raw: clean };
}

export function QrCameraScannerModal({
  open,
  onClose,
  onMemberDetectedForEnroll,
  onLedgerCheckedIn,
}: QrCameraScannerModalProps) {
  const { sessionLedgers, checkInSession, lookupRemoteLedgersOrProfile } = useCaptenly();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyHandlingRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [scanStatus, setScanStatus] = useState<{
    type: "idle" | "loading" | "success" | "needs_enroll" | "error";
    titleAr: string;
    detailAr?: string;
    matchedLedger?: SessionLedger;
    memberCode?: string;
    memberNameAr?: string;
  }>({ type: "idle", titleAr: "" });

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const handleDecodedPayload = useCallback(
    async (rawText: string) => {
      if (busyHandlingRef.current) return;
      busyHandlingRef.current = true;
      setScanStatus({ type: "loading", titleAr: "جاري التحقق ومزامنة البيانات..." });

      try {
        const parsed = parseCaptenlyQr(rawText);

        if (parsed.kind === "ledger_qr") {
          let targetLedger = sessionLedgers.find(
            (l) => l.ledgerCode.toUpperCase() === parsed.ledgerCode
          );

          if (!targetLedger && parsed.ledgerCode) {
            const remote = await lookupRemoteLedgersOrProfile({
              ledgerCode: parsed.ledgerCode,
            });
            targetLedger = remote.ledgers[0];
          }

          if (!targetLedger) {
            setScanStatus({
              type: "error",
              titleAr: "دفتر الحصص غير موجود",
              detailAr: `لم يتم العثور على الدفتر ${parsed.ledgerCode} محلياً أو على الخادم.`,
            });
            return;
          }

          const res = checkInSession(
            targetLedger.id,
            parsed.pinCode || targetLedger.pinCode,
            "qr_scan",
            "تم المسح المباشر بكاميرا QR"
          );

          if (res.ok) {
            stopCamera();
            setScanStatus({
              type: "success",
              titleAr: `تم مسح باركود ${targetLedger.athleteNameAr} ✓`,
              detailAr: res.messageAr,
              matchedLedger: targetLedger,
            });
            onLedgerCheckedIn?.(targetLedger.id, res.messageAr);
          } else {
            setScanStatus({
              type: "error",
              titleAr: "تعذر خصم الحصة",
              detailAr: res.messageAr,
            });
          }
          return;
        }

        if (parsed.kind === "member_qr") {
          const code = parsed.memberCode;
          const remote = await lookupRemoteLedgersOrProfile({ memberCode: code });
          const allMatched = remote.ledgers.length > 0
            ? remote.ledgers
            : sessionLedgers.filter(
                (l) => (l.memberCode || "").toUpperCase() === code
              );
          const activeLedger = allMatched.find((l) => l.status !== "completed") || allMatched[0];

          if (activeLedger) {
            const res = checkInSession(
              activeLedger.id,
              activeLedger.pinCode,
              "qr_scan",
              "حضور بمسح كود العضوية QR"
            );
            if (res.ok) {
              stopCamera();
              setScanStatus({
                type: "success",
                titleAr: `حضور مؤكد: ${activeLedger.athleteNameAr}`,
                detailAr: res.messageAr,
                matchedLedger: activeLedger,
              });
              onLedgerCheckedIn?.(activeLedger.id, res.messageAr);
              return;
            }
          }

          stopCamera();
          setScanStatus({
            type: "needs_enroll",
            titleAr: `تمت قراءة كود العضوية: ${code}`,
            detailAr: remote.profile?.fullNameAr
              ? `العضو: ${remote.profile.fullNameAr} (${remote.profile.city}) — لم تُفعّل له باقة بعد.`
              : "هذا السباح ليس لديه باقة نشطة بعد. يمكنك تفعيل باقة له مباشرة الآن.",
            memberCode: code,
            memberNameAr: remote.profile?.fullNameAr,
          });
          return;
        }

        setScanStatus({
          type: "error",
          titleAr: "كود QR غير معروف",
          detailAr: `القيمة المقروءة (${parsed.raw}) لا تخص كابتنلي.`,
        });
      } finally {
        setTimeout(() => {
          busyHandlingRef.current = false;
        }, 700);
      }
    },
    [sessionLedgers, checkInSession, lookupRemoteLedgersOrProfile, stopCamera, onLedgerCheckedIn]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanStatus({ type: "idle", titleAr: "" });
      setCameraError(null);
      return;
    }

    let cancelled = false;
    setCameraError(null);

    const startCamera = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("المتصفح الحالي لا يدعم الوصول المباشر للكاميرا؛ يمكنك رفع صورة QR أو إدخال الكود يدوياً.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setCameraReady(true);
        }

        const scanLoop = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA && !busyHandlingRef.current) {
            const w = video.videoWidth || 640;
            const h = video.videoHeight || 480;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              const decoded = jsQR(imgData.data, w, h, { inversionAttempts: "dontInvert" });
              if (decoded?.data) {
                handleDecodedPayload(decoded.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanLoop);
        };

        rafRef.current = requestAnimationFrame(scanLoop);
      } catch {
        if (!cancelled) {
          setCameraError(
            "تعذر فتح الكاميرا (تأكد من السماح بصلاحية الكاميرا للموقع) — يمكنك رفع صورة الـ QR أو كتابة الكود بالأسفل."
          );
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera, handleDecodedPayload]);

  const handleImageFileScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const decoded = jsQR(imgData.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        if (decoded?.data) {
          handleDecodedPayload(decoded.data);
        } else {
          setScanStatus({
            type: "error",
            titleAr: "لم يتم اكتشاف باركود QR واضح في الصورة",
            detailAr: "تأكد من وضوح الـ QR وقربه داخل الإطار.",
          });
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-deep-carbon/75 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-3xl bg-surface-card border border-surface-container shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-slate text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-electric-volt text-dark-slate flex items-center justify-center">
              <Icon name="qr_code_scanner" className="text-[22px]" />
            </div>
            <div>
              <h3 className="font-card-title text-sm sm:text-base">ماسح QR لحضور السباحين</h3>
              <p className="text-[11px] text-white/75">
                وجّه الكاميرا نحو باركود السباح لخصم الحصة أو تفعيل باقته فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            aria-label="إغلاق الماسح"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
          {/* Camera Viewfinder */}
          {scanStatus.type !== "success" && scanStatus.type !== "needs_enroll" && (
            <div className="relative rounded-2xl overflow-hidden bg-dark-slate aspect-[4/3] w-full flex items-center justify-center border border-surface-container">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraError && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-2xl border-2 border-electric-volt shadow-[0_0_0_9999px_rgba(15,23,26,0.45)] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-electric-volt/85 animate-pulse" />
                  </div>
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 bg-dark-slate/85 text-white flex flex-col items-center justify-center gap-2 text-xs font-bold">
                  <span className="w-7 h-7 rounded-full border-2 border-electric-volt border-t-transparent animate-spin" />
                  <span>جاري تشغيل الكاميرا الخلفية...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 bg-dark-slate/95 text-white p-6 flex flex-col items-center justify-center text-center gap-3">
                  <Icon name="no_photography" className="text-[36px] text-electric-volt" />
                  <p className="text-xs leading-relaxed text-white/90">{cameraError}</p>
                </div>
              )}
            </div>
          )}

          {/* Scan Status Box */}
          {scanStatus.type === "loading" && (
            <div className="rounded-2xl bg-surface-snow p-4 text-xs font-bold text-dark-slate flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full border-2 border-deep-olive border-t-transparent animate-spin" />
              <span>{scanStatus.titleAr}</span>
            </div>
          )}

          {scanStatus.type === "success" && (
            <div className="rounded-2xl bg-lime-tint/60 border border-deep-olive/30 p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-deep-olive text-white flex items-center justify-center">
                <Icon name="check_circle" className="text-[28px]" />
              </div>
              <div className="font-card-title text-base text-dark-slate">{scanStatus.titleAr}</div>
              {scanStatus.detailAr && (
                <p className="text-xs font-bold text-deep-olive leading-relaxed">{scanStatus.detailAr}</p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
              >
                تم — إغلاق ✓
              </button>
            </div>
          )}

          {scanStatus.type === "needs_enroll" && scanStatus.memberCode && (
            <div className="rounded-2xl bg-surface-snow border border-deep-olive/25 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-deep-olive font-bold text-sm">
                <Icon name="person_add" className="text-[20px]" />
                <span>{scanStatus.titleAr}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{scanStatus.detailAr}</p>
              <button
                type="button"
                onClick={() => {
                  onMemberDetectedForEnroll?.({
                    memberCode: scanStatus.memberCode!,
                    athleteNameAr: scanStatus.memberNameAr,
                  });
                  onClose();
                }}
                className="w-full py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
              >
                تعبئة كود العضوية ({scanStatus.memberCode}) وتفعيل باقة الآن ←
              </button>
            </div>
          )}

          {scanStatus.type === "error" && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-red-900 flex flex-col gap-1">
              <span className="text-xs font-extrabold">{scanStatus.titleAr}</span>
              {scanStatus.detailAr && <span className="text-[11px]">{scanStatus.detailAr}</span>}
            </div>
          )}

          {/* Upload QR Photo + Manual Fallback */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-4 rounded-xl bg-surface-snow hover:bg-lime-tint/50 border border-surface-container text-xs font-bold text-dark-slate flex items-center justify-center gap-1.5"
            >
              <Icon name="image_search" className="text-[17px] text-deep-olive" />
              <span>مسح من صورة باركود محفوظة</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileScan}
              className="hidden"
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualInput.trim()) return;
                handleDecodedPayload(manualInput.trim());
              }}
              className="flex gap-1.5"
            >
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="أو اكتب CAP-M-XXXX..."
                className="flex-1 min-w-0 rounded-xl bg-surface-snow px-3 py-2 text-xs font-mono border border-surface-container outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-dark-slate text-electric-volt text-xs font-bold shrink-0"
              >
                تحقق
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
