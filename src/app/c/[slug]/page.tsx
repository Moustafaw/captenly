"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";
import { GuestFloatingAuthBar } from "@/components/auth/GuestFloatingAuthBar";
import { ShareButton } from "@/components/editorial/ShareButton";

export default function CoachPublicProfilePage({ params }: { params: { slug: string } }) {
  const {
    coaches,
    articles,
    createStructuredWhatsappLead,
    currentPersona,
    minorAthletes,
    isAuthenticated,
    openAuthGateModal,
  } = useCaptenly();
  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
  const isAthleteOrParent =
    isAuthenticated &&
    (currentPersona.role === "adult_athlete" || currentPersona.role === "parent");
  const coach = coaches.find((c) => c.slug === params.slug || c.id === params.slug);
  const coachArticles = coach
    ? articles.filter(
        (a) => a.authorEntityId === coach.id || a.authorNameAr.trim() === coach.fullNameAr.trim()
      )
    : [];

  const [leadCode, setLeadCode] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<8 | 12>(8);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

  if (!coach) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] pt-8 pb-16 px-margin lg:px-margin-desktop">
        <div className="max-w-2xl mx-auto bg-white border border-[#E2E8F0] rounded-3xl p-10 text-center shadow-[0_12px_36px_rgba(11,28,46,0.06)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/25 text-[#1D6E7D] flex items-center justify-center">
            <Icon name="verified_user" className="text-[32px] text-[#00ACC1]" />
          </div>
          <h1 className="font-section-title text-section-title text-[#0B1C2E] font-black">
            ملف الكابتن غير متوفر أو قيد التوثيق
          </h1>
          <p className="font-body-default text-[#64748B]">
            تظهر ملفات الكباتن المستقلة فقط بعد قيام الكابتن بتسجيل حسابه بنفسه واعتماد شهاداته للشارات الخضراء.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {isFacilityManager ? (
              <Link
                href="/dashboard/facility"
                className="px-6 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#165966] text-white font-bold text-sm transition"
              >
                إدارة كباتن منشأتك
              </Link>
            ) : !isAthleteOrParent ? (
              <Link
                href="/claim?mode=coach"
                className="px-6 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#165966] text-white font-bold text-sm transition"
              >
                سجّل ووثّق ككابتن الآن
              </Link>
            ) : null}
            <Link
              href="/coaches"
              className="px-6 py-2.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] font-bold text-sm hover:bg-[#1D6E7D] hover:text-white transition"
            >
              تصفح الدليل المعتمد
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleWhatsappLead = () => {
    const res = createStructuredWhatsappLead({
      targetType: "coach",
      targetId: coach.id,
      targetNameAr: coach.fullNameAr,
      whatsappNumber: coach.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: minorAthletes[0]?.age || 25,
      requestedSpecialtyAr: `${coach.specialties[0]?.nameAr || "تدريب سباحة"} (${selectedSessions} حصص)`,
      preferredScheduleAr: "بالتنسيق مع الكابتن",
    });
    setLeadCode(res.referralCode);
    if (res.whatsappUrl) {
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] pt-6 pb-20 lg:pb-16">
      <div className="max-w-[1180px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        {/* Option B Bright Luxury Coach Hero */}
        <section className="relative rounded-[24px] bg-white text-[#0F172A] p-6 md:p-8 border border-[#0F172A]/8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#EAF4F8]/80 blur-3xl"
          />
          <div className="relative z-10 lg:col-span-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {coach.avatarUrl ? (
              <img
                src={coach.avatarUrl}
                alt={coach.fullNameAr}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-[#1D6E7D] shadow-sm shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center font-extrabold text-2xl border-2 border-[#1D6E7D]/30 shrink-0">
                {coach.fullNameAr.slice(0, 2)}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 font-badge-label text-xs font-bold inline-flex items-center gap-1">
                  <Icon name="verified" className="text-[14px]" />
                  <span>كابتن موثق رسمياً</span>
                </span>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-[#F7F9FA] text-[#0F172A] border border-[#0F172A]/10">
                  {coach.SingleCoachId}
                </span>
                <ShareButton
                  title={`${coach.fullNameAr} — ${coach.titleAr || "كابتن سباحة موثق"} | كابتنلي`}
                  text={`ملف ${coach.fullNameAr} المعتمد على منصة كابتنلي (${coach.city})`}
                  label="مشاركة الملف"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] border border-[#E2E8F0] text-xs font-bold transition cursor-pointer"
                />
              </div>
              <h1 className="font-hero-headline text-[26px] md:text-[32px] text-[#0F172A]">
                {coach.fullNameAr}
              </h1>
              {coach.titleAr && (
                <p className="font-body-default text-[#475569]">{coach.titleAr}</p>
              )}
              <div className="flex flex-wrap gap-4 text-xs font-bold text-[#64748B] pt-1">
                <span className="inline-flex items-center gap-1">
                  <Icon name="location_on" className="text-[14px] text-[#1D6E7D]" />
                  <span>
                    {coach.city}
                    {coach.district ? ` • ${coach.district}` : ""}
                  </span>
                </span>
                {(coach.verifiedReviewsCount > 0 || coach.rating > 0) && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="star" className="text-[14px] text-[#F59E0B]" />
                    <span className="text-[#0F172A]">
                      {coach.rating}
                      {coach.verifiedReviewsCount > 0 ? ` (${coach.verifiedReviewsCount} تقييم)` : ""}
                    </span>
                  </span>
                )}
                {coach.yearsExperience > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="trophy" className="text-[14px] text-[#1D6E7D]" />
                    <span>{coach.yearsExperience} سنوات خبرة</span>
                  </span>
                )}
                <span className="text-[#1D6E7D]">0% عمولة وساطة</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 lg:col-span-4 flex flex-col items-stretch gap-3">
            <div className="bg-[#F7F9FA] border border-[#0F172A]/8 rounded-2xl p-4 text-right">
              <div className="text-xs font-bold text-[#64748B]">سعر باقة {selectedSessions} حصص</div>
              <div className="text-2xl font-black text-[#1D6E7D] mt-1">
                {(selectedSessions === 8 ? coach.privatePackage8Egp : coach.privatePackage12Egp) > 0
                  ? `${selectedSessions === 8 ? coach.privatePackage8Egp : coach.privatePackage12Egp} ج.م`
                  : "بالتواصل المباشر"}
              </div>
              <div className="text-[11px] text-[#64748B] mt-1">
                يشمل متابعة التقييم ودفتر الحصص الـ QR
              </div>
            </div>

            <ContactChannelsBar
              supplyStatus="verified_active"
              whatsappNumber={coach.whatsappNumber}
              facebookUrl={coach.facebookUrl}
              instagramUrl={coach.instagramUrl}
              onWhatsappClick={handleWhatsappLead}
              fullWidthPrimary
            />

            <Link
              href={`/booking?coach=${coach.slug}`}
              onClick={(e) => {
                if (!isAuthenticated) {
                  e.preventDefault();
                  openAuthGateModal(`تجهيز حجز تدريب مع ${coach.fullNameAr}`);
                }
              }}
              className="w-full py-2.5 px-4 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold text-center inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Icon name="calendar_month" className="text-[16px]" />
              <span>تجهيز طلب حجز باقة وربط الكود ←</span>
            </Link>

            {leadCode && (
              <span className="text-xs text-[#1D6E7D] font-bold font-mono text-center">
                كود إحالة الاستفسار: {leadCode}
              </span>
            )}
          </div>
        </section>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <section className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3">
              <h2 className="font-section-title text-section-title text-[#0F172A]">
                النبذة المهنية والتخصصات
              </h2>
              <p className="font-body-default text-[#475569] leading-relaxed">{coach.bioAr}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {coach.specialties.map((s) => (
                  <span
                    key={s.nameAr}
                    className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 px-3.5 py-2.5 text-[#0F172A] font-bold text-xs inline-flex items-center gap-2"
                  >
                    <Icon name="check_circle" className="text-[15px] text-[#1D6E7D] shrink-0" />
                    <span>{s.nameAr}</span>
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-section-title text-section-title text-[#0F172A]">
                  سجل الشارات والاعتمادات الرسمية ({coach.badges.length})
                </h2>
                <Link href="/badges" className="text-xs font-bold text-[#1D6E7D] hover:underline">
                  معايير التوثيق
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coach.badges.map((b) => (
                  <div key={b.code} className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-card-title-sm text-[#0F172A]">{b.titleAr}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-extrabold shrink-0">
                        نشطة ✓
                      </span>
                    </div>
                    <span className="text-xs text-[#1D6E7D] font-semibold">{b.authorityAr}</span>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{b.descriptionAr}</p>
                  </div>
                ))}
              </div>
            </section>

            {coach.affiliations.length > 0 && (
              <section className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3">
                <h2 className="font-section-title text-section-title text-[#0F172A]">
                  أماكن التدريب المعتمدة للكابتن
                </h2>
                <div className="flex flex-col gap-2.5">
                  {coach.affiliations.map((aff) => (
                    <div
                      key={aff.facilityId}
                      className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-card-title-sm text-[#0F172A]">{aff.facilityNameAr}</div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {aff.city} • {aff.scheduleAr}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-extrabold shrink-0">
                        ارتباط ساري ✓
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {coachArticles.length > 0 && (
              <section className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3">
                <h2 className="font-section-title text-section-title text-[#0F172A] flex items-center gap-2">
                  <Icon name="article" className="text-[20px] text-[#1D6E7D]" />
                  <span>مقالات ونصائح الكابتن ({coachArticles.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {coachArticles.map((art) => (
                    <Link
                      key={art.id}
                      href={`/magazine/${art.slug}`}
                      className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#0F172A]/8 hover:border-[#1D6E7D]/35 flex flex-col gap-1.5 transition-colors"
                    >
                      <span className="text-[10px] font-bold text-[#1D6E7D]">{art.categoryAr}</span>
                      <div className="font-bold text-sm text-[#0F172A] line-clamp-1">{art.titleAr}</div>
                      <p className="text-xs text-[#64748B] line-clamp-2">{art.excerptAr}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3">
              <h3 className="font-card-title text-[#0F172A]">باقات وعروض الحصص المعلنة</h3>
              {coach.sessionOffers && coach.sessionOffers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {coach.sessionOffers.map((offer, idx) => {
                    const active = selectedOfferId ? selectedOfferId === offer.id : idx === 0;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => {
                          setSelectedOfferId(offer.id);
                          if (offer.sessionsCount === 8 || offer.sessionsCount === 12) {
                            setSelectedSessions(offer.sessionsCount);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border text-right transition-all ${
                          active
                            ? "bg-[#EAF4F8]/80 border-[#1D6E7D] text-[#0F172A] ring-1 ring-[#1D6E7D]/20"
                            : "bg-[#F7F9FA] border-[#0F172A]/6 text-[#64748B] hover:border-[#1D6E7D]/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-[#0F172A]">{offer.titleAr}</span>
                          <span className="text-base font-black text-[#1D6E7D]">{offer.priceEgp} ج.م</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5 flex flex-col gap-0.5">
                          <div>
                            {offer.sessionsCount} حصص {offer.durationMinutes ? `• ${offer.durationMinutes} د` : ""}
                            {offer.sessionTimeAr ? ` • ${offer.sessionTimeAr}` : ""}
                          </div>
                          {offer.notesAr && <div>{offer.notesAr}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSessions(8)}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      selectedSessions === 8
                        ? "bg-[#EAF4F8]/80 border-[#1D6E7D] text-[#0F172A]"
                        : "bg-[#F7F9FA] border-[#0F172A]/6 text-[#64748B]"
                    }`}
                  >
                    <div className="text-xs font-bold">8 حصص</div>
                    <div className="text-lg font-black text-[#1D6E7D]">
                      {coach.privatePackage8Egp > 0 ? `${coach.privatePackage8Egp} ج.م` : "بالتنسيق"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSessions(12)}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      selectedSessions === 12
                        ? "bg-[#EAF4F8]/80 border-[#1D6E7D] text-[#0F172A]"
                        : "bg-[#F7F9FA] border-[#0F172A]/6 text-[#64748B]"
                    }`}
                  >
                    <div className="text-xs font-bold">12 حصة</div>
                    <div className="text-lg font-black text-[#1D6E7D]">
                      {coach.privatePackage12Egp > 0 ? `${coach.privatePackage12Egp} ج.م` : "بالتنسيق"}
                    </div>
                  </button>
                </div>
              )}

              <div className="rounded-2xl bg-[#F7F9FA] p-4 text-center flex flex-col items-center gap-2 mt-2 border border-[#0F172A]/8">
                <span className="text-xs font-bold text-[#0F172A]">
                  المعرّف الموحد للكابتن للربط مع الأكاديميات
                </span>
                <div className="px-4 py-2 rounded-xl bg-white border border-[#1D6E7D]/20 font-mono font-black text-base text-[#1D6E7D]">
                  {coach.SingleCoachId}
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  التوثيق المهني للكابتن يتم عبر الشارات المعتمدة، بينما كود الاشتراك والـ QR يُصدر للسباح عند تفعيل باقته.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <GuestFloatingAuthBar contextLabelAr={`أنشئ حسابك على Captenly لحفظ الكابتن ${coach.fullNameAr} والتواصل المباشر معه`} />
    </div>
  );
}
