"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { SWIMMING_SPECIALTIES_9 } from "@/data/seedData";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";

interface ClaimAndVerifyClientProps {
  initialSlug?: string;
  initialMode?: "facility" | "coach";
}

export function ClaimAndVerifyClient({
  initialSlug,
  initialMode = "facility",
}: ClaimAndVerifyClientProps) {
  const {
    facilities,
    claimFacilityAndVerify,
    registerAndVerifyCoach,
  } = useCaptenly();

  const [mode, setMode] = useState<"facility" | "coach">(initialMode);

  // Facility claim state
  const preselected = useMemo(
    () => facilities.find((f) => f.slug === initialSlug) || facilities[0],
    [facilities, initialSlug]
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(preselected?.id || "");
  const [managerName, setManagerName] = useState("");
  const [roleTitleAr, setRoleTitleAr] = useState("مدير المنشأة / المسؤول الرسمي");
  const [facPhone, setFacPhone] = useState("");
  const [facWhatsapp, setFacWhatsapp] = useState("");
  const [facFacebook, setFacFacebook] = useState("");
  const [facInstagram, setFacInstagram] = useState("");
  const [instapayHandle, setInstapayHandle] = useState("");
  const [updatedPrice, setUpdatedPrice] = useState<string>(
    preselected?.pricePackages[0]?.baseMonthlyEgp
      ? String(preselected.pricePackages[0].baseMonthlyEgp)
      : "700"
  );
  const [commercialRef, setCommercialRef] = useState("");
  const [claimSuccessFacSlug, setClaimSuccessFacSlug] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Coach verification state
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string>("");
  const [coachName, setCoachName] = useState("");
  const [coachTitle, setCoachTitle] = useState("مدرب سباحة وإنقاذ مائي معتمد");
  const [coachPhone, setCoachPhone] = useState("");
  const [coachWhatsapp, setCoachWhatsapp] = useState("");
  const [coachFacebook, setCoachFacebook] = useState("");
  const [coachInstagram, setCoachInstagram] = useState("");
  const [coachCity, setCoachCity] = useState("المحلة الكبرى");
  const [coachDistrict, setCoachDistrict] = useState("وسط المدينة");
  const [yearsExp, setYearsExp] = useState("6");
  const [coachBio, setCoachBio] = useState(
    "خبرة في تأسيس الأطفال وكسر رهبة الماء وبناء اللياقة البدنية وفق المعايير الرياضية المعتمدة."
  );
  const [pkg8Egp, setPkg8Egp] = useState("750");
  const [pkg12Egp, setPkg12Egp] = useState("1050");
  const [syndicateRef, setSyndicateRef] = useState("");
  const [edlfRef, setEdlfRef] = useState("");
  const [affiliatedFacId, setAffiliatedFacId] = useState<string>(preselected?.id || "");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>(["تأسيس أطفال"]);
  const [verifiedCoachSlug, setVerifiedCoachSlug] = useState<string | null>(null);
  const [verifiedCoachIdCode, setVerifiedCoachIdCode] = useState<string | null>(null);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || preselected;

  const toggleSpec = (spec: string) => {
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleFacilityClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;
    const res = claimFacilityAndVerify(selectedFacility.id, {
      managerName: managerName.trim(),
      roleTitleAr,
      phone: facPhone.trim(),
      whatsappNumber: facWhatsapp.trim() || undefined,
      facebookUrl: facFacebook.trim() || undefined,
      instagramUrl: facInstagram.trim() || undefined,
      instapayHandle: instapayHandle.trim() || undefined,
      updatedBasePriceEgp: Number(updatedPrice) || undefined,
      commercialRegRef: commercialRef.trim() || undefined,
    });
    setStatusFeedback({ ok: res.ok, msg: res.messageAr });
    if (res.ok && res.facility) {
      setClaimSuccessFacSlug(res.facility.slug);
    }
  };

  const handleCoachVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = registerAndVerifyCoach({
      fullNameAr: coachName.trim(),
      titleAr: coachTitle.trim(),
      phone: coachPhone.trim(),
      city: coachCity,
      governorate: "الغربية",
      district: coachDistrict.trim(),
      sportSector: "swimming",
      yearsExperience: Number(yearsExp) || 4,
      bioAr: coachBio.trim(),
      avatarUrl: coachAvatarUrl || undefined,
      whatsappNumber: coachWhatsapp.trim() || undefined,
      facebookUrl: coachFacebook.trim() || undefined,
      instagramUrl: coachInstagram.trim() || undefined,
      privatePackage8Egp: Number(pkg8Egp) || 700,
      privatePackage12Egp: Number(pkg12Egp) || 950,
      specialtiesAr: selectedSpecs,
      syndicateCardRef: syndicateRef.trim(),
      edlfCertRef: edlfRef.trim() || undefined,
      facilityId: affiliatedFacId || undefined,
    });
    setStatusFeedback({ ok: res.ok, msg: res.messageAr });
    if (res.ok && res.coach) {
      setVerifiedCoachSlug(res.coach.slug);
      setVerifiedCoachIdCode(res.coach.SingleCoachId);
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
              طالب بإدارة منشأتك أو وثّق ملفك ككابتن مجاناً في أقل من 3 دقائق
            </h1>
            <p className="font-body-default text-surface-container-high">
              تحوّل صفحتك فوراً إلى صفحة موثقة بشارات الأمان الخضراء، وتفتح لك لوحة التحكم لربط السباحين بكود العضوية وتفعيل دفاتر الحصص الأوفلاين.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 bg-deep-carbon p-1.5 rounded-full">
            <button
              type="button"
              onClick={() => {
                setMode("facility");
                setStatusFeedback(null);
              }}
              className={`px-5 py-2.5 rounded-full font-badge-label text-badge-label transition-all ${
                mode === "facility"
                  ? "bg-electric-volt text-dark-slate"
                  : "text-surface-container-high hover:text-white"
              }`}
            >
              إدارة نادي / أكاديمية
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("coach");
                setStatusFeedback(null);
              }}
              className={`px-5 py-2.5 rounded-full font-badge-label text-badge-label transition-all ${
                mode === "coach"
                  ? "bg-electric-volt text-dark-slate"
                  : "text-surface-container-high hover:text-white"
              }`}
            >
              تسجيل وتوثيق كابتن
            </button>
          </div>
        </section>

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
                name={statusFeedback.ok ? "verified" : "warning"}
                className={`text-[22px] mt-0.5 ${statusFeedback.ok ? "text-deep-olive" : "text-red-600"}`}
              />
              <div>
                <p className="font-card-title-sm text-card-title-sm">{statusFeedback.msg}</p>
                {verifiedCoachIdCode && (
                  <p className="font-mono text-xs mt-1 text-deep-olive">
                    كود الكابتن المعتمد: {verifiedCoachIdCode}
                  </p>
                )}
              </div>
            </div>

            {statusFeedback.ok && mode === "facility" && claimSuccessFacSlug && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/academy/${claimSuccessFacSlug}`}
                  className="px-4 py-2 rounded-full bg-surface-card text-dark-slate font-badge-label text-badge-label shadow-sm"
                >
                  معاينة الصفحة الموثقة
                </Link>
                <Link
                  href="/dashboard/facility"
                  className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-badge-label shadow-sm"
                >
                  فتح لوحة التحكم
                </Link>
              </div>
            )}

            {statusFeedback.ok && mode === "coach" && verifiedCoachSlug && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/c/${verifiedCoachSlug}`}
                  className="px-4 py-2 rounded-full bg-surface-card text-dark-slate font-badge-label text-badge-label shadow-sm"
                >
                  ملفي بالشارات الخضراء
                </Link>
                <Link
                  href="/dashboard/coach"
                  className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-badge-label shadow-sm"
                >
                  لوحة الكابتن والـ QR
                </Link>
              </div>
            )}
          </div>
        )}

        {mode === "facility" ? (
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
                      <option key={f.id} value={f.id}>
                        {f.nameAr} — {f.city} (
                        {f.supplyStatus === "seeded_unclaimed" ? "بانتظار التفعيل" : "موثقة"})
                      </option>
                    ))}
                  </select>
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
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-card-title hover:opacity-95 transition-opacity shadow-md"
              >
                اعتماد المطالبة وتوثيق الصفحة بالشارة الخضراء مجاناً
              </button>
            </form>

            <aside className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">ماذا تفتح لك المطالبة؟</h3>
                <ul className="flex flex-col gap-2.5 font-body-compact text-text-muted">
                  <li className="flex items-start gap-2">
                    <Icon name="check_circle" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>تفعيل شارة التوثيق الخضراء لصفحتك وتحديث بيانات المنشأة مباشرة.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="qr_code_2" className="text-[18px] text-deep-olive shrink-0 mt-0.5" />
                    <span>ربط المشتركين الجدد بكود العضوية وتفعيل دفاتر الحصص الأوفلاين.</span>
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
                    لا ننشر أي مدرب غير مسجل بنفسه. أكمل بياناتك المهنية ليظهر بروفايلك للسباحين والأهالي فوراً بعد اجتياز فحص المعايير والقانون 3/1985.
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
                  <label className="font-badge-label text-dark-slate">المدينة</label>
                  <select
                    value={coachCity}
                    onChange={(e) => setCoachCity(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  >
                    <option value="المحلة الكبرى">المحلة الكبرى</option>
                    <option value="طنطا">طنطا</option>
                    <option value="سمنود">سمنود</option>
                    <option value="زفتى">زفتى</option>
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
                  <label className="font-badge-label text-dark-slate">النبذة المهنية (تخضع لفحص القانون 3/1985)</label>
                  <textarea
                    rows={3}
                    required
                    value={coachBio}
                    onChange={(e) => setCoachBio(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                  />
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
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-card-title hover:opacity-95 transition-opacity shadow-md"
              >
                تسجيل وتوثيق ملفي وإصدار الشارات الخضراء
              </button>
            </form>

            <aside className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">ميثاق توثيق الكباتن</h3>
                <p className="font-body-compact text-text-muted">
                  تلتزم كابتنلي بعدم اختلاق أي ملف كابتن. بمجرد اعتماد شهاداتك برقم الهاتف والكارنيه:
                </p>
                <ul className="flex flex-col gap-2 font-body-compact text-text-muted">
                  <li className="flex items-start gap-2">
                    <Icon name="verified" className="text-[18px] text-deep-olive shrink-0" />
                    <span>تظهر الشارات الخضراء رسمياً في نتائج البحث.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="qr_code_scanner" className="text-[18px] text-deep-olive shrink-0" />
                    <span>تتمكن من إدخال كود العضوية للسباح لتفعيل باقته وQR الحضور أوفلاين.</span>
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
