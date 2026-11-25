"use client";

import { useRef, useState } from "react";
import type { MemberRegistryEntry, PersonaAccount } from "@/types/captenly";
import {
  GUEST_PERSONA,
  INITIAL_MEMBER_REGISTRY,
  INITIAL_SKILL_EVALUATION,
  PERSONA_ACCOUNTS,
} from "@/data/seedData";
import { buildSelfRegisteredCoach, getDeterministicCoachId } from "@/lib/coachProvisioning";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import {
  buildRoleTitleMap,
  DEFAULT_EGYPT_LOCATION,
  DEFAULT_USER_SETTINGS,
  findAccountSnapshot,
  getAccountSnapshotKeys,
  getDefaultWorkspaceContextForPersona,
  postSupabaseSync,
  readSnapshotPoolFallback,
  resolveMemberRoleAndIntent,
} from "./storageHelpers";
import type {
  AccountActivitySnapshot,
  AuthDomainDeps,
  CaptenlyContextType,
} from "./types";
import { createAuthProfileMutators, useAuthRemoteProfileSync } from "./useAuthProfileSync";
import { createAuthSessionActions } from "./useAuthGoogleAndSession";

export type { AuthDomainDeps } from "./types";

export function useAuthDomain({
  depsRef,
}: {
  depsRef: React.MutableRefObject<AuthDomainDeps>;
}) {
  const [allPersonas, setAllPersonas] = useState<PersonaAccount[]>(PERSONA_ACCOUNTS);
  const [currentPersona, setCurrentPersona] = useState<PersonaAccount>(GUEST_PERSONA);
  const [authGateModalOpen, setAuthGateModalOpen] = useState<boolean>(false);
  const [authGateFeatureNameAr, setAuthGateFeatureNameAr] = useState<string>("");
  const [memberRegistry, setMemberRegistry] =
    useState<MemberRegistryEntry[]>(INITIAL_MEMBER_REGISTRY);
  const [accountSnapshots, setAccountSnapshots] = useState<
    Record<string, AccountActivitySnapshot>
  >({});
  const avatarSaveSeqRef = useRef(0);

  const isAuthenticated =
    currentPersona.role !== "guest" && currentPersona.id !== "persona-guest";
  const openAuthGateModal = (featureNameAr = "استخدام هذه الميزة") => {
    setAuthGateFeatureNameAr(featureNameAr);
    setAuthGateModalOpen(true);
  };
  const closeAuthGateModal = () => setAuthGateModalOpen(false);

  const resetMemberActivityState = (resetLocation = true) => {
    const d = depsRef.current;
    d.setSavedFavoriteIds([]);
    d.setCompareFacilityIds([]);
    d.setMinorAthletes([]);
    d.setPbRecords([]);
    d.setSkillEvaluationsByAthlete({});
    d.setSkillEvaluation(INITIAL_SKILL_EVALUATION);
    d.setNotifications([]);
    d.setVerifiedLeads([]);
    d.setUserSettings(DEFAULT_USER_SETTINGS);
    if (resetLocation) d.setUserLocation(DEFAULT_EGYPT_LOCATION);
  };

  const clearSnapshotKeys = (persona: Pick<PersonaAccount, "memberCode" | "email">) => {
    const keys = getAccountSnapshotKeys(persona);
    if (keys.length === 0) return;
    setAccountSnapshots((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  const upsertSnapshotForCurrentUser = () => {
    const d = depsRef.current;
    const keys = getAccountSnapshotKeys(currentPersona);
    if (keys.length === 0) return;
    const snap: AccountActivitySnapshot = {
      savedFavoriteIds: d.savedFavoriteIds,
      compareFacilityIds: d.compareFacilityIds,
      minorAthletes: d.minorAthletes,
      pbRecords: d.pbRecords,
      skillEvaluationsByAthlete: d.skillEvaluationsByAthlete,
      notifications: d.notifications,
      userSettings: d.userSettings,
      userLocation: d.userLocation.isSpecified ? d.userLocation : undefined,
    };
    setAccountSnapshots((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = snap;
      return next;
    });
  };

  const applyAccountSnapshotForPersona = (
    persona: Pick<PersonaAccount, "memberCode" | "email" | "city">,
    governorate = "مصر"
  ) => {
    const d = depsRef.current;
    const snap = findAccountSnapshot(readSnapshotPoolFallback(accountSnapshots), persona);
    if (snap) {
      d.setSavedFavoriteIds(snap.savedFavoriteIds || []);
      d.setCompareFacilityIds(snap.compareFacilityIds || []);
      d.setMinorAthletes(snap.minorAthletes || []);
      d.setPbRecords(snap.pbRecords || []);
      d.setSkillEvaluationsByAthlete(snap.skillEvaluationsByAthlete || {});
      d.setNotifications(snap.notifications || []);
      d.setUserSettings(
        snap.userSettings ? { ...DEFAULT_USER_SETTINGS, ...snap.userSettings } : DEFAULT_USER_SETTINGS
      );
      if (snap.userLocation?.isSpecified) {
        d.setUserLocation(snap.userLocation);
      } else {
        d.applyAccountCityToUserLocation(persona.city, governorate);
      }
      return true;
    }
    resetMemberActivityState(false);
    d.applyAccountCityToUserLocation(persona.city, governorate);
    return false;
  };

  useAuthRemoteProfileSync({
    isAuthenticated,
    currentPersona,
    setCurrentPersona,
    setAllPersonas,
    avatarSaveSeqRef,
    depsRef,
  });

  const sessionActions = createAuthSessionActions({
    allPersonas,
    setAllPersonas,
    currentPersona,
    setCurrentPersona,
    isAuthenticated,
    setMemberRegistry,
    setAccountSnapshots,
    clearSnapshotKeys,
    upsertSnapshotForCurrentUser,
    resetMemberActivityState,
    applyAccountSnapshotForPersona,
    depsRef,
  });

  const profileMutators = createAuthProfileMutators({
    currentPersona,
    setCurrentPersona,
    setAllPersonas,
    avatarSaveSeqRef,
    depsRef,
  });

  const registerMemberUser: CaptenlyContextType["registerMemberUser"] = (payload) => {
    const memberCode = `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`;
    const { chosenRole, resolvedIntent, nextPath } = resolveMemberRoleAndIntent(
      payload.role,
      payload.hasParentSupervision,
      payload.accountIntent
    );
    const newId = `user-${Date.now()}`;
    const firstName = payload.fullNameAr.split(" ")[0];
    const linkedCoachId = chosenRole === "coach" ? getDeterministicCoachId(memberCode) : undefined;
    const roleTitleMap = buildRoleTitleMap(memberCode);

    const newPersona: PersonaAccount = {
      id: newId,
      role: chosenRole,
      accountIntent: resolvedIntent,
      memberCode,
      linkedCoachId,
      hasParentSupervision: chosenRole === "parent" || payload.hasParentSupervision,
      shortLabelAr: `${firstName} (${memberCode})`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr: roleTitleMap[chosenRole],
      city: payload.city || "كل مصر",
      phone: payload.phone,
      descriptionAr: "حساب موحد مفعّل بكود عضوية فريد جاهز لمتابعة كافة أنشطتك على كابتنلي.",
    };

    setAllPersonas((prev) => [newPersona, ...prev]);
    applyAccountSnapshotForPersona(newPersona, payload.governorate || "مصر");
    setCurrentPersona(newPersona);
    depsRef.current.setActiveStaffAssignmentId(null);
    depsRef.current.setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(newPersona));

    if (chosenRole === "coach") {
      depsRef.current.setCoaches((prev) => {
        const nextCoach = buildSelfRegisteredCoach(newPersona, undefined, payload.governorate || "مصر");
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    setMemberRegistry((prev) => [
      {
        memberCode,
        athleteId: newId,
        fullNameAr: payload.fullNameAr,
        phone: payload.phone,
        city: payload.city || "كل مصر",
        role: chosenRole === "parent" ? "parent" : "adult_athlete",
        isMinor: false,
      },
      ...prev,
    ]);

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode,
      fullNameAr: payload.fullNameAr,
      role: chosenRole,
      accountIntent: resolvedIntent,
      phone: payload.phone,
      city: payload.city || "كل مصر",
      governorate: payload.governorate || "مصر",
      authProvider: "captenly",
      hasParentSupervision: newPersona.hasParentSupervision,
      needsOnboarding: false,
      linkedCoachId,
    });

    return { ok: true, persona: newPersona, memberCode, nextPath };
  };

  const registerMemberWithCredentials: CaptenlyContextType["registerMemberWithCredentials"] = async (
    payload
  ) => {
    const cleanName = payload.fullNameAr.trim();
    const cleanPhone = payload.phone.trim();
    const cleanEmail = payload.email?.trim().toLowerCase() || undefined;
    if (!cleanName || payload.password.length < 6) {
      return { ok: false, messageAr: "يرجى إدخال الاسم بالكامل وكلمة مرور لا تقل عن 6 أحرف." };
    }
    const dbMemberCode = `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`;
    const { chosenRole, resolvedIntent, nextPath } = resolveMemberRoleAndIntent(
      payload.role,
      payload.hasParentSupervision,
      payload.accountIntent
    );
    const cleanCity = (payload.city || "").trim() || "كل مصر";
    const cleanGov = resolveGovernorateFromCity(cleanCity, payload.governorate || "مصر");

    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          memberCode: dbMemberCode,
          fullNameAr: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          password: payload.password,
          city: cleanCity,
          governorate: cleanGov,
          sportPreference: payload.sportPreference,
          hasParentSupervision: chosenRole === "parent" || payload.hasParentSupervision,
          role: chosenRole,
          accountIntent: resolvedIntent,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.profile) {
        return {
          ok: false,
          messageAr:
            data?.messageAr ||
            "تعذر إتمام التسجيل في قاعدة البيانات حالياً. تأكد من عدم تكرار رقم الهاتف أو البريد الإلكتروني.",
        };
      }
      const persistedPersona = sessionActions.hydratePersonaFromRemoteProfile({
        ...data.profile,
        memberCode: data.profile.memberCode || dbMemberCode,
        accountIntent: resolvedIntent,
        needsOnboarding: false,
      });
      return {
        ok: true,
        persona: persistedPersona,
        memberCode: persistedPersona.memberCode || dbMemberCode,
        nextPath,
      };
    } catch {
      return {
        ok: false,
        messageAr: "تعذر الاتصال بالخادم لتسجيل الحساب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.",
      };
    }
  };

  const restoreProfileByLogin: CaptenlyContextType["restoreProfileByLogin"] = async (
    query,
    password = ""
  ) => {
    const clean = query.trim();
    if (!clean) {
      return { ok: false, messageAr: "يرجى إدخال كود العضوية أو رقم الموبايل أو البريد الإلكتروني." };
    }
    if (!password) return { ok: false, messageAr: "يرجى إدخال كلمة المرور للمتابعة." };
    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", query: clean, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.profile) {
        return { ok: true, persona: sessionActions.hydratePersonaFromRemoteProfile(data.profile) };
      }
      return { ok: false, messageAr: data?.messageAr || "بيانات الدخول غير صحيحة أو الحساب غير موجود." };
    } catch {
      return {
        ok: false,
        messageAr: "تعذر الاتصال بالخادم للتحقق من كلمة المرور. يرجى المحاولة مجدداً.",
      };
    }
  };

  return {
    allPersonas,
    setAllPersonas,
    currentPersona,
    setCurrentPersona,
    isAuthenticated,
    authGateModalOpen,
    authGateFeatureNameAr,
    openAuthGateModal,
    closeAuthGateModal,
    memberRegistry,
    setMemberRegistry,
    accountSnapshots,
    setAccountSnapshots,
    upsertSnapshotForCurrentUser,
    registerMemberUser,
    registerMemberWithCredentials,
    restoreProfileByLogin,
    ...sessionActions,
    ...profileMutators,
  };
}
