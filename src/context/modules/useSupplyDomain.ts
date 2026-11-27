"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type {
  Coach,
  EditorialArticle,
  Facility,
  MemberRoleClaim,
  NotificationItem,
  PersonaAccount,
} from "@/types/captenly";
import {
  INITIAL_ARTICLES,
  INITIAL_COACHES,
  INITIAL_FACILITIES,
  PROHIBITED_MEDICAL_KEYWORDS,
} from "@/data/seedData";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import { postSupabaseSync } from "./storageHelpers";
import type {
  CaptenlyContextType,
  InitialPublicSupply,
  RegisterFacilityPayload,
  SubmitRoleClaimPayload,
} from "./types";
import { createSupplyCatalogActions } from "./useSupplyCatalog";

export interface SupplyDomainDeps {
  isAuthenticated: boolean;
  isBrowserOffline: boolean;
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  setRoleClaims: React.Dispatch<React.SetStateAction<MemberRoleClaim[]>>;
  pushNotification: (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => void;
  submitRoleClaimApplication: (payload: SubmitRoleClaimPayload) => Promise<{
    ok: boolean;
    claim?: MemberRoleClaim;
    detectedKeyword?: string;
    messageAr: string;
  }>;
}

const CLIENT_PROHIBITED_MEDICAL_KEYWORDS = [
  ...PROHIBITED_MEDICAL_KEYWORDS,
  "علاج طبي",
  "تأهيل طبي",
  "تشخيص",
  "وصفة طبية",
  "علاج الديسك",
  "علاج العمود الفقري",
  "rehabilitation therapy",
  "medical therapy",
  "physical therapy",
  "physiotherapy",
  "medical rehab",
  "medical diagnosis",
];

function findProhibitedMedicalKeyword(text: string): string | undefined {
  const lower = text.toLowerCase();
  return CLIENT_PROHIBITED_MEDICAL_KEYWORDS.find((kw) => lower.includes(kw.toLowerCase()));
}

export function useSupplyDomain({
  initialPublicSupply,
  depsRef,
}: {
  initialPublicSupply?: InitialPublicSupply;
  depsRef: React.MutableRefObject<SupplyDomainDeps>;
}) {
  const pathname = usePathname() || "/";
  const [facilities, setFacilities] = useState<Facility[]>(
    initialPublicSupply?.facilities?.length ? initialPublicSupply.facilities : INITIAL_FACILITIES
  );
  const [coaches, setCoaches] = useState<Coach[]>(
    initialPublicSupply?.coaches?.length ? initialPublicSupply.coaches : INITIAL_COACHES
  );
  const [articles, setArticles] = useState<EditorialArticle[]>(
    initialPublicSupply?.articles?.length ? initialPublicSupply.articles : INITIAL_ARTICLES
  );
  const [publicSupplyHydrated, setPublicSupplyHydrated] = useState<boolean>(
    Boolean(initialPublicSupply?.facilities?.length || initialPublicSupply?.coaches?.length)
  );
  const pendingFacilityHeroRef = useRef<Set<string>>(new Set());
  const supplyFetchedRef = useRef<boolean>(false);
  const facilitiesRef = useRef(facilities);
  facilitiesRef.current = facilities;
  const coachesRef = useRef(coaches);
  coachesRef.current = coaches;

  // Hydrate real registered Captenly academies/coaches from Supabase on mount (deferred on non-directory routes)
  useEffect(() => {
    if (supplyFetchedRef.current) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    let hasSavedSession = false;
    if (typeof window !== "undefined" && pathname.startsWith("/dashboard/facility/gate")) {
      try {
        hasSavedSession = Boolean(window.localStorage.getItem("captenly_platform_state_v6"));
      } catch {
        hasSavedSession = false;
      }
    }
    const shouldDeferSupply =
      pathname.startsWith("/auth") ||
      pathname === "/welcome" ||
      pathname === "/privacy" ||
      pathname === "/terms" ||
      pathname === "/badges" ||
      pathname === "/about" ||
      pathname.startsWith("/notifications") ||
      (pathname.startsWith("/dashboard/facility/gate") &&
        !depsRef.current.isAuthenticated &&
        !hasSavedSession);

    const runSupplyFetch = () => {
      if (cancelled || supplyFetchedRef.current) return;
      supplyFetchedRef.current = true;
      fetch("/api/supabase/public-supply", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok) return;
          if (Array.isArray(data.facilities) && data.facilities.length > 0) {
            setFacilities((prev) => {
              const byId = new Map(prev.map((f) => [f.id, f]));
              for (const remote of data.facilities as Facility[]) {
                const local =
                  byId.get(remote.id) ||
                  (remote.googlePlaceId
                    ? prev.find((p) => p.googlePlaceId === remote.googlePlaceId)
                    : undefined);
                if (!local) {
                  byId.set(remote.id, remote);
                } else if (
                  local.supplyStatus === "seeded_unclaimed" ||
                  (remote.supplyStatus !== "seeded_unclaimed" &&
                    ((remote.schoolPrograms?.length || 0) >= (local.schoolPrograms?.length || 0) ||
                      (remote.coachRoster?.length || 0) >= (local.coachRoster?.length || 0) ||
                      (remote.staffMembers?.length || 0) >= (local.staffMembers?.length || 0)))
                ) {
                  const keepLocalHero =
                    pendingFacilityHeroRef.current.has(remote.id) && Boolean(local.heroImage);
                  byId.set(local.id, {
                    ...local,
                    ...remote,
                    id: remote.id,
                    heroImage: keepLocalHero ? local.heroImage : remote.heroImage,
                  });
                }
              }
              return Array.from(byId.values());
            });
          }
          if (Array.isArray(data.coaches) && data.coaches.length > 0) {
            setCoaches((prev) => {
              const byId = new Map(prev.map((c) => [c.id, c]));
              for (const remote of data.coaches as Coach[]) {
                const local = byId.get(remote.id);
                if (!local || (remote.sessionOffers?.length || 0) >= (local.sessionOffers?.length || 0)) {
                  byId.set(remote.id, remote);
                }
              }
              return Array.from(byId.values());
            });
          }
          if (Array.isArray(data.articles) && data.articles.length > 0) {
            setArticles((prev) => {
              const byId = new Map(prev.map((a) => [a.id, a]));
              for (const remoteArt of data.articles as EditorialArticle[]) {
                if (remoteArt?.id) byId.set(remoteArt.id, remoteArt);
              }
              return Array.from(byId.values());
            });
          }
        })
        .catch(() => {
          supplyFetchedRef.current = false;
        })
        .finally(() => {
          if (!cancelled) setPublicSupplyHydrated(true);
        });
    };

    if (!shouldDeferSupply) {
      runSupplyFetch();
    } else if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(runSupplyFetch, { timeout: 3500 });
    } else {
      timeoutHandle = setTimeout(runSupplyFetch, 2500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(
          idleHandle
        );
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [depsRef, pathname]);

  const syncFacilityToSupabase = useCallback((fac: Facility) => {
    postSupabaseSync("/api/supabase/public-supply", { facility: fac });
  }, []);

  const syncCoachToSupabase = useCallback((coach: Coach) => {
    postSupabaseSync("/api/supabase/public-supply", { coach });
  }, []);

  const updateCoachAndSync = useCallback(
    (coachId: string, updater: (c: Coach) => Coach) => {
      const existing = coachesRef.current.find((c) => c.id === coachId);
      if (!existing) return;
      const next = updater(existing);
      setCoaches((prev) => prev.map((c) => (c.id === coachId ? next : c)));
      syncCoachToSupabase(next);
    },
    [syncCoachToSupabase]
  );

  const updateFacilityAndSync = useCallback(
    (facilityId: string, updater: (f: Facility) => Facility) => {
      const existing = facilitiesRef.current.find((f) => f.id === facilityId);
      if (!existing) return;
      const next = updater(existing);
      setFacilities((prev) => prev.map((f) => (f.id === facilityId ? next : f)));
      syncFacilityToSupabase(next);
    },
    [syncFacilityToSupabase]
  );

  const updateFacilityHeroImage: CaptenlyContextType["updateFacilityHeroImage"] = async (
    facilityId,
    heroImageDataUrl
  ) => {
    const target = facilities.find((f) => f.id === facilityId);
    if (!target) {
      return { ok: false, persisted: false, messageAr: "لم يتم العثور على المنشأة لتحديث صورتها." };
    }
    const prevHero = target.heroImage;
    pendingFacilityHeroRef.current.add(facilityId);
    const nextFacility: Facility = { ...target, heroImage: heroImageDataUrl };
    setFacilities((prev) => prev.map((f) => (f.id === facilityId ? nextFacility : f)));

    if (depsRef.current.isBrowserOffline) {
      pendingFacilityHeroRef.current.delete(facilityId);
      return { ok: true, persisted: false, messageAr: "تم حفظ صورة المنشأة محلياً (أوفلاين)." };
    }

    const revertFacilityHero = () => {
      setFacilities((prev) =>
        prev.map((f) =>
          f.id === facilityId && f.heroImage === heroImageDataUrl ? { ...f, heroImage: prevHero } : f
        )
      );
    };

    try {
      const res = await fetch("/api/supabase/public-supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facility: nextFacility }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.persisted) {
        revertFacilityHero();
        return {
          ok: false,
          persisted: false,
          messageAr:
            res.status === 401
              ? "انتهت جلسة تسجيل الدخول — أعد تسجيل الدخول ثم غيّر صورة المنشأة."
              : res.status === 403
                ? "لا تملك صلاحية تعديل صورة هذه المنشأة."
                : data?.messageAr ||
                  "تعذر حفظ صورة المنشأة في قاعدة البيانات، يرجى المحاولة مجدداً.",
        };
      }
      return { ok: true, persisted: true, messageAr: "تم حفظ صورة المنشأة بنجاح ✓" };
    } catch {
      revertFacilityHero();
      return {
        ok: false,
        persisted: false,
        messageAr: "تعذر الاتصال بالخادم لحفظ صورة المنشأة، حاول مرة أخرى.",
      };
    } finally {
      pendingFacilityHeroRef.current.delete(facilityId);
    }
  };

  const registerAndPublishFacility = async (payload: RegisterFacilityPayload) => {
    const { isAuthenticated, currentPersona, setCurrentPersona, setAllPersonas, setRoleClaims, pushNotification } =
      depsRef.current;
    if (!isAuthenticated || currentPersona.role === "guest" || currentPersona.id === "persona-guest") {
      return { ok: false, messageAr: "يجب تسجيل الدخول أولاً لنشر صفحة المنشأة أو الأكاديمية." };
    }
    try {
      const res = await fetch("/api/supabase/register-facility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.facility) {
        return {
          ok: false,
          messageAr:
            data?.messageAr ||
            "تعذّر حفظ ونشر صفحة المنشأة حالياً، تأكد من إدخال الاسم والموقع الجغرافي ثم أعد المحاولة.",
        };
      }
      const savedFac = data.facility as Facility;
      setFacilities((prev) =>
        prev.some((f) => f.id === savedFac.id)
          ? prev.map((f) => (f.id === savedFac.id ? savedFac : f))
          : [savedFac, ...prev]
      );
      const nextRole =
        currentPersona.role === "super_admin" ? "super_admin" : ("facility_manager" as const);
      setCurrentPersona((prev) => ({
        ...prev,
        role: nextRole,
        linkedFacilityId: savedFac.id,
        needsOnboarding: false,
      }));
      setAllPersonas((prev) =>
        prev.map((p) =>
          p.id === currentPersona.id
            ? { ...p, role: nextRole, linkedFacilityId: savedFac.id, needsOnboarding: false }
            : p
        )
      );
      if (data.optionalClaim) {
        const claim = data.optionalClaim as MemberRoleClaim;
        setRoleClaims((prev) => [claim, ...prev.filter((c) => c.id !== claim.id)]);
      }
      pushNotification({
        titleAr: `تم نشر صفحة «${savedFac.nameAr}» فوراً`,
        messageAr: data.optionalClaim
          ? "صفحتك ظاهرة الآن للسبّاحين في البحث، وتم استلام مستندات التوثيق لمراجعة الشارة الخضراء."
          : "صفحتك ظاهرة الآن للسبّاحين في البحث وتقدر تضيف أوراق التوثيق للشارة الخضراء في أي وقت.",
        type: "passport_badge",
        actionLabelAr: "فتح لوحة المنشأة",
        actionHref: "/dashboard/facility",
      });
      return {
        ok: true,
        facility: savedFac,
        verificationClaimSubmitted: Boolean(data.optionalClaim),
        messageAr: data.messageAr,
      };
    } catch {
      return { ok: false, messageAr: "تعذّر الاتصال بالخادم لنشر المنشأة حالياً، حاول مرة أخرى." };
    }
  };

  const registerAndVerifyCoach: CaptenlyContextType["registerAndVerifyCoach"] = useCallback(
    (payload) => {
      const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
      const cleanFb = (payload.facebookUrl || payload.socialLinks?.facebook || "").trim();
      const cleanIg = (payload.instagramUrl || payload.socialLinks?.instagram || "").trim();
      if (!cleanWa && !cleanFb && !cleanIg) {
        return {
          ok: false,
          messageAr: "يرجى إدخال وسيلة تواصل واحدة على الأقل (رقم واتساب أو رابط فيسبوك أو إنستاجرام).",
        };
      }
      const detected = findProhibitedMedicalKeyword(payload.bioAr);
      if (detected) {
        return {
          ok: false,
          detectedKeyword: detected,
          messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
        };
      }
      void depsRef.current.submitRoleClaimApplication({
        ...payload,
        claimType: "coach",
        affiliatedFacilityId: payload.facilityId,
        targetFacilityId: payload.facilityId,
        sportSector: "swimming",
        proofNotesAr: `قيد نقابي/شهادة: ${payload.syndicateCardRef}${payload.edlfCertRef ? ` | إنقاذ: ${payload.edlfCertRef}` : ""}`,
      });
      return {
        ok: true,
        messageAr:
          "تم استلام طلب التوثيق ككابتن للمراجعة الإدارية بنجاح — سيبقى حسابك الحالي فعالاً حتى اعتماد الطلب من إدارة كابتنلي.",
      };
    },
    [depsRef]
  );

  const validateAndSaveCoachBio: CaptenlyContextType["validateAndSaveCoachBio"] = useCallback(
    (coachId, newBioAr) => {
      const targetCoach = coachesRef.current.find((c) => c.id === coachId);
      const hasMedicalLicenseBadge = targetCoach?.badges.some(
        (b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active"
      );
      if (!hasMedicalLicenseBadge) {
        const detected = findProhibitedMedicalKeyword(newBioAr);
        if (detected) {
          return {
            ok: false,
            detectedKeyword: detected,
            messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): غير مسموح باستخدام مصطلح «${detected}» لغير الأطباء المرخصين بالشارة السادسة.`,
          };
        }
      }
      updateCoachAndSync(coachId, (c) => ({ ...c, bioAr: newBioAr }));
      return { ok: true, messageAr: "تم حفظ السيرة المهنية بعد اجتياز فحص المعايير بنجاح!" };
    },
    [updateCoachAndSync]
  );

  const mergeExternalPlacesFacilities = useCallback((externalPlaces: Facility[]) => {
    if (!externalPlaces.length) return;
    setFacilities((prev) => {
      const existingPlaceIds = new Set(prev.map((f) => f.googlePlaceId).filter(Boolean));
      const existingIds = new Set(prev.map((f) => f.id));
      const fresh = externalPlaces.filter(
        (ext) =>
          !existingIds.has(ext.id) && (!ext.googlePlaceId || !existingPlaceIds.has(ext.googlePlaceId))
      );
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
  }, []);

  const claimFacilityAndVerify: CaptenlyContextType["claimFacilityAndVerify"] = (
    facilityId,
    payload
  ) => {
    const existing = facilities.find((f) => f.id === facilityId);
    if (!existing) return { ok: false, messageAr: "المنشأة غير موجودة." };
    if (existing.supplyStatus === "verified_active") {
      return {
        ok: false,
        messageAr: "هذه المنشأة موثقة ومُدارة بالفعل من قِبل مالكها أو مديرها المعتمد.",
      };
    }
    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    const cleanFb = (payload.facebookUrl || "").trim();
    const cleanIg = (payload.instagramUrl || "").trim();
    if (!cleanWa && !cleanFb && !cleanIg) {
      return {
        ok: false,
        messageAr: "يرجى إدخال وسيلة تواصل واحدة على الأقل (واتساب أو فيسبوك أو إنستاجرام).",
      };
    }
    void depsRef.current.submitRoleClaimApplication({
      ...payload,
      claimType: "facility",
      targetFacilityId: facilityId,
      fullNameAr: payload.managerName,
      city: existing.city,
      governorate: existing.governorate,
      proofNotesAr: `طلب مطالبة منشأة: ${existing.nameAr}${payload.commercialRegRef ? ` | مرجع: ${payload.commercialRegRef}` : ""}`,
    });
    return {
      ok: true,
      messageAr: `تم استلام طلب توثيق وإدارة «${existing.nameAr}» للمراجعة الإدارية بنجاح — سيبقى حسابك الحالي فعالاً حتى اعتماد الطلب من إدارة كابتنلي.`,
    };
  };

  const seedNewFacilityConcierge: CaptenlyContextType["seedNewFacilityConcierge"] = (newFac) => {
    const id = `fac-concierge-${Date.now()}`;
    const cleanWa = (newFac.whatsappNumber || "").replace(/\D/g, "");
    const matchedPreset = EGYPT_CITY_PRESETS.find(
      (p) => p.city === newFac.city || newFac.city.includes(p.city) || p.city.includes(newFac.city)
    );
    const created: Facility = {
      id,
      slug: `${id}-${newFac.city}`,
      nameAr: newFac.nameAr,
      nameEn: "Verified Partner Facility",
      facilityType:
        newFac.sportSector === "fitness"
          ? "gym_fitness"
          : newFac.sportSector === "both"
            ? "multi_sport"
            : "swimming_academy",
      sportSector: newFac.sportSector,
      governorate: resolveGovernorateFromCity(newFac.city, matchedPreset?.governorate || "مصر"),
      city: newFac.city,
      district: newFac.district,
      addressAr: `${newFac.district}، ${newFac.city}`,
      coordinates: matchedPreset ? { lat: matchedPreset.lat, lng: matchedPreset.lng } : { lat: 30.0444, lng: 31.2357 },
      whatsappNumber: cleanWa ? (cleanWa.startsWith("2") ? cleanWa : `2${cleanWa}`) : undefined,
      instapayHandle: "",
      vodafoneCashNumber: "",
      supplyStatus: "seeded_unclaimed",
      subscriptionTier: "free_founding",
      isSponsored: false,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — مضافة عبر الدليل",
      avgReplyMinutes: 30,
      completenessScore: 80,
      rating: 4.8,
      reviewsCount: 1,
      heroImage: newFac.sportSector === "fitness" ? "/screens/b24a11bb17b1.jpg" : "/screens/20b781f698f9.jpg",
      scheduleSummaryAr: "يومياً 9 ص – 10 م | مواعيد صباحية ومسائية",
      sourcePublicNoteAr: "لا تتوفر حالياً بيانات أو باقات محدثة مقدمة مباشرة من المنشأة.",
      badges: [],
      poolSpecs:
        newFac.sportSector !== "fitness"
          ? {
              poolType: "نصف أوليمبي 25م",
              depthRange: "1.1م – 1.9م",
              isHeatedWinter: newFac.isHeatedWinter,
              isCoveredIndoor: newFac.isHeatedWinter,
              maxSwimmersPerLane: 6,
              hasLadiesOnlySlots: newFac.hasLadiesSlots,
              hasEdlfLifeguard: true,
            }
          : undefined,
      gymSpecs:
        newFac.sportSector !== "swimming"
          ? {
              areaSqm: 450,
              isAirConditioned: true,
              hasLadiesOnlySlots: newFac.hasLadiesSlots,
              ladiesScheduleAr: "مواعيد سيدات مستقلة متاحة",
              hasFemaleTrainers: newFac.hasLadiesSlots,
              equipmentHighlights: ["تجهيزات رياضية متكاملة"],
            }
          : undefined,
      specialtiesAr:
        newFac.sportSector === "fitness"
          ? ["تضخيم وقوة بدنية", "إنقاص وزن وحرق دهون"]
          : ["تأسيس أطفال", "سباحة الكبار والمبتدئين"],
      pricePackages: [
        {
          id: `pkg-${Date.now()}`,
          nameAr: "الباقة الشهرية الأساسية (8 حصص)",
          sessionsCount: 8,
          sessionsPerWeek: 2,
          durationMinutes: 60,
          baseMonthlyEgp: newFac.baseMonthlyPrice,
          assessmentFeeEgp: 0,
          membershipCardFeeEgp: 0,
          mandatoryKitFeeEgp: 0,
          companionFeeEgp: 0,
        },
      ],
      affiliatedCoachIds: [],
      monthlyMetrics: { profileViews: 10, comparisonAppearances: 2, verifiedWhatsappLeads: 0, activeSessionLedgers: 0 },
    };
    setFacilities((prev) => [created, ...prev]);
    syncFacilityToSupabase(created);
    return created;
  };

  const catalogActions = useMemo(
    () =>
      createSupplyCatalogActions({
        facilities,
        coaches,
        setArticles,
        updateCoachAndSync,
        updateFacilityAndSync,
        getCurrentPersona: () => depsRef.current.currentPersona,
        pushNotification: (n) => depsRef.current.pushNotification(n),
      }),
    [facilities, coaches, updateCoachAndSync, updateFacilityAndSync, depsRef]
  );

  return {
    facilities,
    setFacilities,
    coaches,
    setCoaches,
    articles,
    setArticles,
    publicSupplyHydrated,
    syncFacilityToSupabase,
    syncCoachToSupabase,
    updateCoachAndSync,
    updateFacilityAndSync,
    updateFacilityHeroImage,
    registerAndPublishFacility,
    registerAndVerifyCoach,
    validateAndSaveCoachBio,
    mergeExternalPlacesFacilities,
    claimFacilityAndVerify,
    seedNewFacilityConcierge,
    ...catalogActions,
  };
}
