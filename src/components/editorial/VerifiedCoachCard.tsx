"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Coach } from "@/types/captenly";
import { useCaptenly } from "@/context/CaptenlyContext";

interface VerifiedCoachCardProps {
  coach: Coach;
}

export function VerifiedCoachCard({ coach }: VerifiedCoachCardProps) {
  const { createStructuredWhatsappLead, currentPersona, isFavorite, toggleFavorite } = useCaptenly();
  const fav = isFavorite(coach.id);

  const handleWhatsappLead = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "coach",
      targetId: coach.id,
      targetNameAr: coach.fullNameAr,
      whatsappNumber: coach.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: coach.specialties[0]?.nameAr || "حصة تقييم",
      preferredScheduleAr: "بالتنسيق مع الكابتن",
    });
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-surface-card rounded-[16px] p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow border border-surface-container/60">
      <div className="flex flex-col items-center text-center gap-space-sm">
        <div className="relative w-full flex justify-center">
          <Link href={`/c/${coach.slug}`} className="relative">
            <img
              className="w-20 h-20 rounded-full object-cover shadow-inner bg-surface-container"
              alt={coach.fullNameAr}
              src={coach.avatarUrl || "/screens/3dff88737bec.jpg"}
            />
            <span
              title="كابتن موثق بالشارات الخضراء"
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-status-success text-on-primary flex items-center justify-center text-[12px] shadow-sm font-bold"
            >
              ✓
            </span>
          </Link>

          <button
            type="button"
            onClick={() => toggleFavorite(coach.id)}
            aria-label="حفظ الكابتن"
            className={`absolute top-0 left-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              fav ? "bg-electric-volt text-dark-slate" : "bg-surface-snow text-text-muted hover:text-dark-slate"
            }`}
          >
            <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
          </button>
        </div>

        <div className="flex flex-col">
          <Link href={`/c/${coach.slug}`} className="hover:text-deep-olive transition-colors">
            <h4 className="font-card-title-sm text-card-title-sm text-dark-slate">{coach.fullNameAr}</h4>
          </Link>
          <span className="font-micro-caption text-micro-caption text-text-muted">{coach.titleAr}</span>
          <span className="font-mono text-[10px] text-deep-olive mt-0.5">{coach.SingleCoachId}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-deep-olive font-micro-caption text-micro-caption font-bold inline-flex items-center gap-1">
            <Icon name="verified" className="text-[14px]" />
            <span>موثق بالشارات الخضراء ({coach.badges.length})</span>
          </span>
          <span className="font-badge-label text-badge-label text-status-warning flex items-center gap-0.5">
            <Icon name="star" className="text-[14px]" />
            {coach.rating}
          </span>
        </div>

        <p className="font-body-compact text-body-compact text-text-muted text-center line-clamp-2">
          {coach.bioAr}
        </p>

        <div className="w-full rounded-xl bg-surface-snow px-3 py-2 flex items-center justify-between text-[12px]">
          <span className="text-text-muted">باقة 8 حصص</span>
          <span className="font-bold text-deep-olive">{coach.privatePackage8Egp} ج.م</span>
        </div>
      </div>

      <div className="pt-space-md mt-space-sm flex items-center gap-2">
        <Link
          href={`/c/${coach.slug}`}
          className="flex-1 py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-dark-slate font-badge-label text-[12px] transition-colors text-center"
        >
          الملف والشارات
        </Link>
        <button
          type="button"
          onClick={handleWhatsappLead}
          className="flex-1 py-2 rounded-full bg-action-whatsapp text-surface-card font-badge-label text-[12px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
        >
          <Icon name="chat" className="text-[15px]" />
          <span>واتساب</span>
        </button>
      </div>
    </div>
  );
}
