"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";
import { GuestFloatingAuthBar } from "@/components/auth/GuestFloatingAuthBar";

export default function CoachPublicProfilePage({ params }: { params: { slug: string } }) {
  const { coaches, articles, createStructuredWhatsappLead, currentPersona, isAuthenticated } = useCaptenly();
  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
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
      <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16 px-margin lg:px-margin-desktop">
        <div className="max-w-2xl mx-auto bg-surface-card rounded-[20px] p-10 text-center shadow-sm flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-snow text-dark-slate flex items-center justify-center">
            <Icon name="verified_user" className="text-[32px]" />
          </div>
          <h1 className="font-section-title text-section-title text-dark-slate">
            ملف الكابتن غير متوفر أو قيد التوثيق
          </h1>
          <p className="font-body-default text-text-muted">
            تظهر ملفات الكباتن المستقلة فقط بعد قيام الكابتن بتسجيل حسابه بنفسه واعتماد شهاداته للشارات الخضراء.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {isFacilityManager ? (
              <Link
                href="/dashboard/facility"
                className="px-6 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label"
              >
                إدارة كباتن منشأتك
              </Link>
            ) : (
              <Link
                href="/claim?mode=coach"
                className="px-6 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label"
              >
                سجّل ووثّق ككابتن الآن
              </Link>
            )}
            <Link
              href="/coaches"
              className="px-6 py-2.5 rounded-full bg-surface-snow text-dark-slate font-badge-label"
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
      athleteAge: 10,
      requestedSpecialtyAr: `${coach.specialties[0]?.nameAr || "تدريب سباحة"} (${selectedSessions} حصص)`,
      preferredScheduleAr: "بالتنسيق مع الكابتن",
    });
    setLeadCode(res.referralCode);
    if (res.whatsappUrl) {
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[1180px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Hero */}
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <img
              src={coach.avatarUrl || "/screens/3dff88737bec.jpg"}
              alt={coach.fullNameAr}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-electric-volt shrink-0"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive font-badge-label text-xs font-bold">
                  ✓ كابتن موثق بالشارات الخضراء
                </span>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-deep-carbon text-electric-volt">
                  {coach.SingleCoachId}
                </span>
              </div>
              <h1 className="font-hero-headline text-[28px] md:text-[32px] text-surface-card">
                {coach.fullNameAr}
              </h1>
              <p className="font-body-default text-surface-container-high">{coach.titleAr}</p>
              <div className="flex flex-wrap gap-4 text-xs text-surface-variant pt-1">
                <span className="inline-flex items-center gap-1">
                  <Icon name="location_on" className="text-[14px] text-electric-volt" />
                  <span>{coach.city} • {coach.district}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="star" className="text-[14px] text-status-warning" />
                  <span>{coach.rating} ({coach.verifiedReviewsCount} تقييم)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="trophy" className="text-[14px] text-electric-volt" />
                  <span>{coach.yearsExperience} سنوات خبرة</span>
                </span>
                <span>0% عمولة وساطة</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-3">
            <div className="bg-deep-carbon rounded-2xl p-4 w-full lg:w-auto text-right">
              <div className="text-xs text-surface-variant">سعر باقة {selectedSessions} حصص</div>
              <div className="text-2xl font-black text-electric-volt mt-1">
                {selectedSessions === 8 ? coach.privatePackage8Egp : coach.privatePackage12Egp} ج.م
              </div>
              <div className="text-[11px] text-surface-container-high mt-1">
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

            {leadCode && (
              <span className="text-xs text-electric-volt font-mono">
                كود إحالة الاستفسار: {leadCode}
              </span>
            )}
          </div>
        </section>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-8 flex flex-col gap-space-md">
            <section className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-3">
              <h2 className="font-section-title text-section-title text-dark-slate">
                النبذة المهنية والتخصصات
              </h2>
              <p className="font-body-default text-text-muted leading-relaxed">{coach.bioAr}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2">
                {coach.specialties.map((s) => (
                  <span
                    key={s.nameAr}
                    className="text-deep-olive font-bold text-xs inline-flex items-center gap-1"
                  >
                    <Icon name="check_circle" className="text-[14px]" />
                    <span>{s.nameAr}</span>
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-section-title text-section-title text-dark-slate">
                  سجل الشارات الخضراء والاعتمادات ({coach.badges.length})
                </h2>
                <Link href="/badges" className="text-xs font-bold text-deep-olive hover:underline">
                  معايير التوثيق
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coach.badges.map((b) => (
                  <div key={b.code} className="rounded-xl bg-surface-snow p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-card-title-sm text-dark-slate">{b.titleAr}</span>
                      <span className="text-[11px] font-extrabold text-deep-olive">
                        نشطة ✓
                      </span>
                    </div>
                    <span className="text-xs text-deep-olive font-semibold">{b.authorityAr}</span>
                    <p className="text-xs text-text-muted mt-1">{b.descriptionAr}</p>
                  </div>
                ))}
              </div>
            </section>

            {coach.affiliations.length > 0 && (
              <section className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-3">
                <h2 className="font-section-title text-section-title text-dark-slate">
                  أماكن التدريب المعتمدة للكابتن
                </h2>
                <div className="flex flex-col gap-2">
                  {coach.affiliations.map((aff) => (
                    <div
                      key={aff.facilityId}
                      className="rounded-xl bg-surface-snow p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-card-title-sm text-dark-slate">{aff.facilityNameAr}</div>
                        <div className="text-xs text-text-muted">
                          {aff.city} • {aff.scheduleAr}
                        </div>
                      </div>
                      <span className="text-deep-olive text-xs font-extrabold">
                        ارتباط ساري ✓
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {coachArticles.length > 0 && (
              <section className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-3">
                <h2 className="font-section-title text-section-title text-dark-slate flex items-center gap-2">
                  <Icon name="article" className="text-[20px] text-deep-olive" />
                  <span>مقالات ونصائح الكابتن ({coachArticles.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {coachArticles.map((art) => (
                    <Link
                      key={art.id}
                      href={`/magazine/${art.slug}`}
                      className="rounded-xl bg-surface-snow p-4 border border-surface-container hover:border-deep-olive/40 flex flex-col gap-1.5"
                    >
                      <span className="text-[10px] font-bold text-deep-olive">{art.categoryAr}</span>
                      <div className="font-bold text-sm text-dark-slate line-clamp-1">{art.titleAr}</div>
                      <p className="text-xs text-text-muted line-clamp-2">{art.excerptAr}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-3">
              <h3 className="font-card-title text-dark-slate">باقات وعروض الحصص المعلنة</h3>
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
                        className={`p-3.5 rounded-xl border text-right transition-all ${
                          active
                            ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                            : "bg-surface-snow border-transparent text-text-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-dark-slate">{offer.titleAr}</span>
                          <span className="text-base font-black text-deep-olive">{offer.priceEgp} ج.م</span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5 flex flex-col gap-0.5">
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
                    className={`p-3 rounded-xl border text-right transition-all ${
                      selectedSessions === 8
                        ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                        : "bg-surface-snow border-transparent text-text-muted"
                    }`}
                  >
                    <div className="text-xs font-bold">8 حصص</div>
                    <div className="text-lg font-black text-deep-olive">{coach.privatePackage8Egp} ج.م</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSessions(12)}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      selectedSessions === 12
                        ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                        : "bg-surface-snow border-transparent text-text-muted"
                    }`}
                  >
                    <div className="text-xs font-bold">12 حصة</div>
                    <div className="text-lg font-black text-deep-olive">{coach.privatePackage12Egp} ج.م</div>
                  </button>
                </div>
              )}

              <div className="rounded-xl bg-surface-snow p-4 text-center flex flex-col items-center gap-2 mt-2 border border-surface-container">
                <span className="text-xs font-bold text-dark-slate">
                  المعرّف الموحد للكابتن للربط مع الأكاديميات
                </span>
                <div className="px-4 py-2 rounded-xl bg-surface-card border border-surface-container font-mono font-black text-base text-deep-olive">
                  {coach.SingleCoachId}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  التوثيق المهني للكابتن يتم عبر الشارات الخضراء، بينما كود الاشتراك والـ QR يُصدر للسباح عند تفعيل باقته.
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
