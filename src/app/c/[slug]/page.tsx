"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Award,
  ShieldCheck,
  QrCode,
  MapPin,
  Calendar,
  MessageCircle,
  CheckCircle2,
  Building2,
  Share2,
} from "lucide-react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { CaptenlyLogo } from "@/components/CaptenlyLogo";

export default function CoachPublicProfilePage() {
  const params = useParams<{ slug: string }>();
  const { coaches, createStructuredWhatsappLead, currentPersona } = useCaptenly();

  const coach = coaches.find((c) => c.slug === params.slug) || coaches[0];

  const [inquirerName, setInquirerName] = useState(currentPersona.fullNameAr);
  const [inquirerPhone, setInquirerPhone] = useState(
    currentPersona.phone || "01012345678"
  );
  const [athleteAge, setAthleteAge] = useState<number>(10);
  const [requestedSpecialty, setRequestedSpecialty] = useState<string>(
    coach.specialties[0]?.nameAr || "تأسيس سباحة"
  );
  const [leadGenerated, setLeadGenerated] = useState<{
    referralCode: string;
    whatsappUrl: string;
  } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleBookPrivateCoach = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createStructuredWhatsappLead({
      targetType: "coach",
      targetId: coach.id,
      targetNameAr: coach.fullNameAr,
      whatsappNumber: coach.whatsappNumber,
      inquirerNameAr: inquirerName,
      inquirerPhone,
      athleteAge,
      requestedSpecialtyAr: requestedSpecialty,
      preferredScheduleAr: "مجموعة برايفت / تدريب شخصي",
    });
    setLeadGenerated(res);
  };

  const getCredibilityTierLabel = (
    tier: "official_credential" | "reviewed_qualification" | "self_declared"
  ) => {
    switch (tier) {
      case "official_credential":
        return "شهادة رسمية معتمدة (كلية علوم الرياضة / اتحاد)";
      case "reviewed_qualification":
        return "خبرة ودورة تمت مراجعة مستندها";
      default:
        return "تخصص معلن ذاتياً";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Coach Hero Header */}
      <div className="bg-captenly-slate text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-inter text-xs font-black bg-captenly-volt text-captenly-slate px-3 py-1 rounded-full">
              Single Coach ID: {coach.SingleCoachId}
            </span>
            <span className="text-xs font-extrabold bg-white/10 text-captenly-tint px-3 py-1 rounded-full">
              0% عمولة على حصص الكابتن (MVP-05)
            </span>
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full">
              خبرة {coach.yearsExperience} سنوات • {coach.activeAthletesCount} لاعب نشط
            </span>
          </div>

          <button
            onClick={() => setShowQrModal(!showQrModal)}
            className="inline-flex items-center gap-2 bg-captenly-volt hover:brightness-105 text-captenly-slate font-black text-xs px-4 py-2.5 rounded-xl shadow-volt transition"
          >
            <QrCode className="w-4 h-4" />
            <span>{showQrModal ? "إخفاء كارت QR الكابتن" : "عرض كارت الفخر المهني (QR Card)"}</span>
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black">{coach.fullNameAr}</h1>
          <p className="text-sm sm:text-base text-captenly-tint font-bold">
            {coach.titleAr}
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            {coach.bioAr}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-captenly-volt" />
            <span>
              نطاق العمل: {coach.city} — محافظة {coach.governorate}
            </span>
          </span>
          <span>• حساب إنستاباي الموثق: {coach.instapayHandle}</span>
        </div>

        {/* Printable / Shareable Coach QR Pride Card (MVP-08) */}
        {showQrModal && (
          <div className="bg-captenly-carbon border-2 border-captenly-volt rounded-3xl p-6 max-w-md mx-auto text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <CaptenlyLogo variant="horizontal" theme="dark" size="sm" />
              <span className="font-inter text-xs font-black text-captenly-volt">
                {coach.SingleCoachId}
              </span>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">{coach.fullNameAr}</h3>
              <p className="text-xs text-slate-300">{coach.titleAr}</p>
            </div>
            {/* Simulated High-Contrast QR Box */}
            <div className="bg-white text-captenly-slate w-44 h-44 mx-auto rounded-2xl p-4 flex flex-col items-center justify-center border-4 border-captenly-volt">
              <QrCode className="w-28 h-28 text-captenly-slate" />
              <span className="font-inter text-[10px] font-black mt-1">
                {coach.qrCodeToken}
              </span>
            </div>
            <p className="text-xs text-captenly-tint">
              امسح الكود لفتح الشهادات الموثقة، جدول المواعيد، وتفعيل دفتر الحصص الأوفلاين.
            </p>
          </div>
        )}
      </div>

      {/* Main Two-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Right Column (7 cols): 6 Badges + Weekly Multi-Facility Schedule + Credibility Tiers */}
        <div className="lg:col-span-7 space-y-6">
          {/* Independent Badges Section (MVP-06) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-captenly-slate flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-captenly-olive" />
                <span>الشارات المستقلة الموثقة للكابتن (MVP-06)</span>
              </h2>
              <span className="text-[11px] font-bold bg-captenly-tint text-captenly-olive px-2.5 py-1 rounded-lg">
                مراجعة مستندية خلال 24–48 ساعة
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {coach.badges.map((b) => (
                <div
                  key={b.code}
                  className="bg-captenly-soft border border-captenly-olive/30 rounded-2xl p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-captenly-olive flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      {b.titleAr}
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      سارية ✓
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-captenly-slate">
                    الجهة المصدرة: {b.authorityAr}
                  </div>
                  <p className="text-[11px] text-slate-600">{b.descriptionAr}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-captenly-olive/10">
                    <span>تاريخ الفحص: {b.verifiedDate}</span>
                    {b.expiresDate && (
                      <span className="font-bold text-amber-800">
                        تنتهي: {b.expiresDate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Facility Weekly Schedule (Governance Rule #1, #2, #3) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
            <div>
              <h2 className="text-lg font-black text-captenly-slate flex items-center gap-2">
                <Calendar className="w-5 h-5 text-captenly-olive" />
                <span>الجدول الأسبوعي الموحد عبر الأندية والأكاديميات</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                بفضل الهوية الموحدة (Single Coach ID)، يجمع الكابتن كل أماكن شغله في رابط واحد بموافقة ثنائية متبادلة.
              </p>
            </div>

            <div className="space-y-3">
              {coach.affiliations
                .filter((a) => a.status === "active_mutual")
                .map((aff) => (
                  <div
                    key={aff.facilityId}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-captenly-olive" />
                        <span className="font-black text-sm text-captenly-slate">
                          {aff.facilityNameAr}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          ربط ثنائي مؤكد ✓
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-semibold">
                        الدور: {aff.roleAr} | المدينة: {aff.city}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-extrabold text-captenly-olive">
                      📅 {aff.scheduleAr}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 3-Tier Specialty Credibility Classification (Brand Strategy p. 27) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
            <h2 className="text-lg font-black text-captenly-slate">
              التخصصات المعتمدة ومستوى مصداقية كل تخصص (3 مستويات)
            </h2>
            <div className="space-y-2.5">
              {coach.specialties.map((sp) => (
                <div
                  key={sp.nameAr}
                  className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs"
                >
                  <span className="font-extrabold text-captenly-slate">
                    ✓ {sp.nameAr}
                  </span>
                  <span className="bg-captenly-tint text-captenly-olive font-bold px-2.5 py-1 rounded-lg text-[11px]">
                    {getCredibilityTierLabel(sp.credibilityTier)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Left Column (5 cols): Direct Private Package Booking (Rule #4 Lead Attribution Boundary) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 bg-captenly-slate text-white rounded-3xl p-6 border-2 border-captenly-volt shadow-2xl space-y-5">
            <div className="space-y-1 border-b border-white/10 pb-4">
              <span className="bg-captenly-volt text-captenly-slate text-xs font-black px-3 py-0.5 rounded-full">
                قاعدة الحوكمة #4 • 0% عمولة على الكابتن
              </span>
              <h3 className="text-xl font-black pt-1">
                احجز باقة تدريب خاص (برايفت / PT) مع {coach.fullNameAr}
              </h3>
              <p className="text-xs text-slate-300">
                بما أنك داخل الملف المستقل للكابتن، طلبك يذهب مباشرة لواتساب الكابتن الشخصي بـ 0% عمولة من المنصة.
              </p>
            </div>

            {/* Private Package Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 border border-captenly-volt/40 rounded-2xl p-3.5 text-center">
                <div className="text-xs text-captenly-tint font-bold">باقة 8 حصص برايفت</div>
                <div className="font-inter font-black text-2xl text-captenly-volt mt-1">
                  {coach.privatePackage8Egp} ج.م
                </div>
                <div className="text-[10px] text-slate-300">شاملة دفتر الحصص الأوفلاين</div>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-3.5 text-center">
                <div className="text-xs text-captenly-tint font-bold">باقة 12 حصة برايفت</div>
                <div className="font-inter font-black text-2xl text-white mt-1">
                  {coach.privatePackage12Egp} ج.م
                </div>
                <div className="text-[10px] text-slate-300">شاملة تقييم الـ 5 نقاط</div>
              </div>
            </div>

            <form onSubmit={handleBookPrivateCoach} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-captenly-tint mb-1">
                  اسم ولي الأمر أو المتدرب:
                </label>
                <input
                  type="text"
                  required
                  value={inquirerName}
                  onChange={(e) => setInquirerName(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-captenly-tint mb-1">
                    رقم الواتساب:
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquirerPhone}
                    onChange={(e) => setInquirerPhone(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-captenly-tint mb-1">
                    السن:
                  </label>
                  <input
                    type="number"
                    value={athleteAge}
                    onChange={(e) => setAthleteAge(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-captenly-tint mb-1">
                  التخصص المطلوب:
                </label>
                <select
                  value={requestedSpecialty}
                  onChange={(e) => setRequestedSpecialty(e.target.value)}
                  className="w-full bg-captenly-carbon border border-white/20 rounded-xl px-3 py-2.5 text-white font-bold"
                >
                  {coach.specialties.map((s) => (
                    <option key={s.nameAr} value={s.nameAr}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-captenly-volt hover:brightness-105 text-captenly-slate font-black text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-volt transition"
              >
                <MessageCircle className="w-5 h-5" />
                <span>تواصل مباشر مع الكابتن على واتساب (#CAP)</span>
              </button>
            </form>

            {leadGenerated && (
              <div className="bg-captenly-carbon border border-captenly-volt rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-captenly-volt font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    تم تجهيز طلب الحجز المباشر!
                  </span>
                  <span className="font-inter font-black bg-captenly-volt text-captenly-slate px-2 py-0.5 rounded">
                    {leadGenerated.referralCode}
                  </span>
                </div>
                <a
                  href={leadGenerated.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-emerald-500 text-captenly-carbon font-black text-xs py-2.5 rounded-xl"
                >
                  إرسال الرسالة لواتساب الكابتن الآن ↗
                </a>
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>هل أنت الكابتن صاحب هذا الملف؟</span>
              <Link
                href="/dashboard/coach"
                className="text-captenly-volt font-extrabold hover:underline"
              >
                افتح لوحة تحكم الكابتن ←
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
