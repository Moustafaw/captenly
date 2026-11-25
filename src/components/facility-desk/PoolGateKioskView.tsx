"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { parseCaptenlyQr } from "@/lib/qrPayload";
import {
  loadOfflineShiftSnapshot,
  saveOfflineShiftSnapshot,
  type OfflineShiftSnapshot,
} from "@/lib/offlineShiftDb";
import {
  evaluateLedgerGateStatus,
  getFacilityPoolDeskConfig,
  isSameLocalCalendarDay,
} from "@/lib/poolDeskPricing";
import type {
  Facility,
  FacilityLinkedEntity,
  OfflineCheckinQueueItem,
  SessionLedger,
} from "@/types/captenly";

interface PoolGateKioskViewProps {
  facility: Facility;
  ledgers: SessionLedger[];
  facilityLinks: FacilityLinkedEntity[];
  offlineQueue: OfflineCheckinQueueItem[];
  operatorNameAr: string;
  onCheckInByCode: (
    codeInput: string,
    facilityId?: string,
    coachNoteAr?: string,
    coachId?: string,
    options?: {
      overrideDuplicate3h?: boolean;
      scanSource?: "gate_kiosk" | "dashboard_manual" | "coach_poolside" | "system_url_qr";
      allowedLinkedEntityId?: string;
    }
  ) => {
    ok: boolean;
    expired?: boolean;
    duplicateBlocked?: boolean;
    ledger?: SessionLedger;
    messageAr: string;
  };
  onSyncOffline: () => number;
  onMarkShiftPrepped?: (timestampIso: string) => void;
}

type GateResultBanner = {
  tone: "emerald" | "amber" | "rose" | "info";
  titleAr: string;
  messageAr: string;
  ledger?: SessionLedger;
  subscriptionCodeTried?: string;
  duplicateBlocked?: boolean;
  expired?: boolean;
  scannedAtTimeAr?: string;
};

function formatEgyptWaPhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20") && digits.length >= 11) return digits;
  if (digits.startsWith("01") && digits.length === 11) return `2${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `20${digits}`;
  return digits.length >= 10 ? digits : null;
}

function playFeedbackTone(tone: "emerald" | "amber" | "rose") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = tone === "emerald" ? 880 : tone === "amber" ? 620 : 290;
    osc.type = tone === "rose" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + (tone === "emerald" ? 0.14 : 0.24));
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    // ignore WebAudio denial
  }
}

/**
 * Screen 1: كشك البوابة الميداني (Pool Gate QR Scanner Kiosk).
 */
export function PoolGateKioskView({
  facility,
  ledgers,
  facilityLinks,
  offlineQueue,
  operatorNameAr,
  onCheckInByCode,
  onSyncOffline,
  onMarkShiftPrepped,
}: PoolGateKioskViewProps) {
  const poolConfig = useMemo(() => getFacilityPoolDeskConfig(facility), [facility]);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [shiftSnapshot, setShiftSnapshot] = useState<OfflineShiftSnapshot | null>(null);
  const [prepFeedbackAr, setPrepFeedbackAr] = useState<string | null>(null);
  const [syncFeedbackAr, setSyncFeedbackAr] = useState<string | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraErrorAr, setCameraErrorAr] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Manual entry & group filter state
  const [manualQuery, setManualQuery] = useState("");
  const [gateNoteDraft, setGateNoteDraft] = useState("بوابة الدخول — مسح ميداني");
  const [groupFilterId, setGroupFilterId] = useState<string>("all");
  const [resultBanner, setResultBanner] = useState<GateResultBanner | null>(null);
  const [candidateLedgers, setCandidateLedgers] = useState<SessionLedger[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodedRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsQrRef = useRef<typeof import("jsqr")["default"] | null>(null);

  const loadJsQr = useCallback(async () => {
    if (jsQrRef.current) return jsQrRef.current;
    const mod = await import("jsqr");
    const fn = (mod.default ?? mod) as typeof import("jsqr")["default"];
    jsQrRef.current = fn;
    return fn;
  }, []);

  // Network listeners + Offline shift snapshot load on mount
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    loadOfflineShiftSnapshot(facility.id).then((snap) => {
      if (snap) setShiftSnapshot(snap);
    });
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [facility.id]);

  // Combine live ledgers with IndexedDB snapshot ledgers so gate works reliably offline
  const effectiveLedgers = useMemo(() => {
    if (ledgers.length > 0) return ledgers;
    return shiftSnapshot?.ledgers || [];
  }, [ledgers, shiftSnapshot]);

  const activeLedgers = useMemo(() => {
    const base = effectiveLedgers.filter((l) => l.status !== "completed" && !l.isCodeExpired);
    if (groupFilterId === "all") return base;
    if (groupFilterId === "direct") {
      return base.filter((l) => !l.linkedEntityId);
    }
    return base.filter((l) => l.linkedEntityId === groupFilterId);
  }, [effectiveLedgers, groupFilterId]);

  const quickSearchMatches = useMemo(() => {
    const q = manualQuery.trim().toLowerCase();
    if (!q || q.startsWith("sub-") || q.startsWith("cap-sub-")) return [];
    return effectiveLedgers
      .filter(
        (l) =>
          l.athleteNameAr.toLowerCase().includes(q) ||
          (l.subscriptionCode || "").toLowerCase().includes(q) ||
          (l.memberCode || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [effectiveLedgers, manualQuery]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const executeSubscriptionScan = useCallback(
    (subCode: string, overrideDuplicate3h = false) => {
      const normalizedCode = subCode.trim().toUpperCase();
      if (!normalizedCode) return;

      const res = onCheckInByCode(
        normalizedCode,
        facility.id,
        gateNoteDraft.trim() || "دخول من بوابة المنشأة",
        undefined,
        {
          overrideDuplicate3h,
          scanSource: "gate_kiosk",
        }
      );

      const nowTimeAr = new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (res.ok && res.ledger) {
        const remainingAfter = Math.max(
          0,
          res.ledger.totalSessions - res.ledger.completedSessions
        );
        const isLastOrDone = remainingAfter <= 1 || res.ledger.status === "renewal_due";
        const tone = isLastOrDone ? "amber" : "emerald";
        playFeedbackTone(tone);
        setCandidateLedgers([]);
        setResultBanner({
          tone,
          titleAr:
            remainingAfter === 0
              ? "تمت الحصة الأخيرة في الباقة — مطلوب تجديد"
              : isLastOrDone
                ? "تم التسجيل (متبقي حصة واحدة — تنبيه تجديد)"
                : "دخول مسموح — تم خصم الحصة بنجاح",
          messageAr: res.messageAr,
          ledger: res.ledger,
          subscriptionCodeTried: normalizedCode,
          scannedAtTimeAr: nowTimeAr,
        });
        return;
      }

      playFeedbackTone("rose");
      setResultBanner({
        tone: "rose",
        titleAr: res.duplicateBlocked
          ? "تنبيه تكرار المسح (حماية 3 ساعات)"
          : res.expired
            ? "رصيد الحصص منتهي — يتطلب تجديد"
            : "تعذر إتمام تسجيل الدخول",
        messageAr: res.messageAr,
        ledger: res.ledger,
        subscriptionCodeTried: normalizedCode,
        duplicateBlocked: Boolean(res.duplicateBlocked),
        expired: Boolean(res.expired),
        scannedAtTimeAr: nowTimeAr,
      });
    },
    [facility.id, gateNoteDraft, onCheckInByCode]
  );

  const handleDecodedPayload = useCallback(
    (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const parsed = parseCaptenlyQr(trimmed);

      if (parsed.kind === "subscription_qr" && parsed.subscriptionCode) {
        executeSubscriptionScan(parsed.subscriptionCode);
        return;
      }

      if (parsed.kind === "ledger_qr" && parsed.ledgerCode) {
        executeSubscriptionScan(parsed.ledgerCode);
        return;
      }

      const subRegex = trimmed.toUpperCase().match(/(?:CAP-)?SUB-[A-Z0-9-]+/);
      if (subRegex?.[0]) {
        executeSubscriptionScan(subRegex[0]);
        return;
      }

      const memCode =
        (parsed.kind === "member_qr" ? parsed.memberCode : undefined) ||
        trimmed.toUpperCase().match(/(?:CAP-(?:M|JR|C|F)|MEM)-[A-Z0-9-]+/)?.[0];
      if (memCode) {
        const matches = effectiveLedgers.filter(
          (l) => (l.memberCode || "").toUpperCase() === memCode.toUpperCase()
        );
        if (matches.length === 1) {
          executeSubscriptionScan(matches[0].subscriptionCode || matches[0].ledgerCode);
          return;
        }
        if (matches.length > 1) {
          setCandidateLedgers(matches);
          setResultBanner({
            tone: "info",
            titleAr: `تم التعرف على العضو (${memCode}) — اختر الباقة المطلوبة`,
            messageAr: "يوجد أكثر من سباح أو اشتراك مسجل لهذا الكود. اختر الباقة لإتمام المسح.",
          });
          return;
        }
      }

      playFeedbackTone("rose");
      setResultBanner({
        tone: "rose",
        titleAr: "رمز QR غير مطابق لاشتراكات هذه المنشأة",
        messageAr: `النص المقروء (${trimmed.slice(0, 42)}) لا يحتوي على كود اشتراك SUB-XXXX أو CAP-SUB-XXXX أو كود عضو صالح داخل منشأتك.`,
      });
    },
    [effectiveLedgers, executeSubscriptionScan]
  );

  const scanVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const jsQR = jsQrRef.current;
        const code = jsQR
          ? jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            })
          : null;
        if (code?.data) {
          const now = Date.now();
          if (
            code.data !== lastDecodedRef.current.value ||
            now - lastDecodedRef.current.at > 2200
          ) {
            lastDecodedRef.current = { value: code.data, at: now };
            handleDecodedPayload(code.data);
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(scanVideoFrame);
  }, [handleDecodedPayload]);

  const startCamera = useCallback(
    async (requestedMode: "environment" | "user" = facingMode) => {
      stopCamera();
      setCameraErrorAr(null);
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraErrorAr("المتصفح الحالي لا يدعم تشغيل الكاميرا مباشرة — استخدم البحث السريع أو رفع صورة QR.");
        return;
      }

      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: requestedMode } },
            audio: false,
          }),
          loadJsQr(),
        ]);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchSupported(Boolean(caps?.torch));
        setCameraActive(true);
        rafRef.current = requestAnimationFrame(scanVideoFrame);
      } catch {
        setCameraErrorAr("لم نتمكن من فتح الكاميرا (تحقق من صلاحية الكاميرا في المتصفح أو أغلق تطبيقات الكاميرا الأخرى).");
        stopCamera();
      }
    },
    [facingMode, loadJsQr, scanVideoFrame, stopCamera]
  );

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // torch constraint not supported on device
    }
  };

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = imgUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const jsQR = await loadJsQr();
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);
      if (decoded?.data) {
        handleDecodedPayload(decoded.data);
      } else {
        setResultBanner({
          tone: "rose",
          titleAr: "لم يتم قراءة كود QR من الصورة",
          messageAr: "تأكد من وضوح الكود داخل الصورة أو استخدم البحث بالكود اليدوي SUB-XXXX.",
        });
      }
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  };

  const handlePrepOfflineShift = async () => {
    const nowIso = new Date().toISOString();
    const snapshot: OfflineShiftSnapshot = {
      facilityId: facility.id,
      facilityNameAr: facility.nameAr,
      preparedAtIso: nowIso,
      preparedByAr: operatorNameAr,
      waterFeePerSessionEgp: poolConfig.waterFeePerSessionEgp,
      poolDeskConfig: poolConfig,
      ledgers: effectiveLedgers,
      totalActiveCount: activeLedgers.length,
    };
    const res = await saveOfflineShiftSnapshot(snapshot);
    setShiftSnapshot(snapshot);
    if (res.ok) {
      onMarkShiftPrepped?.(nowIso);
      setPrepFeedbackAr(
        `تم تجهيز الشيفت أوفلاين بنجاح (${snapshot.totalActiveCount} مشترك نشط في ${
          res.storage === "indexeddb" ? "IndexedDB" : "التخزين المحلي"
        }).`
      );
    } else {
      setPrepFeedbackAr("تعذر حفظ نسخة الشيفت محلياً على هذا المتصفح.");
    }
  };

  // Telemetry stats for today's shift
  const shiftMetrics = useMemo(() => {
    let todayScans = 0;
    let renewalDue = 0;
    const recentScans: {
      id: string;
      athleteNameAr: string;
      subCode: string;
      scannedAtTimeAr: string;
      scannerAr: string;
      sessionNumber: number;
      totalSessions: number;
      wasOffline?: boolean;
    }[] = [];

    for (const l of effectiveLedgers) {
      if (l.status === "renewal_due" || l.totalSessions - l.completedSessions <= 1) {
        renewalDue += 1;
      }
      for (const c of l.checkins) {
        if (isSameLocalCalendarDay(c.scannedAtIso)) {
          todayScans += 1;
          recentScans.push({
            id: `${l.id}-${c.sessionNumber}-${c.scannedAtIso || c.dateAr}`,
            athleteNameAr: l.athleteNameAr,
            subCode: l.subscriptionCode || l.ledgerCode,
            scannedAtTimeAr: c.dateAr,
            scannerAr: c.scannedByNameAr || operatorNameAr,
            sessionNumber: c.sessionNumber,
            totalSessions: l.totalSessions,
            wasOffline: c.wasOffline,
          });
        }
      }
    }

    return {
      todayScans,
      activeCount: activeLedgers.length,
      renewalDue,
      recentScans: recentScans.reverse().slice(0, 8),
    };
  }, [effectiveLedgers, activeLedgers.length, operatorNameAr]);

  const approvedGroups = useMemo(
    () => facilityLinks.filter((l) => l.status === "approved"),
    [facilityLinks]
  );

  const bannerLedgerEval = useMemo(() => {
    if (!resultBanner?.ledger) return null;
    return evaluateLedgerGateStatus(resultBanner.ledger);
  }, [resultBanner]);

  const waRenewalHref = useMemo(() => {
    const ledger = resultBanner?.ledger;
    if (!ledger) return null;
    const rawPhone = (ledger as SessionLedger & { parentPhone?: string }).parentPhone;
    const phone = formatEgyptWaPhone(rawPhone);
    const msg = encodeURIComponent(
      `أهلاً بولي أمر البطل/ة ${ledger.athleteNameAr} — تنبيه من ${facility.nameAr}: تم استخدام الحصة (${ledger.completedSessions}/${ledger.totalSessions}) في كود الاشتراك ${ledger.subscriptionCode || ledger.ledgerCode}. يُرجى تجديد الباقة قبل الحصة القادمة لضمان استمرار الدخول.`
    );
    return phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
  }, [resultBanner, facility.nameAr]);

  return (
    <div data-testid="pool-gate-kiosk" className="min-h-screen bg-[#F7F9FA] pb-24" dir="rtl">
      {/* Luxury Deep Ocean Gate Header */}
      <section className="bg-[#0F4C5C] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-7 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href="/dashboard/facility"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-full bg-white/10 hover:bg-white/20 text-[#EAF4F8] font-bold transition-all"
                >
                  <Icon name="arrow_forward" size={14} />
                  عودة للوحة المنشأة
                </Link>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black ${
                    isOnline
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-300/30"
                      : "bg-amber-500/20 text-amber-100 border border-amber-300/30"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? "bg-emerald-400" : "bg-amber-300 animate-pulse"
                    }`}
                  />
                  {isOnline ? "متصل بالسحابة — مزامنة لحظية" : "وضع البوابة أوفلاين (IndexedDB)"}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white">
                كشك البوابة الميداني QR — {facility.nameAr}
              </h1>
              <p className="text-xs text-[#EAF4F8]/85">
                المشغّل الحالي: <strong>{operatorNameAr}</strong> • محرك فحص فوري لحصص المياه +
                حماية التكرار (3 ساعات) + عمل بدون إنترنت.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handlePrepOfflineShift}
                className="inline-flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-white text-[#0F4C5C] font-black text-xs hover:bg-[#EAF4F8] transition-all cursor-pointer shadow-soft-luxury"
              >
                <Icon name="offline_pin" size={18} />
                تجهيز شيفت اليوم (أوفلاين)
              </button>

              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const synced = onSyncOffline();
                    setSyncFeedbackAr(`تمت مزامنة ${synced} عملية حضور مسجلة أثناء انقطاع الشبكة.`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-amber-400 text-[#0F4C5C] font-black text-xs hover:bg-amber-300 transition-all cursor-pointer"
                >
                  <Icon name="cloud_sync" size={17} />
                  مزامنة ({offlineQueue.length}) عملية معلّقة
                </button>
              )}
            </div>
          </div>

          {/* Shift Telemetry Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5">
              <div className="text-[11px] text-[#EAF4F8]/80">مسحات البوابة اليوم</div>
              <div className="text-xl font-black tabular-nums mt-0.5">{shiftMetrics.todayScans}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5">
              <div className="text-[11px] text-[#EAF4F8]/80">اشتراكات نشطة جاهزة</div>
              <div className="text-xl font-black tabular-nums mt-0.5">{shiftMetrics.activeCount}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5">
              <div className="text-[11px] text-[#EAF4F8]/80">قارب على التجديد</div>
              <div className="text-xl font-black tabular-nums mt-0.5 text-amber-200">
                {shiftMetrics.renewalDue}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5">
              <div className="text-[11px] text-[#EAF4F8]/80">حالة نسخة الشيفت أوفلاين</div>
              <div className="text-xs font-black mt-1.5 text-emerald-200">
                {shiftSnapshot
                  ? `جاهزة (${shiftSnapshot.totalActiveCount} مشترك)`
                  : poolConfig.lastShiftPreppedAtIso
                    ? "محضّرة سابقاً"
                    : "اضغط تجهيز الشيفت"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-6">
        {(prepFeedbackAr || syncFeedbackAr) && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-black text-emerald-800 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Icon name="check_circle" size={17} />
              {prepFeedbackAr || syncFeedbackAr}
            </span>
            <button
              type="button"
              onClick={() => {
                setPrepFeedbackAr(null);
                setSyncFeedbackAr(null);
              }}
              className="min-h-[48px] px-3 inline-flex items-center text-emerald-700 hover:underline cursor-pointer"
            >
              إخفاء
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT/RIGHT MAIN: Live Camera + Manual Entry */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-3xl bg-white border border-sand-border p-4 md:p-6 shadow-soft-luxury space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base md:text-lg font-black text-[#0F4C5C]">
                    منظار المسح السريع لباركود السباح (QR)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    وجّه الكاميرا على كارت حقيبة السباح أو هاتفه، أو ابحث بالاسم / الكود.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="inline-flex items-center gap-1.5 px-4 py-3 min-h-[48px] rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer"
                    >
                      <Icon name="videocam" size={16} />
                      تشغيل الكاميرا
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const next = facingMode === "environment" ? "user" : "environment";
                          setFacingMode(next);
                          startCamera(next);
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-3 min-h-[48px] rounded-xl bg-[#EAF4F8] text-[#0F4C5C] text-xs font-bold cursor-pointer"
                      >
                        <Icon name="flip_camera_ios" size={15} />
                        قلب الكاميرا
                      </button>
                      {torchSupported && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`inline-flex items-center gap-1 px-3.5 py-3 min-h-[48px] rounded-xl text-xs font-bold cursor-pointer ${
                            torchOn
                              ? "bg-amber-400 text-[#0F4C5C]"
                              : "bg-[#F7F9FA] text-ink-deep"
                          }`}
                        >
                          <Icon name={torchOn ? "flash_on" : "flash_off"} size={15} />
                          فلاش
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1 px-3.5 py-3 min-h-[48px] rounded-xl bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                      >
                        <Icon name="videocam_off" size={15} />
                        إيقاف
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-3.5 py-3 min-h-[48px] rounded-xl border border-sand-border bg-[#F7F9FA] text-ink-deep text-xs font-bold hover:border-[#1D6E7D] cursor-pointer"
                  >
                    <Icon name="upload_file" size={15} />
                    قراءة من صورة
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Camera Viewport Frame */}
              <div className="relative rounded-2xl overflow-hidden bg-[#0a2f3a] aspect-[16/10] flex items-center justify-center border border-[#1D6E7D]/40">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-3xl border-2 border-[#EAF4F8]/80 shadow-[0_0_0_9999px_rgba(10,47,58,0.45)] relative">
                      <span className="absolute -top-6 right-0 left-0 text-center text-[11px] font-bold text-[#EAF4F8]">
                        ضع كود QR داخل الإطار ليتم الخصم تلقائياً
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3 text-white">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center">
                      <Icon name="qr_code_scanner" size={30} />
                    </div>
                    <p className="text-sm font-black">الكاميرا في وضع الاستعداد</p>
                    <p className="text-xs text-[#EAF4F8]/80 max-w-sm mx-auto">
                      {cameraErrorAr ||
                        "اضغط «تشغيل الكاميرا» لقراءة كارت الحقيبة أو الموبايل، أو أدخل كود SUB-XXXX مباشرة بالأسفل."}
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-5 py-3 min-h-[48px] rounded-xl bg-white text-[#0F4C5C] text-xs font-black hover:bg-[#EAF4F8] cursor-pointer"
                    >
                      تشغيل كاميرا البوابة الآن
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Keypad & Fast Search */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualQuery.trim()) return;
                  handleDecodedPayload(manualQuery);
                }}
                className="rounded-2xl bg-[#F7F9FA] border border-sand-border p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="اكتب كود الاشتراك (SUB-...) أو اسم السباح / كود العضو..."
                    className="flex-1 rounded-xl border border-sand-border bg-white px-4 py-3 text-sm font-bold"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 min-h-[48px] rounded-xl bg-[#1D6E7D] text-white text-xs font-black hover:bg-[#0F4C5C] cursor-pointer shrink-0"
                  >
                    فحص وتسجيل دخول
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between text-xs">
                  <input
                    type="text"
                    value={gateNoteDraft}
                    onChange={(e) => setGateNoteDraft(e.target.value)}
                    placeholder="ملاحظة تسجيل البوابة (مثال: بوابة رقم 1 - وردية المساء)"
                    className="flex-1 rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                  <select
                    aria-label="تصفية حسب الأكاديمية أو المدرسة"
                    value={groupFilterId}
                    onChange={(e) => setGroupFilterId(e.target.value)}
                    className="rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="all">كل الأكاديميات ومدارس النادي</option>
                    <option value="direct">مدارس النادي المباشرة فقط</option>
                    {approvedGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.displayNameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {quickSearchMatches.length > 0 && (
                  <div className="pt-2 border-t border-sand-border/80 space-y-1.5">
                    <div className="text-[11px] font-bold text-ink-muted">
                      نتائج بحث سريعة — اضغط لتسجيل الدخول فوراً:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {quickSearchMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => executeSubscriptionScan(m.subscriptionCode || m.ledgerCode)}
                          className="text-right min-h-[48px] rounded-xl bg-white border border-sand-border hover:border-[#1D6E7D] p-2.5 flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-black text-[#0F4C5C]">
                              {m.athleteNameAr}
                            </div>
                            <div className="text-[10px] text-ink-muted font-mono">
                              {m.subscriptionCode} • {m.linkedEntityNameAr || "مباشر"}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-[#EAF4F8] text-[#0F4C5C] text-[10px] font-black">
                            {m.completedSessions}/{m.totalSessions}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT/SIDE COLUMN: Result Decision Card + Recent Gate Log */}
          <div className="lg:col-span-5 space-y-5">
            {/* Multi-ledger member chooser if MEM-XXXX matched > 1 swimmer */}
            {candidateLedgers.length > 1 && (
              <div className="rounded-3xl bg-white border border-[#1D6E7D] p-5 space-y-3 shadow-soft-luxury">
                <div className="text-sm font-black text-[#0F4C5C]">
                  اختر السباح أو الباقة لإتمام المسح:
                </div>
                <div className="space-y-2">
                  {candidateLedgers.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => executeSubscriptionScan(l.subscriptionCode || l.ledgerCode)}
                      className="w-full min-h-[48px] rounded-2xl bg-[#F7F9FA] hover:bg-[#EAF4F8] border border-sand-border p-3 text-right flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-black text-ink-deep">{l.athleteNameAr}</div>
                        <div className="text-[11px] text-ink-muted font-mono">
                          {l.subscriptionCode} • {l.packageTitleAr}
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#0F4C5C]">
                        {l.completedSessions}/{l.totalSessions}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color-Coded Gate Verdict Result Card */}
            {resultBanner ? (
              <div
                className={`rounded-3xl border-2 p-5 space-y-4 shadow-soft-luxury ${
                  resultBanner.tone === "emerald"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-950"
                    : resultBanner.tone === "amber"
                      ? "bg-amber-50 border-amber-400 text-amber-950"
                      : resultBanner.tone === "rose"
                        ? "bg-rose-50 border-rose-400 text-rose-950"
                        : "bg-[#EAF4F8] border-[#1D6E7D] text-[#0F4C5C]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        resultBanner.tone === "emerald"
                          ? "bg-emerald-600 text-white"
                          : resultBanner.tone === "amber"
                            ? "bg-amber-500 text-white"
                            : resultBanner.tone === "rose"
                              ? "bg-rose-600 text-white"
                              : "bg-[#0F4C5C] text-white"
                      }`}
                    >
                      <Icon
                        name={
                          resultBanner.tone === "emerald"
                            ? "verified"
                            : resultBanner.tone === "amber"
                              ? "warning"
                              : "gpp_bad"
                        }
                        size={22}
                      />
                    </div>
                    <div>
                      <h3 className="font-black text-base">{resultBanner.titleAr}</h3>
                      <p className="text-xs opacity-90 mt-1 leading-relaxed">
                        {resultBanner.messageAr}
                      </p>
                    </div>
                  </div>
                  {resultBanner.scannedAtTimeAr && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/70">
                      {resultBanner.scannedAtTimeAr}
                    </span>
                  )}
                </div>

                {resultBanner.ledger && (
                  <div className="rounded-2xl bg-white/85 border border-black/5 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-black text-sm text-[#0F4C5C]">
                      <span>{resultBanner.ledger.athleteNameAr}</span>
                      <span dir="ltr" className="font-mono text-xs">
                        {resultBanner.ledger.subscriptionCode}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-ink-slate">
                      <span>الباقة: {resultBanner.ledger.packageTitleAr}</span>
                      <span>
                        الحصص: {resultBanner.ledger.completedSessions} من{" "}
                        {resultBanner.ledger.totalSessions}
                      </span>
                      {resultBanner.ledger.linkedEntityNameAr && (
                        <span>الجهة: {resultBanner.ledger.linkedEntityNameAr}</span>
                      )}
                    </div>
                    {bannerLedgerEval?.lastCheckin?.scannedByNameAr && (
                      <div className="text-[11px] text-ink-muted">
                        آخر قيد بواسطة: {bannerLedgerEval.lastCheckin.scannedByNameAr}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(resultBanner.tone === "amber" || resultBanner.expired) && waRenewalHref && (
                    <a
                      href={waRenewalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700"
                    >
                      <Icon name="chat" size={16} />
                      إرسال تنبيه تجديد لولي الأمر (واتساب)
                    </a>
                  )}

                  {resultBanner.duplicateBlocked && resultBanner.subscriptionCodeTried && (
                    <button
                      type="button"
                      onClick={() =>
                        executeSubscriptionScan(resultBanner.subscriptionCodeTried!, true)
                      }
                      className="flex-1 min-h-[48px] py-2.5 px-4 rounded-xl bg-rose-700 text-white text-xs font-black hover:bg-rose-800 cursor-pointer"
                    >
                      تسجيل استثنائي وتجاوز قفل الـ 3 ساعات
                    </button>
                  )}

                  {resultBanner.expired && (
                    <Link
                      href="/dashboard/facility?tab=subscribers"
                      className="min-h-[48px] inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D]"
                    >
                      <Icon name="autorenew" size={16} />
                      تجديد الاشتراك
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white border border-sand-border p-6 text-center space-y-2 shadow-soft-luxury">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EAF4F8] text-[#0F4C5C] flex items-center justify-center">
                  <Icon name="fact_check" size={24} />
                </div>
                <h3 className="text-sm font-black text-[#0F4C5C]">بانتظار أول مسح على البوابة</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  بمجرد مسح كود QR أو اختيار السباح من البحث السريع، ستظهر هنا حالة الدخول بالألوان
                  (أخضر / تنبيه تجديد أصفر / حماية تكرار أو انتهاء أحمر).
                </p>
              </div>
            )}

            {/* Today's Recent Scans Feed */}
            <div className="rounded-3xl bg-white border border-sand-border p-5 space-y-3 shadow-soft-luxury">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#0F4C5C]">أحدث مسحات بوابة اليوم</h3>
                <Link
                  href="/dashboard/facility?tab=ops"
                  className="inline-flex items-center min-h-[48px] px-3 text-[11px] font-bold text-[#1D6E7D] hover:underline"
                >
                  سجل الرقابة الكامل ←
                </Link>
              </div>

              {shiftMetrics.recentScans.length === 0 ? (
                <div className="rounded-2xl bg-[#F7F9FA] p-4 text-center text-xs text-ink-muted">
                  لم تُسجل عمليات دخول اليوم حتى الآن.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pl-1">
                  {shiftMetrics.recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-[#F7F9FA] border border-sand-border/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-black text-ink-deep flex items-center gap-1.5">
                          {item.athleteNameAr}
                          {item.wasOffline && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              أوفلاين
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          <span className="font-mono">{item.subCode}</span> • {item.scannerAr}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-black text-[#0F4C5C] tabular-nums">
                          {item.sessionNumber} / {item.totalSessions}
                        </div>
                        <div className="text-[10px] text-ink-muted">{item.scannedAtTimeAr}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
