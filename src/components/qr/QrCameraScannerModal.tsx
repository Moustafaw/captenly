"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import type { SessionLedger } from "@/types/captenly";

interface QrCameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  scopeFacilityId?: string;
  scopeCoachId?: string;
  onMemberDetectedForEnroll?: (payload: { memberCode: string; athleteNameAr?: string }) => void;
  onLedgerCheckedIn?: (ledgerId: string, messageAr: string) => void;
}

type ParsedQrResult =
  | { kind: "subscription_qr"; subscriptionCode: string }
  | { kind: "ledger_qr"; ledgerCode: string; pinCode: string }
  | { kind: "member_qr"; memberCode: string }
  | { kind: "unknown"; raw: string };

function parseCaptenlyQr(raw: string): ParsedQrResult {
  const clean = raw.trim();
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try {
      const obj = JSON.parse(clean) as {
        subCode?: string;
        subscriptionCode?: string;
        code?: string;
        ledgerCode?: string;
        pinCode?: string;
      };
      if (obj.subCode || obj.subscriptionCode) {
        return {
          kind: "subscription_qr",
          subscriptionCode: String(obj.subCode || obj.subscriptionCode).trim().toUpperCase(),
        };
      }
      if (obj.ledgerCode) {
        return {
          kind: "ledger_qr",
          ledgerCode: String(obj.ledgerCode).trim().toUpperCase(),
          pinCode: String(obj.pinCode || "").trim(),
        };
      }
      if (obj.code) {
        const c = String(obj.code).trim().toUpperCase();
        if (c.startsWith("SUB-")) {
          return { kind: "subscription_qr", subscriptionCode: c };
        }
        return { kind: "member_qr", memberCode: c };
      }
    } catch {
      // fall through
    }
  }
  if (clean.toUpperCase().startsWith("CAP-SUB:")) {
    return {
      kind: "subscription_qr",
      subscriptionCode: clean.slice("CAP-SUB:".length).trim().toUpperCase(),
    };
  }
  if (/^SUB-[A-Z0-9-]{3,14}$/i.test(clean)) {
    return { kind: "subscription_qr", subscriptionCode: clean.toUpperCase() };
  }
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
  if (/^CAP-(M|JR|C|F)-[A-Z0-9-]+$/i.test(clean)) {
    return { kind: "member_qr", memberCode: clean.toUpperCase() };
  }
  return { kind: "unknown", raw: clean };
}

