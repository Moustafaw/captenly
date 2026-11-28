"use client";

import type {
  Coach,
  Facility,
  FacilityLinkedEntity,
  FacilityPoolDeskConfig,
  FacilityStaffMember,
  MemberRegistryEntry,
  MinorAthleteProfile,
  NotificationItem,
  OfflineCheckinQueueItem,
  PersonaAccount,
  SessionCheckin,
  SessionLedger,
} from "@/types/captenly";
import {
  evaluateLedgerGateStatus,
  getFacilityPoolDeskConfig,
  resolveCoachScanPermission,
} from "@/lib/poolDeskPricing";
import {
  mergeSessionLedgers,
  readAllOfflineShiftSnapshots,
  readOfflineShiftSnapshot,
  upsertLedgerInOfflineShiftSnapshot,
} from "@/lib/offlineShiftDb";
import { syncToSupabase, type SyncResult } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";
import { createPoolDeskRenewalsAndReceipts } from "./usePoolDeskRenewalsAndReceipts";

function generateSubscriptionCode(): string {
  const rand4 = Math.floor(1000 + Math.random() * 8999);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digit = Math.floor(1 + Math.random() * 9);
  return `SUB-${rand4}-${letter}${digit}`;
}

function createClientEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeServerLedgerPreservingPin(
  localLedger: SessionLedger | undefined,
  serverLedger: SessionLedger | undefined
): SessionLedger | undefined {
  if (!serverLedger || typeof serverLedger !== "object") return localLedger;
  return {
    ...serverLedger,
    pinCode:
      serverLedger.pinCode === "****" &&
      localLedger?.pinCode &&
      localLedger.pinCode !== "****"
        ? localLedger.pinCode
        : serverLedger.pinCode,
  };
}

export interface PoolDeskCheckinsInput {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  coaches: Coach[];
  facilityLinks: FacilityLinkedEntity[];
  sessionLedgers: SessionLedger[];
  setSessionLedgers: React.Dispatch<React.SetStateAction<SessionLedger[]>>;
  setOfflineQueue: React.Dispatch<React.SetStateAction<OfflineCheckinQueueItem[]>>;
  effectiveOffline: boolean;
  updateFacilityPoolDeskConfig: (
    facilityId: string,
    patch: Partial<FacilityPoolDeskConfig>
  ) => { ok: boolean; messageAr: string };
  getDeps: () => {
    currentPersona: PersonaAccount;
    allPersonas: PersonaAccount[];
    memberRegistry: MemberRegistryEntry[];
    setMemberRegistry: React.Dispatch<React.SetStateAction<MemberRegistryEntry[]>>;
    minorAthletes: MinorAthleteProfile[];
    activeStaffAssignment: FacilityStaffMember | null;
    pushNotification: (
      notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
    ) => void;
  };
}

