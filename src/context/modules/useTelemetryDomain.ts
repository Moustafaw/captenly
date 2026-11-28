"use client";

import { useState } from "react";
import type {
  DemandRadarEntry,
  DemandRadarSubmission,
  MemberRegistryEntry,
  MinorAthleteProfile,
  NotificationItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionLedger,
  SkillEvaluation5Point,
} from "@/types/captenly";
import {
  INITIAL_DEMAND_RADAR,
  INITIAL_MINOR_ATHLETES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PB_RECORDS,
  INITIAL_SKILL_EVALUATION,
  INITIAL_VERIFIED_LEADS,
} from "@/data/seedData";
import {
  DEFAULT_USER_SETTINGS,
  generateChildSubCode,
  getProfileSyncKey,
  postSupabaseSync,
} from "./storageHelpers";
import type { CaptenlyContextType, UserSettingsState } from "./types";
import { createPushNotification, useTelemetrySyncEffects } from "./useTelemetrySync";

export interface TelemetryDomainDeps {
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  allPersonas: PersonaAccount[];
  memberRegistry: MemberRegistryEntry[];
  setMemberRegistry: React.Dispatch<React.SetStateAction<MemberRegistryEntry[]>>;
  sessionLedgers: SessionLedger[];
  setFacilities: React.Dispatch<React.SetStateAction<import("@/types/captenly").Facility[]>>;
  setSavedFavoriteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCompareFacilityIds: React.Dispatch<React.SetStateAction<string[]>>;
  setUserLocation: React.Dispatch<React.SetStateAction<import("@/types/captenly").UserLocation>>;
  openAuthGateModal: (featureNameAr?: string) => void;
}

