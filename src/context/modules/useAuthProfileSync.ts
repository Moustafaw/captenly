"use client";

import { useEffect } from "react";
import type { AccountIntent, Coach, Facility, PersonaAccount, UserSocialLinks } from "@/types/captenly";
import { PROHIBITED_MEDICAL_KEYWORDS } from "@/data/seedData";
import { buildSelfRegisteredCoach, getDeterministicCoachId } from "@/lib/coachProvisioning";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import { getProfileSyncKey, postSupabaseSync } from "./storageHelpers";
import type { AuthDomainDeps, CaptenlyContextType } from "./types";

export function useAuthRemoteProfileSync({
  isAuthenticated,
  currentPersona,
  setCurrentPersona,
  setAllPersonas,
  avatarSaveSeqRef,
  depsRef,
}: {
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  avatarSaveSeqRef: React.MutableRefObject<number>;
  depsRef: React.MutableRefObject<AuthDomainDeps>;
}) {
  useEffect(() => {
    if (!isAuthenticated || currentPersona.needsOnboarding) {
      if (!isAuthenticated) depsRef.current.setRoleClaims([]);
      return;
    }
    let cancelled = false;
    const reqSeq = avatarSaveSeqRef.current;
    depsRef.current.refreshRoleClaims(false).catch(() => undefined);

    const profileKey = getProfileSyncKey(currentPersona);
    if (profileKey || currentPersona.email) {
      const qs = new URLSearchParams();
      if (profileKey) qs.set("memberCode", profileKey);
      if (currentPersona.email) qs.set("email", currentPersona.email);
      fetch(`/api/supabase/sync-profile?${qs.toString()}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.found || !data?.profile) return;
          const remote = data.profile as {
            role?: PersonaAccount["role"];
            linkedFacilityId?: string;
            linkedCoachId?: string;
            accountIntent?: AccountIntent;
            memberCode?: string;
            fullNameAr?: string;
            phone?: string;
            city?: string;
            avatarUrl?: string;
            bioAr?: string;
            socialLinks?: UserSocialLinks;
            hasParentSupervision?: boolean;
            needsOnboarding?: boolean;
          };
          const canApplyAvatar = reqSeq === avatarSaveSeqRef.current && Boolean(remote.avatarUrl);
          const mergeRemoteIntoPersona = (prev: PersonaAccount): PersonaAccount => ({
            ...prev,
            role: remote.role || prev.role,
            linkedFacilityId: remote.linkedFacilityId ?? prev.linkedFacilityId,
            linkedCoachId: remote.linkedCoachId ?? prev.linkedCoachId,
            accountIntent: remote.accountIntent ?? prev.accountIntent,
            memberCode: remote.memberCode || prev.memberCode,
            avatarUrl: canApplyAvatar ? remote.avatarUrl : prev.avatarUrl,
            bioAr: remote.bioAr !== undefined ? remote.bioAr : prev.bioAr,
            socialLinks:
              remote.socialLinks && Object.keys(remote.socialLinks).length > 0
                ? { ...(prev.socialLinks || {}), ...remote.socialLinks }
                : prev.socialLinks,
            fullNameAr:
              remote.fullNameAr && remote.fullNameAr.trim() ? remote.fullNameAr : prev.fullNameAr,
            phone: remote.phone && remote.phone.trim() ? remote.phone : prev.phone,
            city: remote.city && remote.city.trim() ? remote.city : prev.city,
            hasParentSupervision: remote.hasParentSupervision ?? prev.hasParentSupervision,
            needsOnboarding: Boolean(remote.needsOnboarding ?? prev.needsOnboarding),
          });

          setCurrentPersona((prev) => {
            if (prev.role === "guest" || prev.id === "persona-guest") return prev;
            const nextPersona = mergeRemoteIntoPersona(prev);
            if (
              nextPersona.role === prev.role &&
              nextPersona.linkedFacilityId === prev.linkedFacilityId &&
              nextPersona.linkedCoachId === prev.linkedCoachId &&
              nextPersona.accountIntent === prev.accountIntent &&
              nextPersona.memberCode === prev.memberCode &&
              nextPersona.avatarUrl === prev.avatarUrl &&
              nextPersona.bioAr === prev.bioAr &&
              nextPersona.fullNameAr === prev.fullNameAr &&
              nextPersona.phone === prev.phone &&
              nextPersona.city === prev.city &&
              nextPersona.needsOnboarding === prev.needsOnboarding &&
              JSON.stringify(nextPersona.socialLinks || null) ===
                JSON.stringify(prev.socialLinks || null)
            ) {
              return prev;
            }
            return nextPersona;
          });
          setAllPersonas((list) =>
            list.map((p) => {
              const matchesId = p.id === currentPersona.id;
              const matchesCode =
                remote.memberCode &&
                p.memberCode?.toUpperCase() === remote.memberCode.toUpperCase();
              const matchesEmail =
                currentPersona.email &&
                p.email?.toLowerCase() === currentPersona.email.toLowerCase();
              return matchesId || matchesCode || matchesEmail ? mergeRemoteIntoPersona(p) : p;
            })
          );
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPersona.id, currentPersona.memberCode, isAuthenticated]);
}

export function createAuthProfileMutators({
  currentPersona,
  setCurrentPersona,
  setAllPersonas,
  avatarSaveSeqRef,
  depsRef,
}: {
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  avatarSaveSeqRef: React.MutableRefObject<number>;
  depsRef: React.MutableRefObject<AuthDomainDeps>;
}) {
  const updateCurrentPersonaAvatar: CaptenlyContextType["updateCurrentPersonaAvatar"] = async (
    avatarDataUrl
  ) => {
    const d = depsRef.current;
    avatarSaveSeqRef.current += 1;
    const targetPersona = currentPersona;
    const prevAvatar = targetPersona.avatarUrl;
    const targetCoachId =
      targetPersona.linkedCoachId ||
      (targetPersona.role === "coach" && targetPersona.memberCode
        ? getDeterministicCoachId(targetPersona.memberCode)
        : undefined);
    const matchesTargetPersona = (p: PersonaAccount) =>
      p.id === targetPersona.id ||
      Boolean(
        targetPersona.memberCode &&
          p.memberCode?.toUpperCase() === targetPersona.memberCode.toUpperCase()
      ) ||
      Boolean(targetPersona.email && p.email?.toLowerCase() === targetPersona.email.toLowerCase());

    setCurrentPersona((prev) =>
      prev.id === targetPersona.id ? { ...prev, avatarUrl: avatarDataUrl } : prev
    );
    setAllPersonas((prev) =>
      prev.map((p) => (matchesTargetPersona(p) ? { ...p, avatarUrl: avatarDataUrl } : p))
    );

    const existingCoach = targetCoachId ? d.coaches.find((c) => c.id === targetCoachId) : undefined;
    const prevCoachAvatar = existingCoach?.avatarUrl;
    const updatedCoach = existingCoach ? { ...existingCoach, avatarUrl: avatarDataUrl } : undefined;
    if (updatedCoach) {
      d.setCoaches((prev) => prev.map((c) => (c.id === updatedCoach.id ? updatedCoach : c)));
    }
    if (targetPersona.role === "guest" || targetPersona.id === "persona-guest") {
      return { ok: true, persisted: false };
    }
    if (d.isBrowserOffline) {
      return {
        ok: true,
        persisted: false,
        messageAr: "تم حفظ الصورة محلياً (أوفلاين) — أعد الحفظ عند عودة الإنترنت للمزامنة السحابية.",
      };
    }

    const revertLocalAvatar = () => {
      setCurrentPersona((prev) =>
        prev.id === targetPersona.id && prev.avatarUrl === avatarDataUrl
          ? { ...prev, avatarUrl: prevAvatar }
          : prev
      );
      setAllPersonas((prev) =>
        prev.map((p) =>
          matchesTargetPersona(p) && p.avatarUrl === avatarDataUrl ? { ...p, avatarUrl: prevAvatar } : p
        )
      );
      if (updatedCoach) {
        d.setCoaches((prev) =>
          prev.map((c) =>
            c.id === updatedCoach.id && c.avatarUrl === avatarDataUrl
              ? { ...c, avatarUrl: prevCoachAvatar || "" }
              : c
          )
        );
      }
    };

    try {
      const res = await fetch("/api/supabase/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: getProfileSyncKey(targetPersona),
          email: targetPersona.email,
          fullNameAr: targetPersona.fullNameAr,
          role: targetPersona.role,
          accountIntent: targetPersona.accountIntent,
          phone: targetPersona.phone,
          city: targetPersona.city,
          avatarUrl: avatarDataUrl,
          bioAr: targetPersona.bioAr,
          socialLinks: targetPersona.socialLinks,
          authProvider: targetPersona.authProvider || "captenly",
          hasParentSupervision: targetPersona.hasParentSupervision,
          needsOnboarding: false,
          linkedFacilityId: targetPersona.linkedFacilityId,
          linkedCoachId: targetCoachId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.persisted) {
        revertLocalAvatar();
        return {
          ok: false,
          persisted: false,
          messageAr:
            res.status === 401
              ? "انتهت جلسة تسجيل الدخول — سجّل الدخول مجدداً ثم أعد تغيير الصورة."
              : res.status === 403
                ? "تعذر التحقق من صلاحية الحساب — سجّل الخروج وأعد الدخول ثم جرّب مجدداً."
                : data?.messageAr ||
                  "تعذر حفظ الصورة الشخصية في قاعدة البيانات، يرجى المحاولة مرة أخرى.",
        };
      }
      if (updatedCoach) {
        await fetch("/api/supabase/public-supply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coach: updatedCoach }),
        }).catch(() => null);
      }
      return { ok: true, persisted: true, messageAr: "تم حفظ الصورة الشخصية بنجاح ✓" };
    } catch {
      revertLocalAvatar();
      return {
        ok: false,
        persisted: false,
        messageAr: "تعذر الاتصال بالخادم لحفظ الصورة الشخصية، يرجى المحاولة مرة أخرى.",
      };
    }
  };

  const updateCurrentPersonaProfile: CaptenlyContextType["updateCurrentPersonaProfile"] = (
    patch
  ) => {
    const d = depsRef.current;
    if (currentPersona.linkedCoachId && patch.bioAr !== undefined) {
      const linkedCoach = d.coaches.find((c) => c.id === currentPersona.linkedCoachId);
      const hasMedicalLicense = linkedCoach?.badges.some(
        (b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active"
      );
      if (!hasMedicalLicense) {
        const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => patch.bioAr?.includes(kw));
        if (detected) {
          return {
            ok: false,
            detectedKeyword: detected,
            messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
          };
        }
      }
    }

    const next: PersonaAccount = {
      ...currentPersona,
      ...(patch.fullNameAr !== undefined ? { fullNameAr: patch.fullNameAr } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.bioAr !== undefined ? { bioAr: patch.bioAr } : {}),
      ...(patch.socialLinks !== undefined
        ? { socialLinks: { ...(currentPersona.socialLinks || {}), ...patch.socialLinks } }
        : {}),
      ...(patch.hasParentSupervision !== undefined
        ? { hasParentSupervision: patch.hasParentSupervision }
        : {}),
      ...(patch.accountIntent !== undefined ? { accountIntent: patch.accountIntent } : {}),
    };
    const effectiveCoachId =
      next.linkedCoachId ||
      (next.role === "coach" && next.memberCode ? getDeterministicCoachId(next.memberCode) : undefined);
    if (effectiveCoachId) next.linkedCoachId = effectiveCoachId;

    setCurrentPersona(next);
    setAllPersonas((list) => list.map((p) => (p.id === next.id ? next : p)));

    if (effectiveCoachId) {
      const govForCoach = resolveGovernorateFromCity(next.city, "مصر");
      d.setCoaches((list: Coach[]) => {
        const existingCoach = list.find(
          (c) =>
            c.id === effectiveCoachId ||
            (next.memberCode && c.SingleCoachId?.toUpperCase() === next.memberCode.toUpperCase())
        );
        const nextCoach = buildSelfRegisteredCoach(next, existingCoach, govForCoach);
        d.syncCoachToSupabase(nextCoach);
        return [nextCoach, ...list.filter((c) => c.id !== nextCoach.id)];
      });
    }

    if (next.linkedFacilityId) {
      d.updateFacilityAndSync(next.linkedFacilityId, (f: Facility) => ({
        ...f,
        ...(patch.city && patch.city !== "كل مصر"
          ? { city: patch.city, governorate: resolveGovernorateFromCity(patch.city, f.governorate) }
          : {}),
        ...(patch.bioAr !== undefined ? { publicDescriptionAr: patch.bioAr } : {}),
        ...(patch.socialLinks?.facebook !== undefined
          ? { facebookUrl: patch.socialLinks.facebook || f.facebookUrl }
          : {}),
        ...(patch.socialLinks?.instagram !== undefined
          ? { instagramUrl: patch.socialLinks.instagram || f.instagramUrl }
          : {}),
      }));
    }

    if (next.role !== "guest") {
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: getProfileSyncKey(next),
        email: next.email,
        fullNameAr: next.fullNameAr,
        role: next.role,
        accountIntent: next.accountIntent,
        phone: next.phone,
        city: next.city,
        avatarUrl: next.avatarUrl,
        bioAr: next.bioAr,
        socialLinks: next.socialLinks,
        authProvider: next.authProvider || "captenly",
        hasParentSupervision: next.hasParentSupervision,
        needsOnboarding: false,
        linkedFacilityId: next.linkedFacilityId,
        linkedCoachId: next.linkedCoachId,
      });
    }
    return { ok: true, messageAr: "تم حفظ تحديثات الملف بنجاح." };
  };

  return { updateCurrentPersonaAvatar, updateCurrentPersonaProfile };
}