export function createPoolDeskCheckinActions(input: PoolDeskCheckinsInput) {
  const {
    facilities,
    setFacilities,
    coaches,
    facilityLinks,
    sessionLedgers,
    setSessionLedgers,
    setOfflineQueue,
    effectiveOffline,
    updateFacilityPoolDeskConfig,
    getDeps,
  } = input;

  const upsertLedgerInStateAndIdb = (ledger: SessionLedger) => {
    setSessionLedgers((prev) => {
      const exists = prev.some((l) => l.id === ledger.id);
      return exists ? prev.map((l) => (l.id === ledger.id ? ledger : l)) : [ledger, ...prev];
    });
    if (ledger.facilityId) {
      void upsertLedgerInOfflineShiftSnapshot(ledger.facilityId, ledger);
    }
  };

  const buildEnrollmentState = (
    payload: Parameters<CaptenlyContextType["enrollSwimmerByMemberCode"]>[0]
  ) => {
    const {
      currentPersona: persona,
      allPersonas,
      memberRegistry,
      minorAthletes,
    } = getDeps();

    const rawCode = payload.memberCode.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith("CAP-")
      ? rawCode
      : rawCode
        ? `CAP-M-${rawCode.replace(/[^A-Z0-9]/g, "").slice(-4) || Math.floor(1000 + Math.random() * 8999)}`
        : `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`;

    const regMatch = memberRegistry.find(
      (m) =>
        m.memberCode.toUpperCase() === normalizedCode ||
        (m.childMemberCode || "").toUpperCase() === normalizedCode
    );
    const minorMatch = minorAthletes.find(
      (c) => (c.childMemberCode || "").toUpperCase() === normalizedCode || c.id.toUpperCase() === rawCode
    );
    const personaMatch = allPersonas.find((p) => (p.memberCode || "").toUpperCase() === normalizedCode);
    const targetFacility = facilities.find((f) => f.id === payload.facilityId);
    const linkedEntity = payload.linkedEntityId
      ? facilityLinks.find((e) => e.id === payload.linkedEntityId) ||
        getFacilityPoolDeskConfig(targetFacility).linkedEntities.find(
          (e) => e.id === payload.linkedEntityId
        )
      : undefined;
    const targetCoach = coaches.find((c) => c.id === (payload.coachId || linkedEntity?.linkedCoachId));

    const athleteId =
      minorMatch?.id || regMatch?.athleteId || personaMatch?.id || `member-${normalizedCode}`;
    const athleteNameAr =
      payload.athleteNameAr?.trim() ||
      minorMatch?.fullNameAr ||
      regMatch?.fullNameAr ||
      personaMatch?.fullNameAr ||
      `مشترك (${normalizedCode})`;

    const subscriptionCode = generateSubscriptionCode();
    const pinCode = String(Math.floor(1000 + Math.random() * 8999));
    const trackType = payload.trackType || "school";
    const trackLabels: Record<NonNullable<typeof payload.trackType>, string> = {
      school: "مدارس السباحة",
      buds: "البراعم والتأسيس",
      prep: "التجهيزي",
      team: "الفرق والبطولات",
      ladies: "مواعيد السيدات",
    };
    const trackLabelAr = payload.trackLabelAr || trackLabels[trackType];

    const newLedger: SessionLedger = {
      id: `ledger-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ledgerCode: subscriptionCode,
      subscriptionCode,
      memberCode: normalizedCode,
      athleteId,
      athleteNameAr,
      isMinor: Boolean(payload.isMinor ?? (minorMatch ? true : regMatch?.isMinor)),
      parentNameAr: payload.parentNameAr || (minorMatch ? persona.fullNameAr : regMatch?.parentNameAr),
      coachId: targetCoach?.id || linkedEntity?.linkedCoachId || targetFacility?.id || persona.id,
      coachNameAr:
        targetCoach?.fullNameAr ||
        linkedEntity?.displayNameAr ||
        (targetFacility ? `إدارة ${targetFacility.nameAr}` : persona.fullNameAr),
      facilityId: targetFacility?.id || payload.facilityId || `fac-custom-${persona.id}`,
      facilityNameAr: targetFacility?.nameAr || `أكاديمية سباحة — ${persona.city}`,
      linkedEntityId: linkedEntity?.id || payload.linkedEntityId,
      linkedEntityNameAr: linkedEntity?.displayNameAr || payload.linkedEntityNameAr,
      agreementTypeAtEnroll: linkedEntity?.agreementType || payload.agreementTypeAtEnroll,
      pricingSnapshot: payload.pricingSnapshot,
      sportSector: "swimming",
      trackType,
      trackLabelAr,
      packageTitleAr: payload.packageTitleAr,
      totalSessions: payload.totalSessions,
      completedSessions: 0,
      pinCode,
      status: "active",
      isCodeExpired: false,
      startedDateAr: effectiveOffline
        ? "اليوم — محفوظ أوفلاين (سيتم الرفع عند عودة النت)"
        : "اليوم — اشتراك نشط",
      checkins: [],
      receipts: [
        {
          id: `rcp-${Date.now()}`,
          referenceNumber: subscriptionCode,
          channel: "إنستاباي (InstaPay)",
          amountEgp: payload.amountEgp,
          uploadedDateAr: "مؤكد عند الاشتراك",
          confirmedByProvider: true,
          packageTitleAr: payload.packageTitleAr,
        },
      ],
    };

    return {
      persona,
      normalizedCode,
      regMatch,
      personaMatch,
      targetFacility,
      athleteId,
      athleteNameAr,
      subscriptionCode,
      trackLabelAr,
      newLedger,
    };
  };

  const commitLocalEnrollmentEffects = (
    built: ReturnType<typeof buildEnrollmentState>,
    promoCodeUsed?: string,
    finalLedger?: SessionLedger
  ) => {
    const { setMemberRegistry, pushNotification } = getDeps();
    const {
      persona,
      normalizedCode,
      regMatch,
      personaMatch,
      targetFacility,
      athleteId,
      athleteNameAr,
      subscriptionCode,
      trackLabelAr,
      newLedger,
    } = built;
    const savedLedger = finalLedger || newLedger;

    setSessionLedgers((prev) => [savedLedger, ...prev]);
    if (savedLedger.facilityId) {
      void upsertLedgerInOfflineShiftSnapshot(savedLedger.facilityId, savedLedger);
    }

    if (targetFacility && promoCodeUsed) {
      const cfg = getFacilityPoolDeskConfig(targetFacility);
      const promoCodeUpper = promoCodeUsed.trim().toUpperCase();
      if (cfg.promoCodes.some((p) => p.code.toUpperCase() === promoCodeUpper)) {
        updateFacilityPoolDeskConfig(targetFacility.id, {
          promoCodes: cfg.promoCodes.map((p) =>
            p.code.toUpperCase() === promoCodeUpper ? { ...p, usedCount: p.usedCount + 1 } : p
          ),
        });
      }
    }

    if (targetFacility) {
      setFacilities((prev) =>
        prev.map((f) =>
          f.id === targetFacility.id
            ? {
                ...f,
                monthlyMetrics: {
                  ...f.monthlyMetrics,
                  activeSessionLedgers: f.monthlyMetrics.activeSessionLedgers + 1,
                },
              }
            : f
        )
      );
    }

    if (!regMatch) {
      setMemberRegistry((prev) => [
        {
          memberCode: normalizedCode,
          athleteId,
          fullNameAr: athleteNameAr,
          phone: personaMatch?.phone || "",
          city: targetFacility?.city || persona.city || "مصر",
          role: "adult_athlete",
          isMinor: savedLedger.isMinor,
          parentNameAr: savedLedger.parentNameAr,
        },
        ...prev,
      ]);
    }

    pushNotification({
      titleAr: `تم إصدار كود اشتراك جديد (${subscriptionCode}) لـ ${athleteNameAr}`,
      messageAr: `الباقة (${savedLedger.totalSessions} حصص — ${trackLabelAr}) مفعّلة الآن بكود اشتراك متجدد ${subscriptionCode} ينتهي تلقائياً بعد إتمام الـ ${savedLedger.totalSessions} حصص.`,
      type: "session_reminder",
      actionLabelAr: "فتح سجل الاشتراكات",
      actionHref: "/dashboard/ledger",
    });
  };

  const enrollSwimmerByMemberCodeAsync: NonNullable<
    CaptenlyContextType["enrollSwimmerByMemberCodeAsync"]
  > = async (payload) => {
    const built = buildEnrollmentState(payload);
    const clientEventId = createClientEventId();

    if (effectiveOffline) {
      commitLocalEnrollmentEffects(built, payload.promoCodeUsed);
      setOfflineQueue((prev) => [
        {
          id: `oq-enroll-${Date.now()}`,
          clientEventId,
          kind: "enrollment",
          ledgerId: built.newLedger.id,
          athleteNameAr: built.athleteNameAr,
          sessionNumber: 0,
          method: "offline_sync",
          syncStatus: "pending",
          retryCount: 0,
          coachNoteAr: `تفعيل اشتراك جديد (${built.subscriptionCode}) أوفلاين`,
          queuedAtIso: new Date().toISOString(),
          synced: false,
        },
        ...prev,
      ]);
      return {
        ok: true,
        ledger: built.newLedger,
        messageAr: `تم تسجيل ${built.athleteNameAr} (${built.trackLabelAr}) أوفلاين بكود (${built.subscriptionCode}) — سيتم الرفع تلقائياً عند عودة الشبكة.`,
      };
    }

    const syncRes = await syncToSupabase("/api/supabase/session-ledgers", {
      ledger: built.newLedger,
      promoCodeUsed: payload.promoCodeUsed,
      clientEventId,
    });

    if (!syncRes.ok) {
      return {
        ok: false,
        messageAr: syncRes.messageAr || "تعذر تفعيل الاشتراك على السيرفر — لم يتم الخصم أو الحفظ.",
        syncResult: syncRes,
      };
    }

    const mergedLedger =
      mergeServerLedgerPreservingPin(
        built.newLedger,
        syncRes.data?.ledger as SessionLedger | undefined
      ) || built.newLedger;

    commitLocalEnrollmentEffects(built, payload.promoCodeUsed, mergedLedger);

    void syncToSupabase("/api/supabase/notifications", {
      memberCode: built.normalizedCode,
      titleAr: `تم تفعيل اشتراكك (${payload.totalSessions} حصص) — كود الاشتراك: ${built.subscriptionCode}`,
      messageAr: `أهلاً ${built.athleteNameAr} — تم تفعيل باقتك (${built.trackLabelAr}) في ${built.targetFacility?.nameAr || built.persona.fullNameAr}. كود اشتراكك لهذه الباقة هو ${built.subscriptionCode}.`,
      type: "session_reminder",
      actionLabelAr: "عرض كود الاشتراك والـ QR",
      actionHref: "/dashboard/ledger",
    });

    return {
      ok: true,
      ledger: mergedLedger,
      syncResult: syncRes,
      messageAr: `تم تسجيل ${built.athleteNameAr} (${built.trackLabelAr}) وتوليد كود اشتراك جديد (${built.subscriptionCode}) صالح لـ ${payload.totalSessions} حصص فقط!`,
    };
  };

  const enrollSwimmerByMemberCode: CaptenlyContextType["enrollSwimmerByMemberCode"] = (payload) => {
    const built = buildEnrollmentState(payload);
    const clientEventId = createClientEventId();
    commitLocalEnrollmentEffects(built, payload.promoCodeUsed);

    if (!effectiveOffline) {
      void syncToSupabase("/api/supabase/session-ledgers", {
        ledger: built.newLedger,
        promoCodeUsed: payload.promoCodeUsed,
        clientEventId,
      }).then((syncRes) => {
        if (syncRes.ok) {
          const mergedLedger = mergeServerLedgerPreservingPin(
            built.newLedger,
            syncRes.data?.ledger as SessionLedger | undefined
          );
          if (mergedLedger) upsertLedgerInStateAndIdb(mergedLedger);
          void syncToSupabase("/api/supabase/notifications", {
            memberCode: built.normalizedCode,
            titleAr: `تم تفعيل اشتراكك (${payload.totalSessions} حصص) — كود الاشتراك: ${built.subscriptionCode}`,
            messageAr: `أهلاً ${built.athleteNameAr} — تم تفعيل باقتك (${built.trackLabelAr}) في ${built.targetFacility?.nameAr || built.persona.fullNameAr}. كود اشتراكك لهذه الباقة هو ${built.subscriptionCode}.`,
            type: "session_reminder",
            actionLabelAr: "عرض كود الاشتراك والـ QR",
            actionHref: "/dashboard/ledger",
          });
        } else {
          setOfflineQueue((prev) => [
            {
              id: `oq-enroll-${Date.now()}`,
              clientEventId,
              kind: "enrollment",
              ledgerId: built.newLedger.id,
              athleteNameAr: built.athleteNameAr,
              sessionNumber: 0,
              method: "offline_sync",
              syncStatus: "failed",
              retryCount: 1,
              lastErrorCode: syncRes.errorCode,
              lastErrorAr: syncRes.messageAr,
              coachNoteAr: `تفعيل اشتراك جديد (${built.subscriptionCode})`,
              queuedAtIso: new Date().toISOString(),
              synced: false,
            },
            ...prev,
          ]);
        }
      });
    } else {
      setOfflineQueue((prev) => [
        {
          id: `oq-enroll-${Date.now()}`,
          clientEventId,
          kind: "enrollment",
          ledgerId: built.newLedger.id,
          athleteNameAr: built.athleteNameAr,
          sessionNumber: 0,
          method: "offline_sync",
          syncStatus: "pending",
          retryCount: 0,
          coachNoteAr: `تفعيل اشتراك جديد (${built.subscriptionCode}) أوفلاين`,
          queuedAtIso: new Date().toISOString(),
          synced: false,
        },
        ...prev,
      ]);
    }

    return {
      ok: true,
      ledger: built.newLedger,
      messageAr: `تم تسجيل ${built.athleteNameAr} (${built.trackLabelAr}) وتوليد كود اشتراك جديد (${built.subscriptionCode}) صالح لـ ${payload.totalSessions} حصص فقط!`,
    };
  };

  const validateCheckinLocally = (
    targetLedger: SessionLedger,
    enteredPinOrQr: string,
    method: "pin_4digit" | "qr_scan" | "offline_sync",
    coachNoteAr?: string,
    options?: {
      overrideDuplicate3h?: boolean;
      scanSource?: SessionCheckin["scanSource"];
      allowServerPinVerification?: boolean;
    }
  ) => {
    const { currentPersona: persona, activeStaffAssignment } = getDeps();
    const subCode = targetLedger.subscriptionCode || targetLedger.ledgerCode;

    const isActingAsFacility =
      persona.role === "facility_manager" ||
      persona.role === "super_admin" ||
      Boolean(activeStaffAssignment);
    if (!isActingAsFacility && persona.role === "coach") {
      const targetFac = facilities.find((f) => f.id === targetLedger.facilityId);
      const myCoachId = persona.linkedCoachId || persona.id;
      const explicitLink = facilityLinks.find(
        (l) =>
          l.facilityId === targetLedger.facilityId &&
          ((targetLedger.linkedEntityId && l.id === targetLedger.linkedEntityId) ||
            l.linkedCoachId === myCoachId ||
            (persona.memberCode &&
              l.linkedMemberCode?.toUpperCase() === persona.memberCode.toUpperCase()))
      );
      const perm = resolveCoachScanPermission({
        facility: targetFac,
        coachId: myCoachId,
        coachMemberCode: persona.memberCode,
        linkedEntity: explicitLink,
      });
      if (perm.isLinked && !perm.canScanGroupQr) {
        return {
          ok: false as const,
          messageAr: `صلاحية مسح الـ QR لدى «${targetLedger.facilityNameAr}» مقصورة حالياً على بوابة المنشأة فقط — اطلب تفعيل تفويض الكابتن من إدارة النادي.`,
        };
      }
      if (
        perm.isLinked &&
        perm.linkEntry &&
        targetLedger.linkedEntityId &&
        targetLedger.linkedEntityId !== perm.linkEntry.id &&
        targetLedger.coachId !== myCoachId
      ) {
        return {
          ok: false as const,
          messageAr: `لا يمكنك مسح سبّاح يتبع مجموعة أخرى داخل ${targetLedger.facilityNameAr}.`,
        };
      }
    }

    const gateEval = evaluateLedgerGateStatus(targetLedger);
    if (gateEval.verdict === "expired") {
      return {
        ok: false as const,
        expired: true,
        messageAr: `انتهت صلاحية كود الاشتراك (${subCode}) لاستنفاد جميع الحصص (${targetLedger.totalSessions}/${targetLedger.totalSessions})! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }
    if (gateEval.verdict === "duplicate_3h" && !options?.overrideDuplicate3h) {
      return {
        ok: false as const,
        duplicateBlocked: true,
        messageAr: `تم مسح حضور «${targetLedger.athleteNameAr}» مسبقاً قبل ${gateEval.minutesSinceLastScan || 1} دقيقة (خلال آخر 3 ساعات) — تم منع الخصم المزدوج لحماية رصيد السباح.`,
      };
    }

    const cleanInput = enteredPinOrQr.trim().toUpperCase();
    const isFourDigitPin = /^\d{4}$/.test(cleanInput);
    const hasUnmaskedPin = Boolean(targetLedger.pinCode && targetLedger.pinCode !== "****");
    if (
      method === "pin_4digit" &&
      !(options?.allowServerPinVerification && isFourDigitPin) &&
      !(hasUnmaskedPin && cleanInput === targetLedger.pinCode.toUpperCase()) &&
      cleanInput !== subCode.toUpperCase() &&
      cleanInput !== targetLedger.ledgerCode.toUpperCase()
    ) {
      return {
        ok: false as const,
        messageAr: `كود الاشتراك أو الـ PIN غير صحيح! يرجى التحقق من كود الاشتراك الحالي (${subCode}) أو مسح رمز QR الخاص بالسباح.`,
      };
    }

    const clientEventId = createClientEventId();
    const nextNum = targetLedger.completedSessions + 1;
    const remaining = targetLedger.totalSessions - nextNum;
    const isNowExpired = nextNum >= targetLedger.totalSessions;
    const isOff = effectiveOffline || method === "offline_sync";
    const now = new Date();
    const nowTimeAr = now.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
    const scannedByRole: SessionCheckin["scannedByRole"] =
      persona.role === "super_admin"
        ? "admin"
        : isActingAsFacility
          ? "facility_gate"
          : targetLedger.linkedEntityId
            ? "delegated_coach"
            : "coach_private";

    const updatedLedger: SessionLedger = {
      ...targetLedger,
      completedSessions: nextNum,
      status: isNowExpired ? "completed" : remaining <= 2 ? "renewal_due" : "active",
      isCodeExpired: isNowExpired,
      checkins: [
        ...targetLedger.checkins,
        {
          sessionNumber: nextNum,
          dateAr: isOff
            ? `اليوم ${nowTimeAr} (محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً)`
            : `اليوم ${nowTimeAr} — ختم موثق أونلاين`,
          method: isOff ? "offline_sync" : method,
          verifiedByAr: isActingAsFacility
            ? `${persona.fullNameAr} (${activeStaffAssignment?.roleTitleAr || "بوابة المنشأة"})`
            : `${persona.fullNameAr} (كابتن)`,
          coachNoteAr: coachNoteAr || "حضور مؤكد وتمرين ممتاز",
          wasOffline: isOff,
          clientEventId,
          scannedAtIso: now.toISOString(),
          scannedByNameAr: persona.fullNameAr,
          scannedByMemberCode: persona.memberCode,
          scannedByRole,
          scanSource: options?.scanSource || "dashboard_manual",
        },
      ],
    };

    const expiryOrRenewalMsg = isNowExpired
      ? ` — اكتملت الـ ${targetLedger.totalSessions} حصص وانتهت صلاحية كود الاشتراك (${subCode}) تلقائياً!`
      : remaining <= 2
        ? ` — تنبيه: متبقي ${remaining} حصة فقط في هذا الكود.`
        : "";

    return {
      ok: true as const,
      persona,
      subCode,
      nextNum,
      remaining,
      isNowExpired,
      isOff,
      now,
      clientEventId,
      updatedLedger,
      expiryOrRenewalMsg,
    };
  };

  const checkInByPinAsync: NonNullable<
    CaptenlyContextType["checkInByPinAsync"]
  > = async (pinCode, options) => {
    const { currentPersona: persona } = getDeps();
    const cleanPin = pinCode.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return {
        ok: false,
        messageAr: "يرجى إدخال رمز PIN صحيح مكوّن من 4 أرقام.",
      };
    }
    if (effectiveOffline) {
      return {
        ok: false,
        messageAr:
          "التحقق برمز الـ PIN (4 أرقام) يتطلب اتصالاً بالإنترنت — استخدم مسح QR أو كود الاشتراك (CAP-SUB-...) في وضع الأوفلاين.",
      };
    }

    const clientEventId = createClientEventId();
    const syncRes = await syncToSupabase("/api/supabase/session-ledgers", {
      action: "pin_checkin",
      pinCode: cleanPin,
      ledgerId: options?.ledgerId,
      facilityId: options?.facilityId,
      coachId: options?.coachId,
      coachNoteAr: options?.coachNoteAr,
      overrideDuplicate3h: Boolean(options?.overrideDuplicate3h),
      clientEventId,
      scanSource: options?.scanSource || "gate_kiosk",
      operatorNameAr: persona.fullNameAr,
    });

    if (!syncRes.ok) {
      const serverLedger = syncRes.data?.serverLedger as SessionLedger | undefined;
      if (syncRes.status === 409 && serverLedger) {
        const existingLocal = sessionLedgers.find((l) => l.id === serverLedger.id);
        const merged = mergeServerLedgerPreservingPin(existingLocal, serverLedger);
        if (merged) upsertLedgerInStateAndIdb(merged);
      }
      return {
        ok: false,
        expired: Boolean(syncRes.data?.expired),
        duplicateBlocked: Boolean(syncRes.data?.duplicateBlocked),
        ambiguousPin: syncRes.errorCode === "ambiguous_pin",
        rateLimited: syncRes.status === 429 || syncRes.errorCode === "rate_limited",
        ledger: syncRes.data?.ledger as SessionLedger | undefined,
        messageAr:
          syncRes.messageAr || "تعذر التحقق من رمز الـ PIN على السيرفر.",
        syncResult: syncRes,
      };
    }

    const remoteLedger = syncRes.data?.ledger as SessionLedger | undefined;
    const localMatch = remoteLedger
      ? sessionLedgers.find((l) => l.id === remoteLedger.id)
      : undefined;
    const savedLedger = mergeServerLedgerPreservingPin(localMatch, remoteLedger);
    if (savedLedger) {
      upsertLedgerInStateAndIdb(savedLedger);
      if (savedLedger.memberCode) {
        const subCode = savedLedger.subscriptionCode || savedLedger.ledgerCode;
        const remaining = Math.max(
          0,
          savedLedger.totalSessions - savedLedger.completedSessions
        );
        const isNowExpired = savedLedger.completedSessions >= savedLedger.totalSessions;
        void syncToSupabase("/api/supabase/notifications", {
          memberCode: savedLedger.memberCode,
          titleAr: isNowExpired
            ? `اكتملت باقتك (${savedLedger.completedSessions}/${savedLedger.totalSessions}) وانتهت صلاحية الكود ${subCode}`
            : `تم تسجيل حضور الحصة رقم (${savedLedger.completedSessions} من ${savedLedger.totalSessions}) ✓`,
          messageAr: isNowExpired
            ? `أتممت جميع حصص باقتك في ${savedLedger.facilityNameAr}. انتهت صلاحية كود الاشتراك ${subCode}.`
            : `سجّل ${persona.fullNameAr} حضورك في ${savedLedger.facilityNameAr}. المتبقي: ${remaining} حصة.`,
          type: "session_reminder",
          actionLabelAr: "عرض سجل حصصي",
          actionHref: "/dashboard/ledger",
        });
      }
    }

    return {
      ok: true,
      ledger: savedLedger,
      syncResult: syncRes,
      messageAr:
        syncRes.messageAr ||
        (savedLedger
          ? `تم خصم الحصة رقم (${savedLedger.completedSessions} من ${savedLedger.totalSessions}) للمشترك ${savedLedger.athleteNameAr} بنجاح.`
          : "تم تسجيل الحضور بالـ PIN بنجاح."),
    };
  };

  const checkInSessionAsyncInternal = async (
    ledgerId: string,
    enteredPinOrQr: string,
    method: "pin_4digit" | "qr_scan" | "offline_sync",
    coachNoteAr?: string,
    options?: {
      overrideDuplicate3h?: boolean;
      scanSource?: SessionCheckin["scanSource"];
    },
    overrideTargetLedger?: SessionLedger
  ): Promise<{
    ok: boolean;
    duplicateBlocked?: boolean;
    expired?: boolean;
    ledger?: SessionLedger;
    messageAr: string;
    syncResult?: SyncResult;
  }> => {
    const targetLedger =
      overrideTargetLedger || sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) return { ok: false, messageAr: "دفتر الحصص غير موجود." };

    const cleanInput = enteredPinOrQr.trim();
    if (method === "pin_4digit" && /^\d{4}$/.test(cleanInput) && !effectiveOffline) {
      return checkInByPinAsync(cleanInput, {
        ledgerId: targetLedger.id,
        facilityId: targetLedger.facilityId,
        coachNoteAr,
        overrideDuplicate3h: options?.overrideDuplicate3h,
        scanSource: options?.scanSource || "dashboard_manual",
      });
    }

    const prep = validateCheckinLocally(
      targetLedger,
      enteredPinOrQr,
      method,
      coachNoteAr,
      { ...options, allowServerPinVerification: false }
    );
    if (!prep.ok) {
      return {
        ok: false,
        duplicateBlocked: "duplicateBlocked" in prep ? prep.duplicateBlocked : undefined,
        expired: "expired" in prep ? prep.expired : undefined,
        messageAr: prep.messageAr,
      };
    }

    if (prep.isOff) {
      upsertLedgerInStateAndIdb(prep.updatedLedger);
      setOfflineQueue((prev) => [
        {
          id: `oq-${Date.now()}`,
          clientEventId: prep.clientEventId,
          kind: "checkin",
          ledgerId,
          athleteNameAr: targetLedger.athleteNameAr,
          sessionNumber: prep.nextNum,
          method: "offline_sync",
          syncStatus: "pending",
          retryCount: 0,
          coachNoteAr: coachNoteAr || "حضور مؤكد بالمسبح",
          queuedAtIso: prep.now.toISOString(),
          synced: false,
        },
        ...prev,
      ]);
      return {
        ok: true,
        ledger: prep.updatedLedger,
        messageAr: `تم خصم الحصة رقم (${prep.nextNum} من ${targetLedger.totalSessions}) للمشترك ${targetLedger.athleteNameAr} (محفوظ أوفلاين وسيتم رفعه تلقائياً فور عودة الإنترنت)${prep.expiryOrRenewalMsg}`,
      };
    }

    const syncRes = await syncToSupabase("/api/supabase/session-ledgers", {
      ledger: prep.updatedLedger,
      overrideDuplicate3h: Boolean(options?.overrideDuplicate3h),
      clientEventId: prep.clientEventId,
      expectedCompletedSessions: targetLedger.completedSessions,
    });

    if (!syncRes.ok) {
      const serverLedger = syncRes.data?.serverLedger as SessionLedger | undefined;
      if (syncRes.status === 409 && serverLedger) {
        const merged = mergeServerLedgerPreservingPin(targetLedger, serverLedger);
        if (merged) upsertLedgerInStateAndIdb(merged);
      }
      return {
        ok: false,
        duplicateBlocked: Boolean(syncRes.data?.duplicateBlocked),
        expired: Boolean(syncRes.data?.expired),
        ledger: serverLedger,
        messageAr: syncRes.messageAr || "تعذر تسجيل الحضور على السيرفر.",
        syncResult: syncRes,
      };
    }

    const savedLedger =
      mergeServerLedgerPreservingPin(
        prep.updatedLedger,
        syncRes.data?.ledger as SessionLedger | undefined
      ) || prep.updatedLedger;
    upsertLedgerInStateAndIdb(savedLedger);

    if (targetLedger.memberCode) {
      void syncToSupabase("/api/supabase/notifications", {
        memberCode: targetLedger.memberCode,
        titleAr: prep.isNowExpired
          ? `اكتملت باقتك (${prep.nextNum}/${targetLedger.totalSessions}) وانتهت صلاحية الكود ${prep.subCode}`
          : `تم تسجيل حضور الحصة رقم (${prep.nextNum} من ${targetLedger.totalSessions}) ✓`,
        messageAr: prep.isNowExpired
          ? `أتممت جميع حصص باقتك في ${targetLedger.facilityNameAr}. انتهت صلاحية كود الاشتراك ${prep.subCode}، وعند التجديد سيتولد لك كود جديد.`
          : `سجّل ${prep.persona.fullNameAr} حضورك في ${targetLedger.facilityNameAr}. المتبقي: ${prep.remaining} حصة.`,
        type: "session_reminder",
        actionLabelAr: "عرض سجل حصصي",
        actionHref: "/dashboard/ledger",
      });
    }

    return {
      ok: true,
      ledger: savedLedger,
      syncResult: syncRes,
      messageAr: `تم خصم الحصة رقم (${prep.nextNum} من ${targetLedger.totalSessions}) للمشترك ${targetLedger.athleteNameAr} بنجاح${prep.expiryOrRenewalMsg}`,
    };
  };

  const checkInSessionAsync: NonNullable<
    CaptenlyContextType["checkInSessionAsync"]
  > = async (ledgerId, enteredPinOrQr, method, coachNoteAr, options) =>
    checkInSessionAsyncInternal(ledgerId, enteredPinOrQr, method, coachNoteAr, options);

  const checkInSession: CaptenlyContextType["checkInSession"] = (
    ledgerId,
    enteredPinOrQr,
    method,
    coachNoteAr,
    options
  ) => {
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) return { ok: false, messageAr: "دفتر الحصص غير موجود." };

    const prep = validateCheckinLocally(
      targetLedger,
      enteredPinOrQr,
      method,
      coachNoteAr,
      { ...options, allowServerPinVerification: !effectiveOffline }
    );
    if (!prep.ok) {
      return {
        ok: false,
        duplicateBlocked: "duplicateBlocked" in prep ? prep.duplicateBlocked : undefined,
        messageAr: prep.messageAr,
      };
    }

    upsertLedgerInStateAndIdb(prep.updatedLedger);

    if (!prep.isOff) {
      const cleanEntry = enteredPinOrQr.trim();
      const usePinAction = method === "pin_4digit" && /^\d{4}$/.test(cleanEntry);
      const syncPromise = usePinAction
        ? syncToSupabase("/api/supabase/session-ledgers", {
            action: "pin_checkin",
            ledgerId: targetLedger.id,
            pinCode: cleanEntry,
            facilityId: targetLedger.facilityId,
            coachNoteAr,
            overrideDuplicate3h: Boolean(options?.overrideDuplicate3h),
            clientEventId: prep.clientEventId,
            scanSource: options?.scanSource || "dashboard_manual",
            operatorNameAr: prep.persona.fullNameAr,
          })
        : syncToSupabase("/api/supabase/session-ledgers", {
            ledger: prep.updatedLedger,
            overrideDuplicate3h: Boolean(options?.overrideDuplicate3h),
            clientEventId: prep.clientEventId,
            expectedCompletedSessions: targetLedger.completedSessions,
          });

      void syncPromise.then((syncRes) => {
        if (syncRes.ok) {
          const merged = mergeServerLedgerPreservingPin(
            prep.updatedLedger,
            syncRes.data?.ledger as SessionLedger | undefined
          );
          if (merged) upsertLedgerInStateAndIdb(merged);
          if (targetLedger.memberCode) {
            void syncToSupabase("/api/supabase/notifications", {
              memberCode: targetLedger.memberCode,
              titleAr: prep.isNowExpired
                ? `اكتملت باقتك (${prep.nextNum}/${targetLedger.totalSessions}) وانتهت صلاحية الكود ${prep.subCode}`
                : `تم تسجيل حضور الحصة رقم (${prep.nextNum} من ${targetLedger.totalSessions}) ✓`,
              messageAr: prep.isNowExpired
                ? `أتممت جميع حصص باقتك في ${targetLedger.facilityNameAr}. انتهت صلاحية كود الاشتراك ${prep.subCode}، وعند التجديد سيتولد لك كود جديد.`
                : `سجّل ${prep.persona.fullNameAr} حضورك في ${targetLedger.facilityNameAr}. المتبقي: ${prep.remaining} حصة.`,
              type: "session_reminder",
              actionLabelAr: "عرض سجل حصصي",
              actionHref: "/dashboard/ledger",
            });
          }
        } else {
          // Roll back phantom local optimistic deduction on auth/forbidden/validation/conflict rejections
          upsertLedgerInStateAndIdb(targetLedger);
          if (syncRes.category === "network" || syncRes.category === "server" || syncRes.category === "offline") {
            setOfflineQueue((prev) => [
              {
                id: `oq-${Date.now()}`,
                clientEventId: prep.clientEventId,
                kind: "checkin",
                ledgerId,
                athleteNameAr: targetLedger.athleteNameAr,
                sessionNumber: prep.nextNum,
                method: "offline_sync",
                syncStatus: "failed",
                retryCount: 1,
                lastErrorCode: syncRes.errorCode,
                lastErrorAr: syncRes.messageAr,
                coachNoteAr: coachNoteAr || "حضور مؤكد بالمسبح",
                queuedAtIso: prep.now.toISOString(),
                synced: false,
              },
              ...prev,
            ]);
          }
        }
      });
    } else {
      setOfflineQueue((prev) => [
        {
          id: `oq-${Date.now()}`,
          clientEventId: prep.clientEventId,
          kind: "checkin",
          ledgerId,
          athleteNameAr: targetLedger.athleteNameAr,
          sessionNumber: prep.nextNum,
          method: "offline_sync",
          syncStatus: "pending",
          retryCount: 0,
          coachNoteAr: coachNoteAr || "حضور مؤكد بالمسبح",
          queuedAtIso: prep.now.toISOString(),
          synced: false,
        },
        ...prev,
      ]);
    }

    return {
      ok: true,
      messageAr: `تم خصم الحصة رقم (${prep.nextNum} من ${targetLedger.totalSessions}) للمشترك ${targetLedger.athleteNameAr} ${
        prep.isOff ? "(محفوظ أوفلاين وسيتم رفعه تلقائياً فور عودة الإنترنت)" : "بنجاح"
      }${prep.expiryOrRenewalMsg}`,
    };
  };

  const checkInBySubscriptionCodeAsync: NonNullable<
    CaptenlyContextType["checkInBySubscriptionCodeAsync"]
  > = async (codeInput, facilityId, coachNoteAr, coachId, options) => {
    const raw = codeInput.trim();
    if (!raw) {
      return { ok: false, messageAr: "يرجى إدخال كود الاشتراك (مثل SUB-XXXX-XX) أو رقم الـ PIN." };
    }
    let cleaned = raw.toUpperCase();
    if (cleaned.startsWith("CAP-QR:") || cleaned.startsWith("CAP-SUB:")) {
      cleaned = (cleaned.split(":")[1] || "").trim().toUpperCase();
    }

    // GAP-002: 4-digit PIN path goes strictly through server verification when online
    if (/^\d{4}$/.test(cleaned)) {
      return checkInByPinAsync(cleaned, {
        facilityId,
        coachId,
        coachNoteAr,
        overrideDuplicate3h: options?.overrideDuplicate3h,
        scanSource: options?.scanSource || "gate_kiosk",
      });
    }

    // GAP-006: Merge live sessionLedgers with IndexedDB shift_snapshots so offline QR/SUB-* works even if localStorage is empty
    let idbLedgers: SessionLedger[] = [];
    try {
      if (facilityId) {
        const snap = await readOfflineShiftSnapshot(facilityId);
        if (snap?.ledgers?.length) idbLedgers = snap.ledgers;
      }
      if (idbLedgers.length === 0) {
        const allSnaps = await readAllOfflineShiftSnapshots();
        idbLedgers = allSnaps.flatMap((s) => (Array.isArray(s.ledgers) ? s.ledgers : []));
      }
    } catch {
      // ignore IDB read failures
    }

    const canonicalPool = mergeSessionLedgers(sessionLedgers, idbLedgers, "higher_progress");
    const filterByScope = (list: SessionLedger[]) =>
      list.filter((l) => {
        if (facilityId && l.facilityId !== facilityId) return false;
        if (coachId) {
          const matchesCoach = l.coachId === coachId;
          const matchesGroup =
            options?.allowedLinkedEntityId && l.linkedEntityId === options.allowedLinkedEntityId;
          if (!matchesCoach && !matchesGroup) return false;
        }
        return true;
      });

    let searchPool = filterByScope(canonicalPool);
    let exactMatch = searchPool.find(
      (l) =>
        (l.subscriptionCode || "").toUpperCase() === cleaned ||
        l.ledgerCode.toUpperCase() === cleaned
    );

    if (!exactMatch && !effectiveOffline) {
      try {
        const params = new URLSearchParams({ ledgerCode: cleaned });
        if (facilityId) params.set("facilityId", facilityId);
        if (coachId) params.set("coachId", coachId);
        const resp = await fetch(`/api/supabase/session-ledgers?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          const remoteLedgers = Array.isArray(data?.ledgers)
            ? (data.ledgers as SessionLedger[])
            : [];
          if (remoteLedgers.length > 0) {
            searchPool = filterByScope(
              mergeSessionLedgers(searchPool, remoteLedgers, "higher_progress")
            );
            exactMatch = searchPool.find(
              (l) =>
                (l.subscriptionCode || "").toUpperCase() === cleaned ||
                l.ledgerCode.toUpperCase() === cleaned
            );
          }
        }
      } catch {
        // fallback cleanly to not found
      }
    }

    if (!exactMatch) {
      return {
        ok: false,
        messageAr: `لم يتم العثور على اشتراك بالكود «${raw}». تأكد من مسح أو كتابة كود الاشتراك (CAP-SUB-...) الظاهر بجانب اسم المشترك.`,
      };
    }

    const subCode = exactMatch.subscriptionCode || exactMatch.ledgerCode;
    if (
      exactMatch.completedSessions >= exactMatch.totalSessions ||
      exactMatch.status === "completed" ||
      exactMatch.isCodeExpired
    ) {
      return {
        ok: false,
        expired: true,
        ledger: exactMatch,
        messageAr: `كود الاشتراك (${subCode}) الخاص بـ «${exactMatch.athleteNameAr}» منتهي الصلاحية لإتمام الـ ${exactMatch.totalSessions} حصص بالكامل! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }

    const res = await checkInSessionAsyncInternal(
      exactMatch.id,
      exactMatch.pinCode,
      "qr_scan",
      coachNoteAr,
      {
        overrideDuplicate3h: options?.overrideDuplicate3h,
        scanSource: options?.scanSource,
      },
      exactMatch
    );

    return {
      ok: res.ok,
      expired: res.expired,
      duplicateBlocked: res.duplicateBlocked,
      ledger: res.ledger || exactMatch,
      messageAr: res.messageAr,
      syncResult: res.syncResult,
    };
  };

  const checkInBySubscriptionCode: CaptenlyContextType["checkInBySubscriptionCode"] = (
    codeInput,
    facilityId,
    coachNoteAr,
    coachId,
    options
  ) => {
    const raw = codeInput.trim();
    if (!raw) {
      return { ok: false, messageAr: "يرجى إدخال كود الاشتراك (مثل SUB-XXXX-XX) أو رقم الـ PIN." };
    }
    let cleaned = raw.toUpperCase();
    if (cleaned.startsWith("CAP-QR:") || cleaned.startsWith("CAP-SUB:")) {
      cleaned = (cleaned.split(":")[1] || "").trim().toUpperCase();
    }

    const searchPool = sessionLedgers.filter((l) => {
      if (facilityId && l.facilityId !== facilityId) return false;
      if (coachId) {
        const matchesCoach = l.coachId === coachId;
        const matchesGroup =
          options?.allowedLinkedEntityId && l.linkedEntityId === options.allowedLinkedEntityId;
        if (!matchesCoach && !matchesGroup) return false;
      }
      return true;
    });

    const exactMatch =
      searchPool.find(
        (l) =>
          (l.subscriptionCode || "").toUpperCase() === cleaned ||
          l.ledgerCode.toUpperCase() === cleaned
      ) ||
      searchPool.find(
        (l) => l.pinCode && l.pinCode !== "****" && l.pinCode === cleaned && l.status !== "completed"
      );

    if (!exactMatch) {
      return {
        ok: false,
        messageAr: `لم يتم العثور على اشتراك بالكود «${raw}». تأكد من مسح أو كتابة كود الاشتراك (CAP-SUB-...) الظاهر بجانب اسم المشترك.`,
      };
    }

    const subCode = exactMatch.subscriptionCode || exactMatch.ledgerCode;
    if (
      exactMatch.completedSessions >= exactMatch.totalSessions ||
      exactMatch.status === "completed" ||
      exactMatch.isCodeExpired
    ) {
      return {
        ok: false,
        expired: true,
        ledger: exactMatch,
        messageAr: `كود الاشتراك (${subCode}) الخاص بـ «${exactMatch.athleteNameAr}» منتهي الصلاحية لإتمام الـ ${exactMatch.totalSessions} حصص بالكامل! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }

    const res = checkInSession(exactMatch.id, exactMatch.pinCode, "qr_scan", coachNoteAr, {
      overrideDuplicate3h: options?.overrideDuplicate3h,
      scanSource: options?.scanSource,
    });
    const nextCompleted = res.ok
      ? Math.min(exactMatch.totalSessions, exactMatch.completedSessions + 1)
      : exactMatch.completedSessions;
    const remainingAfter = Math.max(0, exactMatch.totalSessions - nextCompleted);
    const updatedSnapshot = res.ok
      ? {
          ...exactMatch,
          completedSessions: nextCompleted,
          isCodeExpired: nextCompleted >= exactMatch.totalSessions,
          status: (nextCompleted >= exactMatch.totalSessions
            ? "completed"
            : remainingAfter <= 2
              ? "renewal_due"
              : "active") as SessionLedger["status"],
        }
      : exactMatch;

    return {
      ok: res.ok,
      duplicateBlocked: res.duplicateBlocked,
      ledger: updatedSnapshot,
      messageAr: res.messageAr,
    };
  };

  const renewalAndReceiptActions = createPoolDeskRenewalsAndReceipts({
    sessionLedgers,
    setSessionLedgers,
    effectiveOffline,
    enrollSwimmerByMemberCode,
    pushNotification: (n) => getDeps().pushNotification(n),
  });

  return {
    enrollSwimmerByMemberCode,
    enrollSwimmerByMemberCodeAsync,
    checkInSession,
    checkInSessionAsync,
    checkInBySubscriptionCode,
    checkInBySubscriptionCodeAsync,
    checkInByPinAsync,
    ...renewalAndReceiptActions,
  };
}