export function useTelemetryDomain({
  currentPersona,
  setSavedFavoriteIds,
  setCompareFacilityIds,
  setUserLocation,
  depsRef,
}: {
  currentPersona: PersonaAccount;
  setSavedFavoriteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCompareFacilityIds: React.Dispatch<React.SetStateAction<string[]>>;
  setUserLocation: React.Dispatch<React.SetStateAction<import("@/types/captenly").UserLocation>>;
  depsRef: React.MutableRefObject<TelemetryDomainDeps>;
}) {
  const [minorAthletes, setMinorAthletes] = useState<MinorAthleteProfile[]>(INITIAL_MINOR_ATHLETES);
  const [pbRecords, setPbRecords] = useState<PersonalBestRecord[]>(INITIAL_PB_RECORDS);
  const [skillEvaluation, setSkillEvaluation] =
    useState<SkillEvaluation5Point>(INITIAL_SKILL_EVALUATION);
  const [skillEvaluationsByAthlete, setSkillEvaluationsByAthlete] = useState<
    Record<string, SkillEvaluation5Point>
  >({});
  const [verifiedLeads, setVerifiedLeads] = useState(INITIAL_VERIFIED_LEADS);
  const [demandRadar, setDemandRadar] = useState<DemandRadarEntry[]>(INITIAL_DEMAND_RADAR);
  const [demandSubmissions, setDemandSubmissions] = useState<DemandRadarSubmission[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [userSettings, setUserSettings] = useState<UserSettingsState>(DEFAULT_USER_SETTINGS);
  const [newsletterEmails, setNewsletterEmails] = useState<string[]>([]);

  useTelemetrySyncEffects({
    currentPersona,
    minorAthletes,
    setMinorAthletes,
    setPbRecords,
    setSkillEvaluationsByAthlete,
    setVerifiedLeads,
    setNotifications,
    setUserSettings,
    setSavedFavoriteIds,
    setCompareFacilityIds,
    setUserLocation,
  });

  const pushNotification = createPushNotification(
    () => depsRef.current.currentPersona,
    setNotifications
  );

  const persistPrefsToRemote = (
    prefs: {
      favorites?: string[];
      compareIds?: string[];
      userSettings?: Record<string, unknown>;
      userLocation?: Record<string, unknown>;
    },
    overrideMemberCode?: string
  ) => {
    const code = overrideMemberCode || getProfileSyncKey(depsRef.current.currentPersona);
    if (!code) return;
    postSupabaseSync("/api/supabase/user-state", { type: "prefs", memberCode: code, prefs });
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) {
      postSupabaseSync("/api/supabase/notifications", { markReadId: id });
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const updateUserSettings = (newSettings: Partial<UserSettingsState>) => {
    setUserSettings((prev) => {
      const next = { ...prev, ...newSettings };
      persistPrefsToRemote({ userSettings: next as unknown as Record<string, unknown> });
      return next;
    });
  };

  const subscribeNewsletter = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      return { ok: false, messageAr: "يرجى إدخال بريد إلكتروني صحيح." };
    }
    if (!newsletterEmails.includes(clean)) setNewsletterEmails((prev) => [clean, ...prev]);
    postSupabaseSync("/api/supabase/newsletter", { email: clean, source: "magazine" });
    return {
      ok: true,
      messageAr: "تم استلام بريدك الإلكتروني لقائمة نشرة كابتنلي.",
    };
  };

  const subscribeNewsletterAsync: CaptenlyContextType["subscribeNewsletterAsync"] = async (
    email: string
  ) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      return { ok: false, persisted: false, messageAr: "يرجى إدخال بريد إلكتروني صحيح." };
    }
    if (!newsletterEmails.includes(clean)) setNewsletterEmails((prev) => [clean, ...prev]);
    try {
      const res = await fetch("/api/supabase/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, source: "magazine" }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        return {
          ok: true,
          persisted: Boolean(data?.persisted),
          messageAr:
            data?.messageAr || "تم تسجيل بريدك الإلكتروني بنجاح في قائمة نشرة كابتنلي الرياضية ✓",
        };
      }
      return {
        ok: false,
        persisted: false,
        messageAr: data?.messageAr || "تعذر حفظ البريد الإلكتروني في قاعدة البيانات حالياً.",
      };
    } catch {
      return {
        ok: false,
        persisted: false,
        messageAr: "تعذر الاتصال بالخادم لحفظ البريد الإلكتروني.",
      };
    }
  };

  const subscribeDemandRadar: CaptenlyContextType["subscribeDemandRadar"] = (entry) => {
    if (!depsRef.current.isAuthenticated) {
      depsRef.current.openAuthGateModal("إرسال طلب توافر منشآت في منطقتك");
      return { ok: false, messageAr: "يرجى تسجيل الدخول أو إنشاء حساب في Captenly أولاً." };
    }
    const submission: DemandRadarSubmission = { id: `sub-${Date.now()}`, ...entry, createdAt: "الآن" };
    setDemandSubmissions((prev) => [submission, ...prev]);
    setDemandRadar((prev) => {
      const idx = prev.findIndex((d) => d.city === entry.city);
      if (idx >= 0) {
        return prev.map((d, i) =>
          i === idx ? { ...d, totalSearchesMonth: d.totalSearchesMonth + 1 } : d
        );
      }
      return [
        {
          city: entry.city,
          governorate: entry.governorate,
          totalSearchesMonth: 1,
          topUnmetFilters: [
            {
              filterTitleAr: "أكاديميات ومسابح سباحة معتمدة",
              searchCount: 1,
              percentage: 100,
              opportunityNoteAr: `طلب جديد مسجل لمدينة ${entry.city}`,
            },
          ],
        },
        ...prev,
      ];
    });
    pushNotification({
      titleAr: entry.targetFacilityNameAr
        ? `طلب توفير أسعار: ${entry.targetFacilityNameAr}`
        : `طلب توسع في ${entry.city}`,
      messageAr: entry.targetFacilityNameAr
        ? `تم تسجيل طلبك لأكاديمية ${entry.targetFacilityNameAr} في رادار الطلب التفاعلي.`
        : `تم حفظ تسجيلك بنجاح في رادار الطلب التفاعلي لمدينة ${entry.city}.`,
      type: "system",
    });
    postSupabaseSync("/api/supabase/demand-radar", { ...entry });
    return {
      ok: true,
      messageAr: entry.targetFacilityNameAr
        ? `تم تسجيل طلبك لتوفير أسعار وتوثيق «${entry.targetFacilityNameAr}»! سنقوم بالتواصل معهم وإشعارك فور التفعيل.`
        : `تم تسجيل طلبك لمدينة ${entry.city} بنجاح! سنبلغك فور تفعيل كابتن أو أكاديمية موثقة في نطاقك.`,
    };
  };

  const createStructuredWhatsappLead: CaptenlyContextType["createStructuredWhatsappLead"] = (
    payload
  ) => {
    const { isAuthenticated, currentPersona: persona, openAuthGateModal, setFacilities } =
      depsRef.current;
    if (!isAuthenticated) {
      openAuthGateModal("التواصل والحجز المباشر مع المنشأة أو الكابتن");
      return { referralCode: "", whatsappUrl: "", isDuplicate30d: false };
    }
    const cleanPhone = payload.inquirerPhone.trim();
    const isDuplicate30d = verifiedLeads.some(
      (l) => l.targetId === payload.targetId && l.inquirerPhone === cleanPhone && cleanPhone !== ""
    );
    const referralCode = `#CAP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLead = {
      id: `lead-${Date.now()}`,
      referralCode,
      targetType: payload.targetType,
      targetId: payload.targetId,
      targetNameAr: payload.targetNameAr,
      inquirerNameAr: payload.inquirerNameAr || "متدرب / ولي أمر عبر كابتنلي",
      inquirerPhone: cleanPhone || "010****",
      athleteAge: payload.athleteAge,
      requestedSpecialtyAr: payload.requestedSpecialtyAr,
      preferredScheduleAr: payload.preferredScheduleAr,
      createdAtAr: "الآن",
      repliedWithin2h: false,
      replyMinutes: undefined,
      convertedToLedger: false,
    };

    if (!isDuplicate30d) {
      setVerifiedLeads((prev) => [newLead, ...prev]);
      if (payload.targetType === "facility") {
        setFacilities((prev) =>
          prev.map((f) =>
            f.id === payload.targetId
              ? {
                  ...f,
                  monthlyMetrics: {
                    ...f.monthlyMetrics,
                    verifiedWhatsappLeads: f.monthlyMetrics.verifiedWhatsappLeads + 1,
                  },
                }
              : f
          )
        );
      }
      postSupabaseSync("/api/supabase/leads", {
        facilityId: payload.targetId,
        facilityNameAr: payload.targetNameAr,
        memberCode: persona.memberCode || undefined,
        memberNameAr: newLead.inquirerNameAr,
        phone: cleanPhone || undefined,
        packageNameAr: payload.requestedSpecialtyAr,
        notes: `السن: ${payload.athleteAge} | الموعد: ${payload.preferredScheduleAr} | كود الإحالة: ${referralCode}`,
      });
    }

    const messageText = `السلام عليكم، شفت صفحة (${payload.targetNameAr}) على منصة كابتنلي (captenly.com) وقارنت الباقات والمواعيد.\nحابب أستفسر عن الاشتراك في: [${payload.requestedSpecialtyAr}]\nللعمر: [${payload.athleteAge} سنة]\nالموعد المفضل: [${payload.preferredScheduleAr}]\nكود عضويتي: [${persona.memberCode || "زائر"}]\n(كود إحالة كابتنلي: ${referralCode})`;
    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    if (!cleanWa) return { referralCode, whatsappUrl: "", isDuplicate30d };
    const formattedWa = cleanWa.startsWith("20")
      ? cleanWa
      : cleanWa.startsWith("0")
        ? `2${cleanWa}`
        : `20${cleanWa}`;
    return {
      referralCode,
      whatsappUrl: `https://wa.me/${formattedWa}?text=${encodeURIComponent(messageText)}`,
      isDuplicate30d,
    };
  };

  const getSkillEvaluationForAthlete = (athleteId?: string): SkillEvaluation5Point => {
    const persona = depsRef.current.currentPersona;
    const targetId = athleteId || persona.id;
    if (skillEvaluationsByAthlete[targetId]) return skillEvaluationsByAthlete[targetId];
    if (targetId === persona.id && skillEvaluation.athleteId === persona.id) return skillEvaluation;
    return {
      athleteId: targetId || "unrated",
      evaluatedDateAr: "",
      coachNameAr: "",
      coachFeedbackAr: "",
      metrics: INITIAL_SKILL_EVALUATION.metrics.map((m) => ({ ...m, score: 0 })),
    };
  };

  const addNewPBRecord: CaptenlyContextType["addNewPBRecord"] = (record) => {
    const newRec: PersonalBestRecord = {
      ...record,
      id: `pb-${Date.now()}`,
      recordedDateAr: "اليوم — مسجل بالحساب",
    };
    setPbRecords((prev) => [newRec, ...prev]);
    const ownerCode = getProfileSyncKey(depsRef.current.currentPersona);
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", { type: "pb", memberCode: ownerCode, pbRecord: newRec });
    }
  };

  const recordCoachSkillAndPB: CaptenlyContextType["recordCoachSkillAndPB"] = (payload) => {
    const { currentPersona: persona, memberRegistry, allPersonas, sessionLedgers } = depsRef.current;
    const targetAthleteId = payload.athleteId || persona.id;
    const previousSame = pbRecords.find(
      (r) =>
        r.eventTitleAr === payload.eventTitleAr &&
        (r.athleteId === targetAthleteId || r.athleteNameAr === payload.swimmerNameAr)
    );
    const newRec: PersonalBestRecord = {
      id: `pb-${Date.now()}`,
      athleteId: targetAthleteId,
      athleteNameAr: payload.swimmerNameAr,
      sportType: "swimming",
      eventTitleAr: payload.eventTitleAr,
      currentValue: payload.currentValue,
      previousValue: previousSame ? previousSame.currentValue : payload.currentValue,
      unitAr: payload.unitAr || "ثانية",
      recordedDateAr: "اليوم — توقيت موثق",
      verificationSource: "coach_reviewed",
      verificationLabelAr: "توقيت موثق من الكابتن",
      coachNameAr: payload.coachNameAr,
      facilityNameAr: payload.facilityNameAr || persona.city,
    };
    setPbRecords((prev) => [newRec, ...prev]);

    const regMember = memberRegistry.find((m) => m.athleteId === targetAthleteId);
    const personaTarget = allPersonas.find((p) => p.id === targetAthleteId);
    const ledgerTarget = sessionLedgers.find((l) => l.athleteId === targetAthleteId);
    const recipientMemberCode =
      regMember?.memberCode ||
      personaTarget?.memberCode ||
      ledgerTarget?.memberCode ||
      getProfileSyncKey(persona);

    if (recipientMemberCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "pb",
        memberCode: recipientMemberCode,
        pbRecord: newRec,
      });
    }
    if (payload.skills) {
      const scopedSkills: SkillEvaluation5Point = { ...payload.skills, athleteId: targetAthleteId };
      setSkillEvaluationsByAthlete((prev) => ({ ...prev, [targetAthleteId]: scopedSkills }));
      if (targetAthleteId === persona.id) setSkillEvaluation(scopedSkills);
      if (recipientMemberCode) {
        postSupabaseSync("/api/supabase/user-state", {
          type: "skill_eval",
          memberCode: recipientMemberCode,
          skillEvaluation: scopedSkills,
        });
      }
    }
    pushNotification({
      targetMemberCode: recipientMemberCode || undefined,
      titleAr: `تقييم ورقم قياسي جديد (${payload.eventTitleAr})`,
      messageAr: `سجّل كابتن ${payload.coachNameAr} للسباح ${payload.swimmerNameAr} زمناً قدره ${payload.currentValue} ${payload.unitAr || "ثانية"}.`,
      type: "passport_badge",
      actionLabelAr: "عرض تحليل الأداء",
      actionHref: "/dashboard/athlete",
    });
  };

  const addMinorAthlete: CaptenlyContextType["addMinorAthlete"] = (child) => {
    const { currentPersona: persona, setCurrentPersona, setMemberRegistry } = depsRef.current;
    const ownerCode = getProfileSyncKey(persona);
    const parentMemberCode = persona.memberCode || ownerCode || "";
    const existingCodes = new Set(
      minorAthletes.map((m) => (m.childMemberCode || "").toUpperCase()).filter(Boolean)
    );
    let seq = minorAthletes.length + 1;
    let childSubCode = generateChildSubCode(parentMemberCode, seq);
    while (existingCodes.has(childSubCode.toUpperCase()) && seq < 99) {
      seq += 1;
      childSubCode = generateChildSubCode(parentMemberCode, seq);
    }
    const newChild: MinorAthleteProfile = {
      id: `athlete-${Date.now()}`,
      childMemberCode: childSubCode,
      parentMemberCode: parentMemberCode || undefined,
      fullNameAr: child.fullNameAr,
      age: child.age,
      birthYear: 2026 - child.age,
      gender: child.gender,
      primarySport: "swimming",
      currentStarLevel: 0,
      starTitleAr: "",
      isPrivateByDefault: true,
      parentConsentVerified: true,
      activeCoachNameAr: "",
      activeFacilityNameAr: "",
    };
    setMinorAthletes((prev) => [...prev, newChild]);
    setMemberRegistry((prev) => [
      {
        memberCode: childSubCode,
        childMemberCode: childSubCode,
        parentMemberCode: parentMemberCode || undefined,
        athleteId: newChild.id,
        fullNameAr: child.fullNameAr,
        phone: persona.phone,
        city: persona.city,
        role: "adult_athlete",
        isMinor: true,
        parentNameAr: persona.fullNameAr,
        hasParentSupervision: true,
      },
      ...prev.filter((m) => m.memberCode !== childSubCode),
    ]);
    setCurrentPersona((prev) => ({
      ...prev,
      hasParentSupervision: true,
      accountIntent:
        prev.accountIntent === "self_athlete" || prev.accountIntent === "both_self_and_parent"
          ? "both_self_and_parent"
          : prev.accountIntent || "parent_only",
    }));
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "minor_upsert",
        memberCode: ownerCode,
        minorAthlete: newChild,
      });
    }
  };

  const updateMinorAthlete: CaptenlyContextType["updateMinorAthlete"] = (childId, patch) => {
    const ownerCode = getProfileSyncKey(depsRef.current.currentPersona);
    setMinorAthletes((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        const nextAge = patch.age !== undefined ? patch.age : c.age;
        const updated: MinorAthleteProfile = { ...c, ...patch, birthYear: 2026 - nextAge };
        if (ownerCode) {
          postSupabaseSync("/api/supabase/user-state", {
            type: "minor_upsert",
            memberCode: ownerCode,
            minorAthlete: updated,
          });
        }
        return updated;
      })
    );
  };

  const removeMinorAthlete = (childId: string) => {
    setMinorAthletes((prev) => prev.filter((c) => c.id !== childId));
    const ownerCode = getProfileSyncKey(depsRef.current.currentPersona);
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "minor_delete",
        memberCode: ownerCode,
        minorId: childId,
      });
    }
  };

  return {
    minorAthletes,
    setMinorAthletes,
    pbRecords,
    setPbRecords,
    skillEvaluation,
    setSkillEvaluation,
    skillEvaluationsByAthlete,
    setSkillEvaluationsByAthlete,
    verifiedLeads,
    setVerifiedLeads,
    demandRadar,
    setDemandRadar,
    demandSubmissions,
    setDemandSubmissions,
    notifications,
    setNotifications,
    userSettings,
    setUserSettings,
    newsletterEmails,
    setNewsletterEmails,
    persistPrefsToRemote,
    pushNotification,
    markNotificationAsRead,
    unreadNotificationsCount,
    updateUserSettings,
    subscribeNewsletter,
    subscribeNewsletterAsync,
    subscribeDemandRadar,
    createStructuredWhatsappLead,
    getSkillEvaluationForAthlete,
    addNewPBRecord,
    recordCoachSkillAndPB,
    addMinorAthlete,
    updateMinorAthlete,
    removeMinorAthlete,
  };
}
