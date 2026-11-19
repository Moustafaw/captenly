"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { SWIMMING_SPECIALTIES_9 } from "@/data/seedData";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { FacilityLocationsField } from "@/components/maps/FacilityLocationsField";
import type { FacilityLocation } from "@/types/captenly";

interface ClaimAndVerifyClientProps {
  initialSlug?: string;
  initialMode?: "facility" | "coach";
}

export function ClaimAndVerifyClient({
  initialSlug,
  initialMode = "facility",
}: ClaimAndVerifyClientProps) {
  const {
    isAuthenticated,
    currentPersona,
    facilities,
    roleClaims,
    refreshRoleClaims,
    submitRoleClaimApplication,
    reviewRoleClaim,
    registerAndPublishFacility,
    updateFacilityHeroImage,
    updateCurrentPersonaAvatar,
  } = useCaptenly();

  const [mode, setMode] = useState<"facility" | "coach">(initialMode);
  const lockedRoleMode: "facility" | "coach" | null =
    isAuthenticated && currentPersona.role === "facility_manager"
      ? "facility"
      : isAuthenticated && currentPersona.role === "coach"
      ? "coach"
      : null;
  const effectiveMode: "facility" | "coach" = lockedRoleMode ?? mode;

  const switchTabMode = (nextMode: "facility" | "coach") => {
    setMode(nextMode);
    setStatusFeedback(null);
    if (typeof window !== "undefined") {
      const targetUrl = nextMode === "coach" ? "/claim?mode=coach" : "/claim";
      window.history.replaceState(null, "", targetUrl);
    }
  };

  // Existing facility if user already created/linked one
  const linkedExistingFacility = useMemo(
    () =>
      currentPersona.linkedFacilityId
        ? facilities.find((f) => f.id === currentPersona.linkedFacilityId)
        : undefined,
    [facilities, currentPersona.linkedFacilityId]
  );

  // Facility / Academy open registration + mandatory location state
  const [facilityNameAr, setFacilityNameAr] = useState(
    linkedExistingFacility?.nameAr || ""
  );
  const [facilityDescAr, setFacilityDescAr] = useState(
    linkedExistingFacility?.publicDescriptionAr || ""
  );
  const [facilityHeroImage, setFacilityHeroImage] = useState(
    linkedExistingFacility?.heroImage || ""
  );
  const [isAcademyMode, setIsAcademyMode] = useState<boolean>(
    Boolean(linkedExistingFacility?.isAcademyInHostClubs)
  );
  const [facilityLocations, setFacilityLocations] = useState<FacilityLocation[]>(() => {
    if (linkedExistingFacility?.locations && linkedExistingFacility.locations.length > 0) {
      return linkedExistingFacility.locations;
    }
    if (linkedExistingFacility?.coordinates) {
      return [
        {
          id: "loc-existing",
          governorate: linkedExistingFacility.governorate,
          city: linkedExistingFacility.city,
          district: linkedExistingFacility.district,
          addressAr: linkedExistingFacility.addressAr,
          coordinates: linkedExistingFacility.coordinates,
          googlePlaceId: linkedExistingFacility.googlePlaceId,
        },
      ];
    }
    return [];
  });
  const [managerName, setManagerName] = useState(currentPersona.fullNameAr || "");
  const [roleTitleAr, setRoleTitleAr] = useState("");
  const [facPhone, setFacPhone] = useState(currentPersona.phone || "");
  const [facWhatsapp, setFacWhatsapp] = useState(
    linkedExistingFacility?.whatsappNumber || ""
  );
  const [facFacebook, setFacFacebook] = useState(
    linkedExistingFacility?.facebookUrl || ""
  );
  const [facInstagram, setFacInstagram] = useState(
    linkedExistingFacility?.instagramUrl || ""
  );
  const [instapayHandle, setInstapayHandle] = useState(
    linkedExistingFacility?.instapayHandle || ""
  );
  const [updatedPrice, setUpdatedPrice] = useState<string>(
    linkedExistingFacility?.pricePackages[0]?.baseMonthlyEgp
      ? String(linkedExistingFacility.pricePackages[0].baseMonthlyEgp)
      : ""
  );
  const [commercialRef, setCommercialRef] = useState("");
  const [facProofDocUrl, setFacProofDocUrl] = useState("");
  const [facProofNotes, setFacProofNotes] = useState("");
  const [publishedFacilitySlug, setPublishedFacilitySlug] = useState<string>(
    linkedExistingFacility?.slug || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Coach verification state
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string>(currentPersona.avatarUrl || "");
  const [coachName, setCoachName] = useState(currentPersona.fullNameAr || "");
  const [coachTitle, setCoachTitle] = useState("");
  const [coachPhone, setCoachPhone] = useState(currentPersona.phone || "");
  const [coachWhatsapp, setCoachWhatsapp] = useState("");
  const [coachFacebook, setCoachFacebook] = useState("");
  const [coachInstagram, setCoachInstagram] = useState("");
  const [coachCity, setCoachCity] = useState(
    currentPersona.city && currentPersona.city !== "كل مصر" ? currentPersona.city : ""
  );
  const [coachDistrict, setCoachDistrict] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [coachBio, setCoachBio] = useState("");
  const [pkg8Egp, setPkg8Egp] = useState("");
  const [pkg12Egp, setPkg12Egp] = useState("");
  const [syndicateRef, setSyndicateRef] = useState("");
  const [edlfRef, setEdlfRef] = useState("");
  const [coachProofDocUrl, setCoachProofDocUrl] = useState("");
  const claimedFacilityFallback = useMemo(
    () => facilities.find((f) => f.slug === initialSlug) || facilities[0],
    [facilities, initialSlug]
  );
  const [affiliatedFacId, setAffiliatedFacId] = useState<string>(claimedFacilityFallback?.id || "");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  const syncedFacilityIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!linkedExistingFacility) return;
    if (syncedFacilityIdRef.current !== linkedExistingFacility.id) {
      syncedFacilityIdRef.current = linkedExistingFacility.id;
      setFacilityNameAr((prev) => prev || linkedExistingFacility.nameAr || "");
      setFacilityDescAr((prev) => prev || linkedExistingFacility.publicDescriptionAr || "");
      setFacilityHeroImage(linkedExistingFacility.heroImage || "");
      setIsAcademyMode(Boolean(linkedExistingFacility.isAcademyInHostClubs));
      setFacilityLocations((prev) => {
        if (prev.length > 0) return prev;
        if (linkedExistingFacility.locations && linkedExistingFacility.locations.length > 0) {
          return linkedExistingFacility.locations;
        }
        if (linkedExistingFacility.coordinates) {
          return [
            {
              id: "loc-existing",
              governorate: linkedExistingFacility.governorate,
              city: linkedExistingFacility.city,
              district: linkedExistingFacility.district,
              addressAr: linkedExistingFacility.addressAr,
              coordinates: linkedExistingFacility.coordinates,
              googlePlaceId: linkedExistingFacility.googlePlaceId,
            },
          ];
        }
        return prev;
      });
      setFacWhatsapp((prev) => prev || linkedExistingFacility.whatsappNumber || "");
      setFacFacebook((prev) => prev || linkedExistingFacility.facebookUrl || "");
      setFacInstagram((prev) => prev || linkedExistingFacility.instagramUrl || "");
      setInstapayHandle((prev) => prev || linkedExistingFacility.instapayHandle || "");
      setUpdatedPrice((prev) =>
        prev ||
        (linkedExistingFacility.pricePackages[0]?.baseMonthlyEgp
          ? String(linkedExistingFacility.pricePackages[0].baseMonthlyEgp)
          : "")
      );
      setPublishedFacilitySlug((prev) => prev || linkedExistingFacility.slug || "");
      const ownerStaffRole = linkedExistingFacility.staffMembers?.find(
        (st) =>
          currentPersona.memberCode &&
          st.linkedMemberCode?.toUpperCase() === currentPersona.memberCode.toUpperCase()
      )?.roleTitleAr;
      setRoleTitleAr((prev) => prev || ownerStaffRole || "إدارة المنشأة");
    } else if (linkedExistingFacility.heroImage) {
      setFacilityHeroImage(linkedExistingFacility.heroImage);
    }
  }, [linkedExistingFacility, currentPersona.memberCode]);

  useEffect(() => {
    if (currentPersona.fullNameAr) {
      setManagerName((prev) => prev || currentPersona.fullNameAr);
      setCoachName((prev) => prev || currentPersona.fullNameAr);
    }
    if (currentPersona.phone) {
      setFacPhone((prev) => prev || currentPersona.phone);
      setCoachPhone((prev) => prev || currentPersona.phone);
    }
    if (currentPersona.avatarUrl) {
      setCoachAvatarUrl((prev) => prev || currentPersona.avatarUrl || "");
    }
    if (currentPersona.city && currentPersona.city !== "كل مصر") {
      setCoachCity((prev) => prev || currentPersona.city);
    }
  }, [
    currentPersona.id,
    currentPersona.fullNameAr,
    currentPersona.phone,
    currentPersona.avatarUrl,
    currentPersona.city,
  ]);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen descriptionAr="يرجى إنشاء حساب أو تسجيل الدخول في Captenly لتوثيق وربط منشأتك أو اعتماد ملفك التدريبي." />
    );
  }

  const myClaims = roleClaims.filter(
    (c) =>
      !currentPersona.memberCode ||
      c.applicantMemberCode.toUpperCase() === currentPersona.memberCode.toUpperCase()
  );

  const handleProofFileUpload = (
    file: File | null,
    setter: (dataUrl: string) => void
  ) => {
    if (!file) return;
    if (file.size > 1_200_000) {
      setStatusFeedback({
        ok: false,
        msg: "حجم صورة المستند يتجاوز 1.2 ميجابايت — يرجى اختيار صورة أصغر أو إدخال رابط المستند.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleSpec = (spec: string) => {
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleFacilityClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!facilityNameAr.trim() || facilityNameAr.trim().length < 2) {
      setStatusFeedback({
        ok: false,
        msg: "يرجى إدخال اسم المنشأة أو الأكاديمية أولاً.",
      });
      return;
    }
    if (facilityLocations.length === 0) {
      setStatusFeedback({
        ok: false,
        msg: "تحديد الموقع الجغرافي إجباري — استخدم شريط البحث أو الخريطة التفاعلية لتثبيت الدبوس.",
      });
      return;
    }
    setSubmitting(true);
    setStatusFeedback(null);
    try {
      const res = await registerAndPublishFacility({
        nameAr: facilityNameAr.trim(),
        publicDescriptionAr: facilityDescAr.trim() || undefined,
        isAcademyInHostClubs: isAcademyMode,
        locations: facilityLocations,
        managerName: managerName.trim() || currentPersona.fullNameAr,
        roleTitleAr: roleTitleAr.trim() || "إدارة المنشأة",
        phone: facPhone.trim(),
        whatsappNumber: facWhatsapp.trim() || undefined,
        facebookUrl: facFacebook.trim() || undefined,
        instagramUrl: facInstagram.trim() || undefined,
        instapayHandle: instapayHandle.trim() || undefined,
        heroImage: facilityHeroImage || undefined,
        updatedBasePriceEgp: Number(updatedPrice) || undefined,
        commercialRegRef: commercialRef.trim() || undefined,
        proofDocumentUrl: facProofDocUrl.trim() || undefined,
        proofNotesAr: facProofNotes.trim() || undefined,
      });
      setStatusFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        if (res.facility?.slug) setPublishedFacilitySlug(res.facility.slug);
        if (res.verificationClaimSubmitted) {
          await refreshRoleClaims(false).catch(() => undefined);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCoachVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatusFeedback(null);
    try {
      const res = await submitRoleClaimApplication({
        claimType: "coach",
        targetFacilityId: affiliatedFacId || undefined,
        affiliatedFacilityId: affiliatedFacId || undefined,
        fullNameAr: coachName.trim(),
        titleAr: coachTitle.trim(),
        phone: coachPhone.trim(),
        city: coachCity,
        governorate: resolveGovernorateFromCity(coachCity, "كل مصر"),
        district: coachDistrict.trim(),
        sportSector: "swimming",
        yearsExperience: Number(yearsExp) || 0,
        bioAr: coachBio.trim(),
        avatarUrl: coachAvatarUrl || undefined,
        whatsappNumber: coachWhatsapp.trim() || undefined,
        facebookUrl: coachFacebook.trim() || undefined,
        instagramUrl: coachInstagram.trim() || undefined,
        privatePackage8Egp: Number(pkg8Egp) || 0,
        privatePackage12Egp: Number(pkg12Egp) || 0,
        specialtiesAr: selectedSpecs,
        syndicateCardRef: syndicateRef.trim(),
        edlfCertRef: edlfRef.trim() || undefined,
        proofDocumentUrl: coachProofDocUrl.trim() || undefined,
        proofNotesAr: `كارنيه النقابة: ${syndicateRef.trim()}${edlfRef.trim() ? ` | شهادة إنقاذ: ${edlfRef.trim()}` : ""}`,
      });
      setStatusFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        await refreshRoleClaims(false).catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const allSpecOptions = SWIMMING_SPECIALTIES_9;

  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[1120px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
        {/* Hero */}
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 md:p-10 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label w-fit">
              <Icon name="verified" className="text-[16px]" />
              <span>التوثيق والمطالبة المجانية بالصفحات — 0% عمولة على الاشتراكات</span>
            </div>
            <h1 className="font-hero-headline text-[30px] md:text-[34px] text-surface-card leading-tight">
              {lockedRoleMode === "facility"
                ? "أضف منشأتك أو أكاديميتك وحدد موقعها على الخريطة مجاناً"
                : lockedRoleMode === "coach"
                ? "وثّق ملفك وشهاداتك ككابتن معتمد في أقل من 3 دقائق"
                : "سجّل منشأتك أو أكاديميتك مجاناً أو وثّق ملفك ككابتن"}
            </h1>
            <p className="font-body-default text-surface-container-high">
              تظهر المنشأة أو الأكاديمية للسبّاحين فوراً فور حفظ بياناتها وتحديد موقعها على الخريطة، بينما تبقى أوراق التوثيق بالشارة الخضراء خطوة اختيارية لتعزيز الثقة والأفضلية في الظهور.
            </p>
          </div>

          {!lockedRoleMode ? (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 bg-deep-carbon p-1.5 rounded-full">
              <button
                type="button"
                onClick={() => switchTabMode("facility")}
                className={`px-5 py-2.5 rounded-full font-badge-label text-badge-label transition-all ${
                  effectiveMode === "facility"
                    ? "bg-electric-volt text-dark-slate"
                    : "text-surface-container-high hover:text-white"
                }`}
              >
                إدارة نادي / أكاديمية
              </button>
              <button
                type="button"
                onClick={() => switchTabMode("coach")}
                className={`px-5 py-2.5 rounded-full font-badge-label text-badge-label transition-all ${
                  effectiveMode === "coach"
                    ? "bg-electric-volt text-dark-slate"
                    : "text-surface-container-high hover:text-white"
                }`}
              >
                تسجيل وتوثيق كابتن
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label shrink-0">
              {lockedRoleMode === "facility" ? "صلاحية حساب منشأة / أكاديمية ✓" : "صلاحية حساب كابتن ✓"}
            </div>
          )}
        </section>

        {/* Active User Claims Status Tracker */}
        {myClaims.length > 0 && (
          <section className="bg-surface-card rounded-[20px] p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-card-title-sm text-dark-slate flex items-center gap-2">
                <Icon name="pending_actions" className="text-[18px] text-deep-olive" />
                <span>سجل طلبات التوثيق الخاصة بك ({myClaims.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => refreshRoleClaims(false)}
                className="text-xs font-bold text-deep-olive hover:underline"
              >
                تحديث الحالة ↻
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myClaims.map((claim) => {
                const badge =
                  claim.status === "approved"
                    ? { text: "معتمد ومفعل ✓", cls: "bg-lime-tint text-deep-olive" }
                    : claim.status === "rejected"
                    ? { text: "مرفوض — راجع الملاحظة", cls: "bg-red-50 text-status-danger" }
                    : claim.status === "withdrawn"
                    ? { text: "تم سحب الطلب", cls: "bg-surface-container text-text-muted" }
                    : { text: "قيد المراجعة الإدارية ⏳", cls: "bg-amber-50 text-amber-900" };
                return (
                  <div
                    key={claim.id}
                    className="rounded-xl bg-surface-snow p-3.5 border border-surface-container flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-dark-slate">
                        {claim.claimType === "facility"
                          ? `إدارة منشأة: ${claim.targetFacilityNameAr || claim.targetFacilityId || ""}`
                          : `توثيق كابتن: ${claim.applicantNameAr}`}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </div>
                    {claim.reviewerNoteAr && (
                      <p className="text-text-muted leading-relaxed">
                        ملاحظة المراجع: {claim.reviewerNoteAr}
                      </p>
                    )}
                    {claim.status === "pending_review" && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            await reviewRoleClaim(claim.id, "withdraw");
                          }}
                          className="text-[11px] font-bold text-status-danger hover:underline"
                        >
                          سحب الطلب
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {statusFeedback && (
          <div
            className={`rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
              statusFeedback.ok
                ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                : "bg-red-50 border-red-300 text-red-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={statusFeedback.ok ? "check_circle" : "warning"}
                className={`text-[22px] mt-0.5 ${statusFeedback.ok ? "text-deep-olive" : "text-red-600"}`}
              />
              <div>
                <p className="font-card-title-sm text-card-title-sm">{statusFeedback.msg}</p>
                {statusFeedback.ok && effectiveMode === "coach" && (
                  <p className="text-xs text-deep-olive mt-1 font-bold">
                    حالة الطلب: ⏳ قيد المراجعة — حساب السبّاح/ولي الأمر ({currentPersona.memberCode}) مستمر بالعمل دون انقطاع.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {statusFeedback.ok && effectiveMode === "facility" && publishedFacilitySlug && (
                <>
                  <Link
                    href={`/academy/${publishedFacilitySlug}`}
                    className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-badge-label shadow-sm"
                  >
                    عرض الصفحة العامة ←
                  </Link>
                  <Link
                    href="/dashboard/facility"
                    className="px-4 py-2 rounded-full bg-surface-card text-dark-slate font-badge-label text-badge-label shadow-sm border border-surface-container"
                  >
                    فتح لوحة المنشأة
                  </Link>
                </>
              )}
              <Link
                href="/dashboard/athlete"
                className="px-4 py-2 rounded-full bg-surface-card text-dark-slate font-badge-label text-badge-label shadow-sm shrink-0"
              >
                العودة لمساحتي
              </Link>
            </div>
          </div>
        )}

        {effectiveMode === "facility" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <form
              onSubmit={handleFacilityClaimSubmit}
              className="lg:col-span-8 bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    {linkedExistingFacility
                      ? `تحديث بيانات ومواقع «${linkedExistingFacility.nameAr}»`
                      : "إنشاء ونشر صفحة المنشأة / الأكاديمية مجاناً"}
                  </h2>
                  <p className="font-body-compact text-text-muted mt-1">
                    اكتب اسم المنشأة وحدد موقعها الدقيق عبر البحث أو الخريطة التفاعلية — وتظهر صفحتك للسبّاحين فوراً بعد الحفظ.
                  </p>
                </div>
                <AvatarUploader
                  size="lg"
                  shape="rounded"
                  initialUrl={facilityHeroImage}
                  titleAr="ضبط وتكبير شعار / صورة المنشأة"
                  labelAr={
                    linkedExistingFacility ? "تغيير صورة المنشأة" : "شعار أو صورة المنشأة (اختياري)"
                  }
                  onLocalSelect={async (dataUrl) => {
                    if (linkedExistingFacility) {
                      const res = await updateFacilityHeroImage(linkedExistingFacility.id, dataUrl);
                      if (res.ok) {
                        setFacilityHeroImage(dataUrl);
                      }
                      return res;
                    }
                    setFacilityHeroImage(dataUrl);
                    return {
                      ok: true,
                      messageAr: "تم اختيار الصورة ✓ اضغط حفظ ونشر المنشأة بالأسفل لاعتمادها",
                    };
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">
                    اسم المنشأة أو الأكاديمية *
                  </label>
                  <input
                    required
                    value={facilityNameAr}
                    onChange={(e) => setFacilityNameAr(e.target.value)}
                    placeholder="مثال: أكاديمية الدلفين للسباحة أو نادي الشرطة"
                    className="w-full rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">
                    وصف مختصر للبرامج أو المسابح (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={facilityDescAr}
                    onChange={(e) => setFacilityDescAr(e.target.value)}
                    placeholder="مثال: تعليم السباحة للأطفال والكبار، إعداد فرق، ومواعيد مستقلة للسيدات..."
                    className="w-full rounded-xl bg-surface-snow px-4 py-2.5 text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                {/* Delivery-App Style Location Picker + Unlimited Academy Club Slots */}
                <FacilityLocationsField
                  isAcademy={isAcademyMode}
                  onToggleAcademy={setIsAcademyMode}
                  locations={facilityLocations}
                  onChangeLocations={setFacilityLocations}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">الاسم الثلاثي للمسؤول *</label>
                  <input
                    required
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="مثال: ك. محمد عبد الرحمن"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">الصفة الإدارية *</label>
                  <input
                    required
                    value={roleTitleAr}
                    onChange={(e) => setRoleTitleAr(e.target.value)}
                    placeholder="مثال: مدير المنشأة / مؤسس الأكاديمية"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رقم الموبايل للتواصل *</label>
                  <input
                    required
                    type="tel"
                    dir="ltr"
                    value={facPhone}
                    onChange={(e) => setFacPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رقم الواتساب (اختياري)</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={facWhatsapp}
                    onChange={(e) => setFacWhatsapp(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رابط صفحة فيسبوك (اختياري)</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={facFacebook}
                    onChange={(e) => setFacFacebook(e.target.value)}
                    placeholder="https://facebook.com/academy"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رابط إنستاجرام (اختياري)</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={facInstagram}
                    onChange={(e) => setFacInstagram(e.target.value)}
                    placeholder="https://instagram.com/academy"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">السعر الشهري المبدئي (ج.م — اختياري)</label>
                  <input
                    type="number"
                    value={updatedPrice}
                    onChange={(e) => setUpdatedPrice(e.target.value)}
                    placeholder="مثال: 650"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">عنوان InstaPay (اختياري)</label>
                  <input
                    dir="ltr"
                    value={instapayHandle}
                    onChange={(e) => setInstapayHandle(e.target.value)}
                    placeholder="academy@instapay"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                {/* Optional Green Verification Docs */}
                <div className="md:col-span-2 rounded-2xl bg-surface-snow border border-surface-container p-4 flex flex-col gap-3 mt-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-badge-label text-dark-slate flex items-center gap-1.5">
                      <Icon name="verified" className="text-[17px] text-deep-olive" />
                      <span>أوراق التوثيق للشارة الخضراء (اختياري — ليس إجبارياً للنشر)</span>
                    </span>
                    <span className="text-[11px] font-bold text-deep-olive bg-lime-tint px-2.5 py-0.5 rounded-full">
                      يرفع أولوية ظهورك
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    ستظهر صفحتك فوراً للسبّاحين حتى لو تركت هذا القسم فارغاً. وإذا أرفقت السجل أو خطاب التفويض الآن سنراجعه لمنحك الشارة الخضراء وأولوية الظهور.
                  </p>

                  <input
                    value={commercialRef}
                    onChange={(e) => setCommercialRef(e.target.value)}
                    placeholder="رقم السجل التجاري أو خطاب التفويض من النادي (اختياري)"
                    className="rounded-xl bg-surface-card px-4 py-2.5 text-xs text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2 rounded-xl bg-surface-card border border-surface-container text-xs font-bold text-dark-slate cursor-pointer hover:border-deep-olive">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleProofFileUpload(e.target.files?.[0] || null, setFacProofDocUrl)
                        }
                      />
                      {facProofDocUrl ? "تغيير صورة المستند ✓" : "رفع صورة مستند (اختياري)"}
                    </label>
                    <input
                      dir="ltr"
                      value={facProofDocUrl.startsWith("data:") ? "" : facProofDocUrl}
                      onChange={(e) => setFacProofDocUrl(e.target.value)}
                      placeholder="أو رابط المستند https://..."
                      className="flex-1 min-w-[200px] rounded-xl bg-surface-card px-3.5 py-2 text-xs text-dark-slate outline-none border border-surface-container text-left"
                    />
                  </div>
                  {facProofDocUrl && facProofDocUrl.startsWith("data:") && (
                    <img
                      src={facProofDocUrl}
                      alt="معاينة مستند المنشأة"
                      className="h-24 w-auto object-contain rounded-xl border border-surface-container self-start bg-white p-1"
                    />
                  )}
                  <input
                    value={facProofNotes}
                    onChange={(e) => setFacProofNotes(e.target.value)}
                    placeholder="ملاحظات إضافية لفريق المراجعة (اختياري)"
                    className="rounded-xl bg-surface-card px-4 py-2 text-xs text-dark-slate outline-none border border-surface-container"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-card-title hover:opacity-95 transition-opacity shadow-md disabled:opacity-60"
              >
                {submitting
                  ? "جاري النشر والحفظ..."
                  : linkedExistingFacility
                  ? "حفظ التعديلات والمواقع فوراً ←"
                  : "نشر المنشأة / الأكاديمية فوراً على كابتنلي ←"}
              </button>
            </form>

            <aside className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">كيف يعمل نظام النشر والمواقع؟</h3>
                <ul className="flex flex-col gap-2.5 font-body-compact text-text-muted">
                  <li className="flex items-start gap-2">
                    <Icon name="bolt" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>تظهر صفحتك في البحث والرئيسية فوراً دون انتظار بمجرد تحديد الموقع والحفظ.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="pin_drop" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>تحديد الموقع الدقيق يميّز فروعك (مثل المحلة vs طنطا) حتى لو تشابهت الأسماء.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="add_location_alt" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>للأكاديميات: فعّل خيار «أكاديمية تعمل داخل نادي» لإضافة كل فروعك بعدد غير محدود.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="verified" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>توثيق الشارة الخضراء اختياري لكنه يمنحك أفضلية في الترتيب وثقة أعلى لدى السباحين.</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <form
              onSubmit={handleCoachVerifySubmit}
              className="lg:col-span-8 bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    سجّل ووثّق ملفك ككابتن للحصول على الشارات الخضراء
                  </h2>
                  <p className="font-body-compact text-text-muted mt-1">
                    لا ننشر أي مدرب غير مسجل بنفسه. أكمل بياناتك المهنية ليظهر بروفايلك للسباحين والأهالي فوراً بعد استيفاء معايير التوثيق الرياضي المعتمدة.
                  </p>
                </div>
                <AvatarUploader
                  size="lg"
                  initialUrl={coachAvatarUrl}
                  titleAr="ضبط وتكبير الصورة الشخصية للكابتن"
                  labelAr="صورة الكابتن الشخصية"
                  onLocalSelect={async (dataUrl) => {
                    const res = await updateCurrentPersonaAvatar(dataUrl);
                    if (res.ok) {
                      setCoachAvatarUrl(dataUrl);
                    }
                    return res;
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">اسم الكابتن بالكامل *</label>
                  <input
                    required
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    placeholder="كابتن أحمد الشناوي"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">المسمى التدريبي *</label>
                  <input
                    required
                    value={coachTitle}
                    onChange={(e) => setCoachTitle(e.target.value)}
                    placeholder="مثال: مدرب سباحة وإنقاذ مائي"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رقم الموبايل للتوثيق *</label>
                  <input
                    required
                    type="tel"
                    dir="ltr"
                    value={coachPhone}
                    onChange={(e) => setCoachPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رقم الواتساب للتواصل (اختياري)</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={coachWhatsapp}
                    onChange={(e) => setCoachWhatsapp(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">حساب فيسبوك (اختياري)</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={coachFacebook}
                    onChange={(e) => setCoachFacebook(e.target.value)}
                    placeholder="https://facebook.com/coach"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">حساب إنستاجرام (اختياري)</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={coachInstagram}
                    onChange={(e) => setCoachInstagram(e.target.value)}
                    placeholder="https://instagram.com/coach"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">التخصص الرياضي</label>
                  <div className="rounded-xl bg-surface-snow px-4 py-3 text-deep-olive font-bold border border-surface-container text-sm">
                    سباحة وإنقاذ مائي (السباحة فقط حالياً)
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">المدينة *</label>
                  <select
                    required
                    value={coachCity}
                    onChange={(e) => setCoachCity(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  >
                    <option value="">-- اختر المدينة / المحافظة --</option>
                    {EGYPT_CITY_PRESETS.map((preset) => (
                      <option key={preset.city} value={preset.city}>
                        {preset.city} ({preset.governorate})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">سنوات الخبرة</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={yearsExp}
                    onChange={(e) => setYearsExp(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">
                    رقم كارنيه النقابة / شهادة الاتحاد *
                  </label>
                  <input
                    required
                    value={syndicateRef}
                    onChange={(e) => setSyndicateRef(e.target.value)}
                    placeholder="مثال: SYN-2026-4418"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">شهادة الإنقاذ EDLF (اختياري)</label>
                  <input
                    value={edlfRef}
                    onChange={(e) => setEdlfRef(e.target.value)}
                    placeholder="EDLF-7782"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">سعر باقة 8 حصص (ج.م)</label>
                  <input
                    type="number"
                    value={pkg8Egp}
                    onChange={(e) => setPkg8Egp(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">سعر باقة 12 حصة (ج.م)</label>
                  <input
                    type="number"
                    value={pkg12Egp}
                    onChange={(e) => setPkg12Egp(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">
                    الانتساب لأكاديمية أو نادي (اختياري)
                  </label>
                  <select
                    value={affiliatedFacId}
                    onChange={(e) => setAffiliatedFacId(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  >
                    <option value="">مدرب حر / مستقل</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nameAr} — {f.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">النبذة والخبرة التدريبية</label>
                  <textarea
                    rows={3}
                    required
                    value={coachBio}
                    onChange={(e) => setCoachBio(e.target.value)}
                    placeholder="اكتب نبذتك المهنية وتخصصك في تعليم أو تدريب السباحة..."
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="font-badge-label text-dark-slate">
                    صورة كارنيه النقابة / الشهادة المعتمدة للتحقق (اختياري)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2 rounded-xl bg-surface-snow border border-surface-container text-xs font-bold text-dark-slate cursor-pointer hover:border-deep-olive">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleProofFileUpload(e.target.files?.[0] || null, setCoachProofDocUrl)
                        }
                      />
                      {coachProofDocUrl ? "تغيير صورة الكارنيه ✓" : "رفع صورة الكارنيه / الشهادة"}
                    </label>
                    <input
                      dir="ltr"
                      value={coachProofDocUrl.startsWith("data:") ? "" : coachProofDocUrl}
                      onChange={(e) => setCoachProofDocUrl(e.target.value)}
                      placeholder="أو رابط الشهادة https://..."
                      className="flex-1 min-w-[200px] rounded-xl bg-surface-snow px-3.5 py-2 text-xs text-dark-slate outline-none border border-surface-container text-left"
                    />
                  </div>
                  {coachProofDocUrl && coachProofDocUrl.startsWith("data:") && (
                    <img
                      src={coachProofDocUrl}
                      alt="معاينة شهادة الكابتن"
                      className="h-24 w-auto object-contain rounded-xl border border-surface-container self-start bg-white p-1"
                    />
                  )}
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="font-badge-label text-dark-slate">التخصصات الدقيقة</label>
                  <div className="flex flex-wrap gap-2">
                    {allSpecOptions.map((spec) => {
                      const active = selectedSpecs.includes(spec);
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleSpec(spec)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            active
                              ? "bg-dark-slate text-electric-volt"
                              : "bg-surface-snow text-text-muted hover:text-dark-slate"
                          }`}
                        >
                          {spec}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-card-title hover:opacity-95 transition-opacity shadow-md disabled:opacity-60"
              >
                {submitting ? "جاري إرسال طلب التوثيق..." : "إرسال طلب التوثيق ككابتن للمراجعة الإدارية ←"}
              </button>
            </form>

            <aside className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">ميثاق توثيق الكباتن</h3>
                <p className="font-body-compact text-text-muted">
                  تلتزم كابتنلي بعدم نشر أي مدرب دون فحص مستنداته المهنية ومخالفة قانون 3 لسنة 1985. بعد إرسال الطلب والموافقة عليه:
                </p>
                <ul className="flex flex-col gap-2 font-body-compact text-text-muted">
                  <li className="flex items-start gap-2">
                    <Icon name="pending_actions" className="text-[18px] text-deep-olive shrink-0" />
                    <span>يبقى حساب السبّاح/ولي الأمر مفعلاً لديك خلال فترة المراجعة (24–48 ساعة).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="verified" className="text-[18px] text-deep-olive shrink-0" />
                    <span>عند الاعتماد تظهر الشارات الخضراء رسمياً وتُفتح لوحة الكابتن والـ QR.</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
