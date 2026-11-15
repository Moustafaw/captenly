"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { SWIMMING_SPECIALTIES_9 } from "@/data/seedData";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

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

  // Facility claim state
  const claimableFacilities = useMemo(
    () => facilities.filter((f) => f.supplyStatus !== "verified_active"),
    [facilities]
  );
  const preselected = useMemo(
    () =>
      facilities.find((f) => f.slug === initialSlug) ||
      claimableFacilities[0] ||
      facilities[0],
    [facilities, claimableFacilities, initialSlug]
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(preselected?.id || "");
  const [managerName, setManagerName] = useState(currentPersona.fullNameAr || "");
  const [roleTitleAr, setRoleTitleAr] = useState("");
  const [facPhone, setFacPhone] = useState(currentPersona.phone || "");
  const [facWhatsapp, setFacWhatsapp] = useState("");
  const [facFacebook, setFacFacebook] = useState("");
  const [facInstagram, setFacInstagram] = useState("");
  const [instapayHandle, setInstapayHandle] = useState("");
  const [updatedPrice, setUpdatedPrice] = useState<string>(
    preselected?.pricePackages[0]?.baseMonthlyEgp
      ? String(preselected.pricePackages[0].baseMonthlyEgp)
      : ""
  );
  const [commercialRef, setCommercialRef] = useState("");
  const [facProofDocUrl, setFacProofDocUrl] = useState("");
  const [facProofNotes, setFacProofNotes] = useState("");
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
  const [affiliatedFacId, setAffiliatedFacId] = useState<string>(preselected?.id || "");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || preselected;

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
    if (!selectedFacility || submitting) return;
    setSubmitting(true);
    setStatusFeedback(null);
    try {
      const res = await submitRoleClaimApplication({
        claimType: "facility",
        targetFacilityId: selectedFacility.id,
        fullNameAr: managerName.trim() || currentPersona.fullNameAr,
        managerName: managerName.trim(),
        roleTitleAr,
        phone: facPhone.trim(),
        city: selectedFacility.city,
        governorate: selectedFacility.governorate,
        whatsappNumber: facWhatsapp.trim() || undefined,
        facebookUrl: facFacebook.trim() || undefined,
        instagramUrl: facInstagram.trim() || undefined,
        instapayHandle: instapayHandle.trim() || undefined,
        updatedBasePriceEgp: Number(updatedPrice) || undefined,
        commercialRegRef: commercialRef.trim() || undefined,
        proofDocumentUrl: facProofDocUrl.trim() || undefined,
        proofNotesAr:
          facProofNotes.trim() ||
          `مطالبة إدارة ${selectedFacility.nameAr}${commercialRef.trim() ? ` — مرجع: ${commercialRef.trim()}` : ""}`,
      });
      setStatusFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        await refreshRoleClaims(false).catch(() => undefined);
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
                ? "إدارة وتوثيق منشأتك أو ناديك مجاناً بالشارة الخضراء"
                : lockedRoleMode === "coach"
                ? "وثّق ملفك وشهاداتك ككابتن معتمد في أقل من 3 دقائق"
                : "طالب بإدارة منشأتك أو وثّق ملفك ككابتن للمراجعة الإدارية"}
            </h1>
            <p className="font-body-default text-surface-container-high">
              تُراجع طلبات المنشآت والكباتن عبر فريق كابتنلي قبل تفعيل الشارات الخضراء ولوحة الإدارة، ويبقى حسابك الحالي مفعلاً بالكامل لحين صدور الاعتماد.
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
                name={statusFeedback.ok ? "schedule_send" : "warning"}
                className={`text-[22px] mt-0.5 ${statusFeedback.ok ? "text-deep-olive" : "text-red-600"}`}
              />
              <div>
                <p className="font-card-title-sm text-card-title-sm">{statusFeedback.msg}</p>
                {statusFeedback.ok && (
                  <p className="text-xs text-deep-olive mt-1 font-bold">
                    حالة الطلب: ⏳ قيد المراجعة — حساب السبّاح/ولي الأمر ({currentPersona.memberCode}) مستمر بالعمل دون انقطاع.
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/dashboard/athlete"
              className="px-4 py-2 rounded-full bg-surface-card text-dark-slate font-badge-label text-badge-label shadow-sm shrink-0"
            >
              العودة لمساحتي
            </Link>
          </div>
        )}

        {effectiveMode === "facility" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <form
              onSubmit={handleFacilityClaimSubmit}
              className="lg:col-span-8 bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-5"
            >
              <div>
                <h2 className="font-section-title text-section-title text-dark-slate">
                  استلام وإدارة صفحة المنشأة / النادي مجاناً
                </h2>
                <p className="font-body-compact text-text-muted mt-1">
                  بمجرد تأكيد بيانات المسؤول، يتم تفعيل الشارة الخضراء وفتح لوحة تفعيل دفاتر الحصص للمشتركين.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">اختر المنشأة المطلوب استلامها</label>
                  <select
                    value={selectedFacilityId}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                    className="w-full rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  >
                    {facilities.map((f) => (
                      <option
                        key={f.id}
                        value={f.id}
                        disabled={f.supplyStatus === "verified_active"}
                      >
                        {f.nameAr} — {f.city} (
                        {f.supplyStatus === "seeded_unclaimed" ? "بانتظار التفعيل" : "موثقة بالفعل — لا يمكن إعادة الاستلام"})
                      </option>
                    ))}
                  </select>
                  {facilities.find((f) => f.id === selectedFacilityId)?.supplyStatus === "verified_active" && (
                    <p className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-1">
                      هذه المنشأة موثقة ومفعلة بالفعل ولا يمكن إعادة المطالبة بها. اختر منشأة بانتظار التفعيل من القائمة.
                    </p>
                  )}
                </div>

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
                    placeholder="مثال: مدير المنشأة / المسؤول الرسمي"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">رقم الموبايل للتوثيق *</label>
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

                <div className="md:col-span-2 text-[11px] font-semibold text-deep-olive bg-lime-tint/40 rounded-xl px-3.5 py-2">
                  مطلوب وسيلة تواصل عامة واحدة على الأقل (واتساب أو فيسبوك أو إنستاجرام) ليتمكن السباحون من الوصول إليكم مباشرة.
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">تأكيد أو تحديث السعر الأساسي (ج.م)</label>
                  <input
                    type="number"
                    value={updatedPrice}
                    onChange={(e) => setUpdatedPrice(e.target.value)}
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

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="font-badge-label text-dark-slate">
                    مرجع السجل التجاري / ترخيص النشاط الرياضي (اختياري)
                  </label>
                  <input
                    value={commercialRef}
                    onChange={(e) => setCommercialRef(e.target.value)}
                    placeholder="رقم السجل أو خطاب التفويض من النادي"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-2 pt-1">
                  <label className="font-badge-label text-dark-slate">
                    إثبات الإدارة أو التفويض (صورة كارنيه / سجل / تفويض رسمي)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2 rounded-xl bg-surface-snow border border-surface-container text-xs font-bold text-dark-slate cursor-pointer hover:border-deep-olive">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleProofFileUpload(e.target.files?.[0] || null, setFacProofDocUrl)
                        }
                      />
                      {facProofDocUrl ? "تغيير صورة المستند ✓" : "رفع صورة المستند (PNG/JPG)"}
                    </label>
                    <input
                      dir="ltr"
                      value={facProofDocUrl.startsWith("data:") ? "" : facProofDocUrl}
                      onChange={(e) => setFacProofDocUrl(e.target.value)}
                      placeholder="أو ضع رابط المستند https://..."
                      className="flex-1 min-w-[200px] rounded-xl bg-surface-snow px-3.5 py-2 text-xs text-dark-slate outline-none border border-surface-container text-left"
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
                    className="rounded-xl bg-surface-snow px-4 py-2.5 text-xs text-dark-slate outline-none border border-surface-container"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || selectedFacility?.supplyStatus === "verified_active"}
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-card-title hover:opacity-95 transition-opacity shadow-md disabled:opacity-60"
              >
                {submitting ? "جاري إرسال الطلب..." : "إرسال طلب توثيق المنشأة للمراجعة الإدارية ←"}
              </button>
            </form>

            <aside className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">مسار مراجعة واعتماد المنشآت</h3>
                <ul className="flex flex-col gap-2.5 font-body-compact text-text-muted">
                  <li className="flex items-start gap-2">
                    <Icon name="pending_actions" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>يراجع فريق كابتنلي مستندات الإدارة خلال 24–48 ساعة لمنع انتحال الصفحات.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="check_circle" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>فور الاعتماد تظهر شارات التوثيق الخضراء وتُفتح لوحة المنشأة والـ QR.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="payments" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>تحصيل اشتراكاتك مباشرة بدون أي عمولة (0%) من كابتنلي.</span>
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
                  onLocalSelect={setCoachAvatarUrl}
                  labelAr="صورة الكابتن الشخصية"
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
