"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Coach } from "@/types/captenly";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";
import { CaptenlyImage } from "@/components/CaptenlyImage";

interface VerifiedCoachCardProps {
  coach: Coach;
}

export function VerifiedCoachCard({ coach }: VerifiedCoachCardProps) {
  const { createStructuredWhatsappLead, currentPersona, minorAthletes, isFavorite, toggleFavorite } = useCaptenly();
  const fav = isFavorite(coach.id);

  const handleWhatsappLead = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "coach",
      targetId: coach.id,
      targetNameAr: coach.fullNameAr,
      whatsappNumber: coach.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: minorAthletes[0]?.age || 25,
      requestedSpecialtyAr: coach.specialties[0]?.nameAr || "حصة تقييم",
      preferredScheduleAr: "بالتنسيق مع الكابتن",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col justify-between hover:shadow-[0_12px_32px_rgba(29,110,125,0.1)] transition-all border border-[#0F172A]/6">
      <div className="flex flex-col items-center text-center gap-2.5">
        <div className="relative w-full flex justify-center">
          <Link href={`/c/${coach.slug}`} className="relative">
            {coach.avatarUrl ? (
              <CaptenlyImage
                width={80}
                height={80}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-[#EAF4F8] bg-[#F7F9FA]"
                alt={coach.fullNameAr}
                src={coach.avatarUrl}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#1D6E7D] text-white flex items-center justify-center font-extrabold text-xl shadow-inner">
                {coach.fullNameAr.slice(0, 2)}
              </div>
            )}
            {coach.isVerifiedCoach && (
              <span
                title="كابتن موثق بالشارات الرسمية"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#1D6E7D] text-white flex items-center justify-center text-[12px] shadow-sm font-bold border-2 border-white"
              >
                ✓
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => toggleFavorite(coach.id)}
            aria-label="حفظ الكابتن"
            className={`absolute top-0 left-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              fav
                ? "bg-[#1D6E7D] text-white"
                : "bg-[#F7F9FA] text-[#64748B] hover:text-[#1D6E7D]"
            }`}
          >
            <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
          </button>
        </div>

        <div className="flex flex-col">
          <Link href={`/c/${coach.slug}`} className="hover:text-[#1D6E7D] transition-colors">
            <h3 className="font-card-title-sm text-card-title-sm text-[#0F172A]">{coach.fullNameAr}</h3>
          </Link>
          {coach.titleAr && (
            <span className="font-micro-caption text-micro-caption text-[#64748B]">{coach.titleAr}</span>
          )}
          <span className="font-mono text-[10px] text-[#1D6E7D] font-bold mt-0.5">{coach.SingleCoachId}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {coach.isVerifiedCoach ? (
            <span className="text-[#1D6E7D] bg-[#EAF4F8] px-2.5 py-0.5 rounded-full font-micro-caption text-[11px] font-bold inline-flex items-center gap-1">
              <Icon name="verified" className="text-[13px]" />
              <span>موثق رسمياً ({coach.badges.length})</span>
            </span>
          ) : (
            <span className="text-[#64748B] bg-[#F7F9FA] px-2.5 py-0.5 rounded-full font-micro-caption text-[11px] font-bold inline-flex items-center gap-1">
              <Icon name="person" className="text-[13px] text-[#0F172A]" />
              <span>كابتن مسجل على كابتنلي</span>
            </span>
          )}
          {coach.rating > 0 && (
            <span className="font-badge-label text-badge-label text-status-warning flex items-center gap-0.5">
              <Icon name="star" className="text-[14px]" />
              {coach.rating}
            </span>
          )}
        </div>

        {coach.bioAr && (
          <p className="font-body-compact text-body-compact text-[#64748B] text-center line-clamp-2">
            {coach.bioAr}
          </p>
        )}

        <div className="w-full rounded-xl bg-[#F7F9FA] border border-[#0F172A]/5 px-3 py-2 flex items-center justify-between text-[12px]">
          <span className="text-[#64748B]">باقة 8 حصص</span>
          <span className="font-bold text-[#1D6E7D]">
            {coach.privatePackage8Egp > 0 ? `${coach.privatePackage8Egp} ج.م` : "بالتواصل المباشر"}
          </span>
        </div>
      </div>

      <div className="pt-4 mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/c/${coach.slug}`}
          className="flex-1 min-w-[96px] py-2 rounded-full bg-[#EAF4F8] hover:bg-[#1D6E7D] text-[#1D6E7D] hover:text-white font-badge-label text-[12px] font-bold transition-colors text-center"
        >
          الملف والشارات
        </Link>
        <div className="flex-1 min-w-[116px] flex justify-end">
          <ContactChannelsBar
            supplyStatus="verified_active"
            whatsappNumber={coach.whatsappNumber}
            facebookUrl={coach.facebookUrl}
            instagramUrl={coach.instagramUrl}
            onWhatsappClick={handleWhatsappLead}
            compact
            fullWidthPrimary
          />
        </div>
      </div>
    </div>
  );
}
