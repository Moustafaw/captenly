"use client";

import { useEffect, useRef } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { parseCaptenlyQr } from "@/lib/qrPayload";

interface UseLedgerUrlScanOptions {
  isAuthenticated: boolean;
  canScanAndEnroll: boolean;
  isFacility: boolean;
  isCoach: boolean;
  linkedFacilityId: string;
  linkedCoachId: string;
  onSelectLedger: (ledgerId: string) => void;
  onStatusMessage: (status: { ok: boolean; msg: string }) => void;
  onPrefillEnroll: (payload: { memberCode: string; athleteNameAr?: string }) => void;
}

/**
 * Automatically handles QR scans launched from the phone's system QR scanner
 * or Control Center (`/dashboard/ledger?qr=...`) as soon as auth & ledgers are ready.
 */
export function useLedgerUrlScan({
  isAuthenticated,
  canScanAndEnroll,
  isFacility,
  isCoach,
  linkedFacilityId,
  linkedCoachId,
  onSelectLedger,
  onStatusMessage,
  onPrefillEnroll,
}: UseLedgerUrlScanOptions) {
  const {
    sessionLedgers,
    checkInSession,
    checkInBySubscriptionCode,
    lookupRemoteLedgersOrProfile,
    effectiveOffline,
  } = useCaptenly();

  const processedQrRef = useRef<string | null>(null);
  const fetchedRemoteQrRef = useRef<string | null>(null);
  const remoteProfileCacheRef = useRef<Record<string, string | undefined>>({});
  const callbacksRef = useRef({ onSelectLedger, onStatusMessage, onPrefillEnroll });
  callbacksRef.current = { onSelectLedger, onStatusMessage, onPrefillEnroll };

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return;

    const params = new URLSearchParams(window.location.search);
    const rawQr = params.get("qr") || params.get("sub") || params.get("code");
    if (!rawQr || !rawQr.trim()) return;

    const cleanRaw = rawQr.trim();
    if (processedQrRef.current === cleanRaw) return;

    const parsed = parseCaptenlyQr(cleanRaw);
    if (parsed.kind === "unknown") return;

    const finalizeAndClearUrl = () => {
      processedQrRef.current = cleanRaw;
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("qr");
        nextUrl.searchParams.delete("sub");
        nextUrl.searchParams.delete("code");
        const cleanHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        window.history.replaceState(null, "", cleanHref || "/dashboard/ledger");
      } catch {
        // Ignore URL cleanup failures
      }
    };

    const run = async () => {
      // Athletes/parents scanning their own QR view their ledger safely without self-deduction
      if (!canScanAndEnroll) {
        finalizeAndClearUrl();
        callbacksRef.current.onStatusMessage({
          ok: true,
          msg: "تم فتح دفتر الحصص من الرمز — يتم خصم الحصة تلقائياً عند مسحه بهاتف الكابتن أو مسؤول المنشأة.",
        });
        return;
      }

      const facilityScope = isFacility ? linkedFacilityId : undefined;
      const coachScope = !facilityScope && isCoach ? linkedCoachId : undefined;

      if (parsed.kind === "subscription_qr") {
        const directRes = checkInBySubscriptionCode(
          parsed.subscriptionCode,
          facilityScope,
          "حضور مؤكد عبر مسح QR من كاميرا نظام الهاتف",
          coachScope
        );
        if (directRes.ok && directRes.ledger) {
          finalizeAndClearUrl();
          callbacksRef.current.onSelectLedger(directRes.ledger.id);
          callbacksRef.current.onStatusMessage({
            ok: true,
            msg: `مسح مباشر بالنظام: ${directRes.messageAr}`,
          });
          return;
        }

        // Wait for one remote ledger hydration round if not yet found locally and online
        if (
          !directRes.expired &&
          !effectiveOffline &&
          fetchedRemoteQrRef.current !== cleanRaw
        ) {
          fetchedRemoteQrRef.current = cleanRaw;
          const remote = await lookupRemoteLedgersOrProfile({
            facilityId: facilityScope,
            coachId: coachScope,
          });
          if (remote.ledgers.length > 0) {
            return; // Re-runs automatically once sessionLedgers state reflects merged ledgers
          }
        }

        finalizeAndClearUrl();
        if (directRes.ledger) callbacksRef.current.onSelectLedger(directRes.ledger.id);
        callbacksRef.current.onStatusMessage({ ok: false, msg: directRes.messageAr });
        return;
      }

      if (parsed.kind === "member_qr") {
        const localMatch = sessionLedgers.filter((l) => {
          if ((l.memberCode || "").toUpperCase() !== parsed.memberCode) return false;
          if (facilityScope) return l.facilityId === facilityScope;
          if (coachScope) return l.coachId === coachScope;
          return false;
        });

        if (
          localMatch.length === 0 &&
          !effectiveOffline &&
          fetchedRemoteQrRef.current !== cleanRaw
        ) {
          fetchedRemoteQrRef.current = cleanRaw;
          const remote = await lookupRemoteLedgersOrProfile({ memberCode: parsed.memberCode });
          remoteProfileCacheRef.current[parsed.memberCode] = remote.profile?.fullNameAr;
          if (remote.ledgers.length > 0) {
            return; // Wait for state merge re-render
          }
        }

        finalizeAndClearUrl();
        const activeTarget = localMatch.find((l) => l.status !== "completed") || localMatch[0];
        if (activeTarget) {
          const rCheck = checkInSession(
            activeTarget.id,
            activeTarget.pinCode,
            "qr_scan",
            "حضور بكود العضوية عبر مسح نظام الهاتف"
          );
          callbacksRef.current.onSelectLedger(activeTarget.id);
          callbacksRef.current.onStatusMessage({ ok: rCheck.ok, msg: rCheck.messageAr });
        } else {
          callbacksRef.current.onPrefillEnroll({
            memberCode: parsed.memberCode,
            athleteNameAr: remoteProfileCacheRef.current[parsed.memberCode],
          });
          callbacksRef.current.onStatusMessage({
            ok: true,
            msg: `تم مسح كود العضوية (${parsed.memberCode}) — أكمل تفعيل الباقة الأولى للسباح الآن.`,
          });
        }
        return;
      }

      if (parsed.kind === "ledger_qr") {
        const target = sessionLedgers.find(
          (l) => l.ledgerCode.toUpperCase() === parsed.ledgerCode
        );
        if (
          !target &&
          !effectiveOffline &&
          fetchedRemoteQrRef.current !== cleanRaw
        ) {
          fetchedRemoteQrRef.current = cleanRaw;
          const remote = await lookupRemoteLedgersOrProfile({ ledgerCode: parsed.ledgerCode });
          if (remote.ledgers.length > 0) return;
        }
        finalizeAndClearUrl();
        if (target) {
          const rCheck = checkInSession(
            target.id,
            parsed.pinCode || target.pinCode,
            "qr_scan",
            "حضور بالمسح المباشر من نظام الهاتف"
          );
          callbacksRef.current.onSelectLedger(target.id);
          callbacksRef.current.onStatusMessage({ ok: rCheck.ok, msg: rCheck.messageAr });
        } else {
          callbacksRef.current.onStatusMessage({
            ok: false,
            msg: "دفتر الحصص غير موجود في نطاق منشأتك أو متدربيك.",
          });
        }
      }
    };

    run();
  }, [
    isAuthenticated,
    canScanAndEnroll,
    isFacility,
    isCoach,
    linkedFacilityId,
    linkedCoachId,
    sessionLedgers,
    checkInSession,
    checkInBySubscriptionCode,
    lookupRemoteLedgersOrProfile,
    effectiveOffline,
  ]);
}