export function QrCameraScannerModal({
  open,
  onClose,
  scopeFacilityId,
  scopeCoachId,
  onMemberDetectedForEnroll,
  onLedgerCheckedIn,
}: QrCameraScannerModalProps) {
  const {
    currentPersona,
    activeStaffAssignment,
    sessionLedgers,
    checkInSession,
    checkInBySubscriptionCode,
    lookupRemoteLedgersOrProfile,
  } = useCaptenly();

  const effectiveFacilityId =
    scopeFacilityId ||
    activeStaffAssignment?.facilityId ||
    (currentPersona.role === "facility_manager" ? currentPersona.linkedFacilityId : undefined);
  const effectiveCoachId =
    scopeCoachId ||
    (currentPersona.role === "coach" ? currentPersona.linkedCoachId || currentPersona.id : undefined);

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

        if (parsed.kind === "subscription_qr") {
          const res = checkInBySubscriptionCode(
            parsed.subscriptionCode,
            effectiveFacilityId,
            "تم المسح المباشر لكود الاشتراك بالـ QR",
            effectiveCoachId
          );
          if (res.ok && res.ledger) {
            stopCamera();
            setScanStatus({
              type: "success",
              titleAr: `تم خصم حصة للسباح ${res.ledger.athleteNameAr} ✓`,
              detailAr: res.messageAr,
              matchedLedger: res.ledger,
            });
            onLedgerCheckedIn?.(res.ledger.id, res.messageAr);
          } else {
            setScanStatus({
              type: "error",
              titleAr: "كود الاشتراك منتهي الصلاحية أو غير صالح",
              detailAr: res.messageAr,
            });
          }
          return;
        }

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

          if (
            (effectiveFacilityId && targetLedger.facilityId !== effectiveFacilityId) ||
            (!effectiveFacilityId &&
              effectiveCoachId &&
              targetLedger.coachId !== effectiveCoachId)
          ) {
            setScanStatus({
              type: "error",
              titleAr: "هذا الدفتر يتبع منشأة أو كابتن آخر",
              detailAr: `الدفتر (${targetLedger.facilityNameAr}) خارج نطاق منشأتك أو متدربيك.`,
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
          if (!effectiveFacilityId && !effectiveCoachId) {
            setScanStatus({
              type: "error",
              titleAr: "النطاق الوظيفي غير محدد",
              detailAr: "يلزم فتح الماسح من لوحة منشأة أو كابتن مرتبط للتحقق من أكواد العضوية.",
            });
            return;
          }
          const code = parsed.memberCode;
          const remote = await lookupRemoteLedgersOrProfile({ memberCode: code });
          const rawMatched = remote.ledgers.length > 0
            ? remote.ledgers
            : sessionLedgers.filter(
                (l) => (l.memberCode || "").toUpperCase() === code
              );
          const allMatched = rawMatched.filter((l) => {
            if (effectiveFacilityId) return l.facilityId === effectiveFacilityId;
            if (effectiveCoachId) return l.coachId === effectiveCoachId;
            return false;
          });
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
    [
      sessionLedgers,
      checkInSession,
      checkInBySubscriptionCode,
      lookupRemoteLedgersOrProfile,
      effectiveFacilityId,
      effectiveCoachId,
      stopCamera,
      onLedgerCheckedIn,
    ]
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
      className="fixed inset-0 z-50 bg-[#0F172A]/75 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white border border-[#0F172A]/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#1D6E7D] text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center border border-white/20">
              <Icon name="qr_code_scanner" className="text-[22px]" />
            </div>
            <div>
              <h3 className="font-card-title text-sm sm:text-base text-white">ماسح QR لحضور السباحين</h3>
              <p className="text-[11px] text-white/80">
                وجّه الكاميرا نحو باركود السباح لخصم الحصة أو تفعيل باقته فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            aria-label="إغلاق الماسح"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
          {/* Camera Viewfinder */}
          {scanStatus.type !== "success" && scanStatus.type !== "needs_enroll" && (
            <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] aspect-[4/3] w-full flex items-center justify-center border border-[#0F172A]/10">
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
                  <div className="w-48 h-48 rounded-2xl border-2 border-[#38BDF8] shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-[#38BDF8]/90 animate-pulse" />
                  </div>
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 bg-[#0F172A]/85 text-white flex flex-col items-center justify-center gap-2 text-xs font-bold">
                  <span className="w-7 h-7 rounded-full border-2 border-[#38BDF8] border-t-transparent animate-spin" />
                  <span>جاري تشغيل الكاميرا الخلفية...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 bg-[#0F172A]/95 text-white p-6 flex flex-col items-center justify-center text-center gap-3">
                  <Icon name="no_photography" className="text-[36px] text-[#38BDF8]" />
                  <p className="text-xs leading-relaxed text-white/90">{cameraError}</p>
                </div>
              )}
            </div>
          )}

          {/* Scan Status Box */}
          {scanStatus.type === "loading" && (
            <div className="rounded-2xl bg-[#F7F9FA] p-4 text-xs font-bold text-[#0F172A] border border-[#0F172A]/8 flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full border-2 border-[#1D6E7D] border-t-transparent animate-spin" />
              <span>{scanStatus.titleAr}</span>
            </div>
          )}

          {scanStatus.type === "success" && (
            <div className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/25 p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1D6E7D] text-white flex items-center justify-center shadow-sm">
                <Icon name="check_circle" className="text-[28px]" />
              </div>
              <div className="font-card-title text-base text-[#0F172A]">{scanStatus.titleAr}</div>
              {scanStatus.detailAr && (
                <p className="text-xs font-bold text-[#1D6E7D] leading-relaxed">{scanStatus.detailAr}</p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
              >
                تم — إغلاق ✓
              </button>
            </div>
          )}

          {scanStatus.type === "needs_enroll" && scanStatus.memberCode && (
            <div className="rounded-2xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/25 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#1D6E7D] font-bold text-sm">
                <Icon name="person_add" className="text-[20px]" />
                <span>{scanStatus.titleAr}</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">{scanStatus.detailAr}</p>
              <button
                type="button"
                onClick={() => {
                  onMemberDetectedForEnroll?.({
                    memberCode: scanStatus.memberCode!,
                    athleteNameAr: scanStatus.memberNameAr,
                  });
                  onClose();
                }}
                className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
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
              className="py-2.5 px-4 rounded-xl bg-[#F7F9FA] hover:bg-[#EAF4F8] border border-[#0F172A]/10 text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Icon name="image_search" className="text-[17px] text-[#1D6E7D]" />
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
                placeholder="اكتب كود الاشتراك SUB-XXXX-XX أو CAP-M-XXXX..."
                className="flex-1 min-w-0 rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs font-mono border border-[#0F172A]/10 focus:border-[#1D6E7D] outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shrink-0 transition-colors"
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
