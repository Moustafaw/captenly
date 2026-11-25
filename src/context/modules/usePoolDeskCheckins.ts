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
import { postSupabaseSync } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";
import { createPoolDeskRenewalsAndReceipts } from "./usePoolDeskRenewalsAndReceipts";

function generateSubscriptionCode(): string {
  const rand4 = Math.floor(1000 + Math.random() * 8999);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digit = Math.floor(1 + Math.random() * 9);
  return `SUB-${rand4}-${letter}${digit}`;
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

  const enrollSwimmerByMemberCode: CaptenlyContextType["enrollSwimmerByMemberCode"] = (payload) => {
    const {
      currentPersona: persona,
      allPersonas,
      memberRegistry,
      setMemberRegistry,
      minorAthletes,
      pushNotification,
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

    setSessionLedgers((prev) => [newLedger, ...prev]);

    if (targetFacility && payload.promoCodeUsed) {
      const cfg = getFacilityPoolDeskConfig(targetFacility);
      const promoCodeUpper = payload.promoCodeUsed.trim().toUpperCase();
      if (cfg.promoCodes.some((p) => p.code.toUpperCase() === promoCodeUpper)) {
        updateFacilityPoolDeskConfig(targetFacility.id, {
          promoCodes: cfg.promoCodes.map((p) =>
            p.code.toUpperCase() === promoCodeUpper ? { ...p, usedCount: p.usedCount + 1 } : p
          ),
        });
      }
    }

    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/session-ledgers", { ledger: newLedger });
    } else {
      setOfflineQueue((prev) => [
        {
          id: `oq-enroll-${Date.now()}`,
          kind: "enrollment",
          ledgerId: newLedger.id,
          athleteNameAr,
          sessionNumber: 0,
          method: "offline_sync",
          coachNoteAr: `تفعيل اشتراك جديد (${subscriptionCode}) أوفلاين`,
          queuedAtIso: new Date().toISOString(),
          synced: false,
        },
        ...prev,
      ]);
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
          isMinor: payload.isMinor,
          parentNameAr: payload.parentNameAr,
        },
        ...prev,
      ]);
    }

    pushNotification({
      titleAr: `تم إصدار كود اشتراك جديد (${subscriptionCode}) لـ ${athleteNameAr}`,
      messageAr: `الباقة (${payload.totalSessions} حصص — ${trackLabelAr}) مفعّلة الآن بكود اشتراك متجدد ${subscriptionCode} ينتهي تلقائياً بعد إتمام الـ ${payload.totalSessions} حصص.`,
      type: "session_reminder",
      actionLabelAr: "فتح سجل الاشتراكات",
      actionHref: "/dashboard/ledger",
    });

    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/notifications", {
        memberCode: normalizedCode,
        titleAr: `تم تفعيل اشتراكك (${payload.totalSessions} حصص) — كود الاشتراك: ${subscriptionCode}`,
        messageAr: `أهلاً ${athleteNameAr} — تم تفعيل باقتك (${trackLabelAr}) في ${targetFacility?.nameAr || persona.fullNameAr}. كود اشتراكك لهذه الباقة هو ${subscriptionCode}.`,
        type: "session_reminder",
        actionLabelAr: "عرض كود الاشتراك والـ QR",
        actionHref: "/dashboard/ledger",
      });
    }

    return {
      ok: true,
      ledger: newLedger,
      messageAr: `تم تسجيل ${athleteNameAr} (${trackLabelAr}) وتوليد كود اشتراك جديد (${subscriptionCode}) صالح لـ ${payload.totalSessions} حصص فقط!`,
    };
  };

  const checkInSession: CaptenlyContextType["checkInSession"] = (
    ledgerId,
    enteredPinOrQr,
    method,
    coachNoteAr,
    options
  ) => {
    const { currentPersona: persona, activeStaffAssignment } = getDeps();
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) return { ok: false, messageAr: "دفتر الحصص غير موجود." };
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
          ok: false,
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
          ok: false,
          messageAr: `لا يمكنك مسح سبّاح يتبع مجموعة أخرى داخل ${targetLedger.facilityNameAr}.`,
        };
      }
    }

    const gateEval = evaluateLedgerGateStatus(targetLedger);
    if (gateEval.verdict === "expired") {
      return {
        ok: false,
        messageAr: `انتهت صلاحية كود الاشتراك (${subCode}) لاستنفاد جميع الحصص (${targetLedger.totalSessions}/${targetLedger.totalSessions})! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }
    if (gateEval.verdict === "duplicate_3h" && !options?.overrideDuplicate3h) {
      return {
        ok: false,
        duplicateBlocked: true,
        messageAr: `تم مسح حضور «${targetLedger.athleteNameAr}» مسبقاً قبل ${gateEval.minutesSinceLastScan || 1} دقيقة (خلال آخر 3 ساعات) — تم منع الخصم المزدوج لحماية رصيد السباح.`,
      };
    }

    const cleanInput = enteredPinOrQr.trim().toUpperCase();
    const hasUnmaskedPin = Boolean(targetLedger.pinCode && targetLedger.pinCode !== "****");
    if (
      method === "pin_4digit" &&
      !(hasUnmaskedPin && cleanInput === targetLedger.pinCode.toUpperCase()) &&
      cleanInput !== subCode.toUpperCase() &&
      cleanInput !== targetLedger.ledgerCode.toUpperCase()
    ) {
      return {
        ok: false,
        messageAr: `كود الاشتراك أو الـ PIN غير صحيح! يرجى التحقق من كود الاشتراك الحالي (${subCode}) أو مسح رمز QR الخاص بالسباح.`,
      };
    }

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
          scannedAtIso: now.toISOString(),
          scannedByNameAr: persona.fullNameAr,
          scannedByMemberCode: persona.memberCode,
          scannedByRole,
          scanSource: options?.scanSource || "dashboard_manual",
        },
      ],
    };

    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? updatedLedger : l)));

    if (!isOff) {
      postSupabaseSync("/api/supabase/session-ledgers", {
        ledger: updatedLedger,
        overrideDuplicate3h: Boolean(options?.overrideDuplicate3h),
      });
      if (targetLedger.memberCode) {
        postSupabaseSync("/api/supabase/notifications", {
          memberCode: targetLedger.memberCode,
          titleAr: isNowExpired
            ? `اكتملت باقتك (${nextNum}/${targetLedger.totalSessions}) وانتهت صلاحية الكود ${subCode}`
            : `تم تسجيل حضور الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) ✓`,
          messageAr: isNowExpired
            ? `أتممت جميع حصص باقتك في ${targetLedger.facilityNameAr}. انتهت صلاحية كود الاشتراك ${subCode}، وعند التجديد سيتولد لك كود جديد.`
            : `سجّل ${persona.fullNameAr} حضورك في ${targetLedger.facilityNameAr}. المتبقي: ${remaining} حصة.`,
          type: "session_reminder",
          actionLabelAr: "عرض سجل حصصي",
          actionHref: "/dashboard/ledger",
        });
      }
    } else {
      setOfflineQueue((prev) => [
        {
          id: `oq-${Date.now()}`,
          kind: "checkin",
          ledgerId,
          athleteNameAr: targetLedger.athleteNameAr,
          sessionNumber: nextNum,
          method: "offline_sync",
          coachNoteAr: coachNoteAr || "حضور مؤكد بالمسبح",
          queuedAtIso: now.toISOString(),
          synced: false,
        },
        ...prev,
      ]);
    }

    const expiryOrRenewalMsg = isNowExpired
      ? ` — اكتملت الـ ${targetLedger.totalSessions} حصص وانتهت صلاحية كود الاشتراك (${subCode}) تلقائياً!`
      : remaining <= 2
        ? ` — تنبيه: متبقي ${remaining} حصة فقط في هذا الكود.`
        : "";

    return {
      ok: true,
      messageAr: `تم خصم الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) للمشترك ${targetLedger.athleteNameAr} ${
        isOff ? "(محفوظ أوفلاين وسيتم رفعه تلقائياً فور عودة الإنترنت)" : "بنجاح"
      }${expiryOrRenewalMsg}`,
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
    checkInSession,
    checkInBySubscriptionCode,
    ...renewalAndReceiptActions,
  };
}
