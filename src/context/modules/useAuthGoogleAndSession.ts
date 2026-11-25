"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";
import type { MemberRegistryEntry, PersonaAccount } from "@/types/captenly";
import { GUEST_PERSONA, PERSONA_ACCOUNTS } from "@/data/seedData";
import { buildSelfRegisteredCoach, getDeterministicCoachId } from "@/lib/coachProvisioning";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import {
  buildRoleTitleMap,
  generateDeterministicEmailMemberCode,
  getDefaultWorkspaceContextForPersona,
  getProfileSyncKey,
  resolveMemberRoleAndIntent,
} from "./storageHelpers";
import type {
  AccountActivitySnapshot,
  AuthDomainDeps,
  CaptenlyContextType,
  RemoteProfilePayload,
} from "./types";

export function createAuthSessionActions({
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
}: {
  allPersonas: PersonaAccount[];
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  isAuthenticated: boolean;
  setMemberRegistry: React.Dispatch<React.SetStateAction<MemberRegistryEntry[]>>;
  setAccountSnapshots: React.Dispatch<React.SetStateAction<Record<string, AccountActivitySnapshot>>>;
  clearSnapshotKeys: (p: Pick<PersonaAccount, "memberCode" | "email">) => void;
  upsertSnapshotForCurrentUser: () => void;
  resetMemberActivityState: (resetLocation?: boolean) => void;
  applyAccountSnapshotForPersona: (
    p: Pick<PersonaAccount, "memberCode" | "email" | "city">,
    governorate?: string
  ) => boolean;
  depsRef: React.MutableRefObject<AuthDomainDeps>;
}) {
  const hydratePersonaFromRemoteProfile = (remote: RemoteProfilePayload): PersonaAccount => {
    const firstName = remote.fullNameAr.split(" ")[0] || "عضو";
    const isPendingOnboarding = Boolean(remote.needsOnboarding);
    const effectiveRole: PersonaAccount["role"] = isPendingOnboarding
      ? "adult_athlete"
      : remote.role || "adult_athlete";
    const cleanCode = remote.memberCode || "";
    const resolvedLinkedFac = isPendingOnboarding ? undefined : remote.linkedFacilityId || undefined;
    const resolvedLinkedCoach = isPendingOnboarding
      ? undefined
      : remote.linkedCoachId ||
        (effectiveRole === "coach" && cleanCode ? getDeterministicCoachId(cleanCode) : undefined);

    const roleTitles = buildRoleTitleMap(cleanCode);
    const existing = allPersonas.find(
      (p) =>
        (remote.email && p.email?.toLowerCase() === remote.email.toLowerCase()) ||
        (cleanCode && p.memberCode?.toUpperCase() === cleanCode.toUpperCase())
    );

    const persona: PersonaAccount = {
      id:
        existing?.id ||
        (remote.authProvider === "google" && remote.email
          ? `google-${remote.email.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
          : `user-${remote.dbProfileKey || remote.id || Date.now()}`),
      role: effectiveRole,
      accountIntent: isPendingOnboarding
        ? remote.accountIntent
        : remote.accountIntent ?? existing?.accountIntent,
      memberCode: cleanCode,
      hasParentSupervision: Boolean(remote.hasParentSupervision),
      avatarUrl: isPendingOnboarding
        ? remote.avatarUrl || undefined
        : remote.avatarUrl || existing?.avatarUrl || undefined,
      email: remote.email || existing?.email,
      authProvider: remote.authProvider || existing?.authProvider || "phone",
      needsOnboarding: isPendingOnboarding,
      shortLabelAr:
        effectiveRole === "facility_manager"
          ? `إدارة (${firstName})`
          : cleanCode
            ? `${firstName} (${cleanCode})`
            : firstName,
      fullNameAr: remote.fullNameAr,
      personaTitleAr: roleTitles[effectiveRole] || roleTitles.adult_athlete,
      city: remote.city || "كل مصر",
      phone: isPendingOnboarding ? remote.phone || "" : remote.phone || existing?.phone || "",
      bioAr: isPendingOnboarding ? remote.bioAr : remote.bioAr ?? existing?.bioAr,
      socialLinks: isPendingOnboarding
        ? remote.socialLinks
        : remote.socialLinks ?? existing?.socialLinks,
      linkedFacilityId: resolvedLinkedFac,
      linkedCoachId: resolvedLinkedCoach,
      descriptionAr: isPendingOnboarding
        ? "حساب جديد بانتظار استكمال اختيار نوع الحساب."
        : existing?.descriptionAr ||
          "حساب محفوظ ومزامن عبر كابتنلي لاستعادة كافة البيانات عبر الأجهزة.",
    };

    const isSwitchingPersona = currentPersona.id !== persona.id;
    setAllPersonas((prev) => [
      persona,
      ...prev.filter(
        (p) => p.id !== persona.id && (!persona.email || p.email?.toLowerCase() !== persona.email.toLowerCase())
      ),
    ]);
    if (isPendingOnboarding) {
      clearSnapshotKeys(persona);
      resetMemberActivityState(true);
    } else if (isSwitchingPersona) {
      applyAccountSnapshotForPersona(persona, remote.governorate || "مصر");
    }
    setCurrentPersona(persona);
    depsRef.current.setActiveStaffAssignmentId(null);
    depsRef.current.setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(persona));

    if (!isPendingOnboarding && persona.role === "coach") {
      depsRef.current.setCoaches((prev) => {
        const existingCoach = prev.find(
          (c) =>
            (resolvedLinkedCoach && c.id === resolvedLinkedCoach) ||
            (cleanCode && c.SingleCoachId?.toUpperCase() === cleanCode.toUpperCase())
        );
        const nextCoach = buildSelfRegisteredCoach(
          persona,
          existingCoach,
          remote.governorate || resolveGovernorateFromCity(persona.city, "مصر")
        );
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    if (cleanCode) {
      setMemberRegistry((prev) =>
        prev.some((m) => m.memberCode.toUpperCase() === cleanCode.toUpperCase())
          ? prev
          : [
              {
                memberCode: cleanCode,
                athleteId: persona.id,
                fullNameAr: persona.fullNameAr,
                phone: persona.phone,
                city: persona.city,
                role: persona.role === "parent" ? "parent" : "adult_athlete",
                isMinor: false,
              },
              ...prev,
            ]
      );
    }

    if (!isPendingOnboarding && (cleanCode || persona.linkedFacilityId || persona.linkedCoachId)) {
      depsRef.current
        .lookupRemoteLedgersOrProfile({
          memberCode: cleanCode || undefined,
          coachId: persona.linkedCoachId || (persona.role === "coach" ? persona.id : undefined),
          facilityId: persona.linkedFacilityId || undefined,
        })
        .catch(() => undefined);
    }

    return persona;
  };

  const loginOrCreateWithGoogle: CaptenlyContextType["loginOrCreateWithGoogle"] = (payload) => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim() || cleanEmail.split("@")[0] || "عضو كابتنلي";
    if (payload.isSimulatedPreview) {
      return { ok: false, isNewUser: false, persona: GUEST_PERSONA, memberCode: "" };
    }
    const memberCode = generateDeterministicEmailMemberCode(cleanEmail);
    const newId = `google-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`;
    const firstName = cleanName.split(" ")[0];
    const newPersona: PersonaAccount = {
      id: newId,
      role: "adult_athlete",
      memberCode,
      hasParentSupervision: false,
      avatarUrl: payload.image || undefined,
      email: cleanEmail,
      authProvider: "google",
      needsOnboarding: true,
      shortLabelAr: `${firstName} (${memberCode})`,
      fullNameAr: cleanName,
      personaTitleAr: `رياضي مسجّل عبر Google — كود ${memberCode}`,
      city: "كل مصر",
      phone: "",
      descriptionAr: `حساب موثّق عبر Google (${cleanEmail}).`,
    };
    clearSnapshotKeys(newPersona);
    resetMemberActivityState(true);
    setAllPersonas((prev) => [
      newPersona,
      ...prev.filter((p) => p.id !== newId && p.email?.toLowerCase() !== cleanEmail),
    ]);
    setCurrentPersona(newPersona);
    depsRef.current.setActiveStaffAssignmentId(null);
    depsRef.current.setActiveWorkspaceContextState("member");
    setMemberRegistry((prev) => [
      {
        memberCode,
        athleteId: newId,
        fullNameAr: cleanName,
        phone: "",
        city: "كل مصر",
        role: "adult_athlete",
        isMinor: false,
      },
      ...prev.filter((m) => m.athleteId !== newId),
    ]);
    return { ok: true, isNewUser: true, persona: newPersona, memberCode };
  };

  const restoreOrLoginWithGoogle: CaptenlyContextType["restoreOrLoginWithGoogle"] = async (
    payload
  ) => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim() || cleanEmail.split("@")[0] || "عضو كابتنلي";
    if (payload.isSimulatedPreview) {
      return { ok: false, isNewUser: false, persona: GUEST_PERSONA, memberCode: "" };
    }
    try {
      const authRes = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "google_login",
          fullNameAr: cleanName,
          avatarUrl: payload.image || undefined,
        }),
      });
      if (authRes.status === 401 || authRes.status === 403) {
        return { ok: false, isNewUser: false, persona: GUEST_PERSONA, memberCode: "" };
      }
      if (authRes.ok) {
        const authData = await authRes.json().catch(() => null);
        if (authData?.ok && authData?.profile) {
          const restored = hydratePersonaFromRemoteProfile({
            ...authData.profile,
            needsOnboarding: Boolean(authData.profile.needsOnboarding),
            avatarUrl: authData.profile.avatarUrl || payload.image || undefined,
            authProvider: "google",
          });
          return {
            ok: true,
            isNewUser: Boolean(authData.isNewUser) || Boolean(authData.profile.needsOnboarding),
            persona: restored,
            memberCode: restored.memberCode || "",
          };
        }
      }
    } catch {
      // Do not mint local privileged session when OAuth cannot be verified
    }
    return { ok: false, isNewUser: false, persona: GUEST_PERSONA, memberCode: "" };
  };

  const completeGoogleOnboarding: CaptenlyContextType["completeGoogleOnboarding"] = async (
    payload
  ) => {
    const cleanPhone = (payload.phone ?? currentPersona.phone ?? "").trim();
    const rawCity = (payload.city ?? currentPersona.city ?? "كل مصر").trim();
    const cleanCity = !rawCity || rawCity === "مصر" ? "كل مصر" : rawCity;
    const cleanGov = resolveGovernorateFromCity(cleanCity, "مصر");
    const firstName = currentPersona.fullNameAr.split(" ")[0];
    const existingSuffix = (currentPersona.memberCode || "").split("-").pop();
    const validDigits = /^\d{4}$/.test(existingSuffix || "")
      ? existingSuffix
      : String(Math.floor(1000 + Math.random() * 8999));

    const keepElevatedRole =
      !currentPersona.needsOnboarding &&
      (currentPersona.role === "coach" ||
        currentPersona.role === "facility_manager" ||
        currentPersona.role === "super_admin");
    const resolved = resolveMemberRoleAndIntent(
      payload.role,
      Boolean(payload.hasParentSupervision),
      payload.accountIntent
    );
    const chosenRole = keepElevatedRole ? currentPersona.role : resolved.chosenRole;
    const nextCode =
      currentPersona.memberCode && /^CAP-M-\d+/i.test(currentPersona.memberCode)
        ? currentPersona.memberCode
        : `CAP-M-${validDigits}`;
    const nextLinkedCoachId =
      chosenRole === "coach"
        ? currentPersona.linkedCoachId || getDeterministicCoachId(nextCode)
        : currentPersona.linkedCoachId;
    const roleTitleMap = buildRoleTitleMap(nextCode);

    const updatedPersona: PersonaAccount = {
      ...currentPersona,
      role: chosenRole,
      accountIntent: resolved.resolvedIntent,
      memberCode: nextCode,
      linkedCoachId: nextLinkedCoachId,
      phone: cleanPhone,
      city: cleanCity,
      hasParentSupervision: chosenRole === "parent" ? true : Boolean(payload.hasParentSupervision),
      needsOnboarding: false,
      shortLabelAr: `${firstName} (${nextCode})`,
      personaTitleAr: roleTitleMap[chosenRole],
    };

    let syncedData: {
      memberCode?: string;
      role?: PersonaAccount["role"];
      linkedCoachId?: string;
      linkedFacilityId?: string;
    } | null = null;
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/supabase/sync-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberCode: nextCode,
            email: updatedPersona.email,
            fullNameAr: updatedPersona.fullNameAr,
            role: updatedPersona.role,
            accountIntent: resolved.resolvedIntent,
            phone: updatedPersona.phone,
            city: updatedPersona.city,
            governorate: cleanGov,
            avatarUrl: updatedPersona.avatarUrl,
            authProvider: updatedPersona.authProvider || "google",
            hasParentSupervision: updatedPersona.hasParentSupervision,
            needsOnboarding: false,
            linkedFacilityId: updatedPersona.linkedFacilityId,
            linkedCoachId: updatedPersona.linkedCoachId,
          }),
        });
        if (res.ok) syncedData = await res.json().catch(() => null);
      } catch {
        // Offline fallback
      }
    }

    const finalCode = syncedData?.memberCode || nextCode;
    const finalRole = syncedData?.role || chosenRole;
    const finalLinkedCoachId =
      syncedData?.linkedCoachId ||
      (finalRole === "coach"
        ? nextLinkedCoachId || getDeterministicCoachId(finalCode)
        : updatedPersona.linkedCoachId);
    const finalPersona: PersonaAccount = {
      ...updatedPersona,
      memberCode: finalCode,
      role: finalRole,
      linkedCoachId: finalLinkedCoachId,
      linkedFacilityId: syncedData?.linkedFacilityId ?? updatedPersona.linkedFacilityId,
      shortLabelAr: `${firstName} (${finalCode})`,
      personaTitleAr: buildRoleTitleMap(finalCode)[finalRole] || roleTitleMap[chosenRole],
    };
    const nextPath =
      finalRole === "coach"
        ? "/dashboard/coach"
        : finalRole === "facility_manager"
          ? "/claim"
          : "/dashboard/athlete";

    setCurrentPersona(finalPersona);
    setAllPersonas((prev) => prev.map((p) => (p.id === currentPersona.id ? finalPersona : p)));
    depsRef.current.setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(finalPersona));
    depsRef.current.applyAccountCityToUserLocation(cleanCity, cleanGov);

    if (finalRole === "coach") {
      depsRef.current.setCoaches((prev) => {
        const existingCoach = prev.find(
          (c) =>
            (finalLinkedCoachId && c.id === finalLinkedCoachId) ||
            c.SingleCoachId?.toUpperCase() === finalCode.toUpperCase()
        );
        const nextCoach = buildSelfRegisteredCoach(finalPersona, existingCoach, cleanGov);
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    setMemberRegistry((prev) => {
      const regRole = finalRole === "parent" ? "parent" : "adult_athlete";
      if (prev.some((m) => m.athleteId === currentPersona.id)) {
        return prev.map((m) =>
          m.athleteId === currentPersona.id
            ? { ...m, memberCode: finalCode, phone: cleanPhone, city: cleanCity, role: regRole }
            : m
        );
      }
      return [
        {
          memberCode: finalCode,
          athleteId: currentPersona.id,
          fullNameAr: currentPersona.fullNameAr,
          phone: cleanPhone,
          city: cleanCity,
          role: regRole,
          isMinor: false,
        },
        ...prev,
      ];
    });

    return { ok: true, persona: finalPersona, nextPath };
  };

  const signOutToGuest = () => {
    const d = depsRef.current;
    if (isAuthenticated) {
      upsertSnapshotForCurrentUser();
      const syncCode = getProfileSyncKey(currentPersona);
      if (syncCode) {
        d.persistPrefsToRemote(
          {
            favorites: d.savedFavoriteIds,
            compareIds: d.compareFacilityIds,
            userSettings: d.userSettings as unknown as Record<string, unknown>,
            userLocation: d.userLocation as unknown as Record<string, unknown>,
          },
          syncCode
        );
      }
    }
    if (typeof window !== "undefined") {
      fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => {});
      nextAuthSignOut({ redirect: false }).catch(() => {});
    }
    const guest =
      allPersonas.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS[0];
    setCurrentPersona(guest);
    d.setActiveStaffAssignmentId(null);
    d.setActiveWorkspaceContextState("member");
    d.setRoleClaims([]);
    resetMemberActivityState(true);
  };

  const deleteCurrentAccount: CaptenlyContextType["deleteCurrentAccount"] = async () => {
    const d = depsRef.current;
    const targetPersona = currentPersona;
    const targetCode = (targetPersona.memberCode || "").trim().toUpperCase();
    const targetEmail = (targetPersona.email || "").trim().toLowerCase();
    const targetId = targetPersona.id;
    const childIds = new Set(d.minorAthletes.map((m) => m.id));

    let serverOk = true;
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/auth/member-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_account",
            memberCode: targetCode || undefined,
            email: targetEmail || undefined,
            athleteId: targetId,
          }),
        });
        if (!res.ok && res.status !== 401 && res.status !== 503) serverOk = false;
      } catch {
        // Proceed with local cleanup
      }
      nextAuthSignOut({ redirect: false }).catch(() => {});
    }

    clearSnapshotKeys(targetPersona);
    setAllPersonas((prev) =>
      prev.filter(
        (p) =>
          p.id !== targetId &&
          (!targetCode || (p.memberCode || "").toUpperCase() !== targetCode) &&
          (!targetEmail || (p.email || "").toLowerCase() !== targetEmail)
      )
    );
    setMemberRegistry((prev) =>
      prev.filter(
        (m) => m.athleteId !== targetId && (!targetCode || m.memberCode.toUpperCase() !== targetCode)
      )
    );
    d.setSessionLedgers((prev) =>
      prev.filter(
        (l) =>
          l.athleteId !== targetId &&
          !childIds.has(l.athleteId) &&
          (!targetCode || (l.memberCode || "").toUpperCase() !== targetCode)
      )
    );
    const deletedCoachId =
      targetPersona.linkedCoachId || (targetCode ? getDeterministicCoachId(targetCode) : "");
    d.setCoaches((prev) =>
      prev.filter(
        (c) =>
          (!deletedCoachId || c.id !== deletedCoachId) &&
          (!targetCode || (c.SingleCoachId || "").toUpperCase() !== targetCode)
      )
    );

    const guest = PERSONA_ACCOUNTS.find((p) => p.role === "guest") || GUEST_PERSONA;
    setCurrentPersona(guest);
    d.setActiveStaffAssignmentId(null);
    d.setActiveWorkspaceContextState("member");
    d.setRoleClaims([]);
    resetMemberActivityState(true);
    setAccountSnapshots((prev) => prev);
    return { ok: serverOk };
  };

  const switchPersona = (personaId: string) => {
    const target = allPersonas.find((p) => p.id === personaId);
    if (!target) return;
    if (target.id !== currentPersona.id) {
      if (target.role === "guest") resetMemberActivityState(true);
      else applyAccountSnapshotForPersona(target);
    }
    setCurrentPersona(target);
    depsRef.current.setActiveStaffAssignmentId(null);
    depsRef.current.setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(target));
  };

  return {
    hydratePersonaFromRemoteProfile,
    loginOrCreateWithGoogle,
    restoreOrLoginWithGoogle,
    completeGoogleOnboarding,
    signOutToGuest,
    deleteCurrentAccount,
    switchPersona,
  };
}
