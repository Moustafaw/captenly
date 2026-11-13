"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

export default function Desktop16() {
  const { facilities, coaches, articles, savedFavoriteIds, toggleFavorite, isAuthenticated } = useCaptenly();

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="يرجى إنشاء حساب أو تسجيل الدخول لعرض المفضلة"
        descriptionAr="سجّل دخولك أو أنشئ حسابك المجاني على Captenly لحفظ المسابح والأكاديميات والكباتن المفضلة لديك والرجوع إليها في أي وقت."
      />
    );
  }

  const savedFacilities = facilities.filter((f) => savedFavoriteIds.includes(f.id));
  const savedCoaches = coaches.filter((c) => savedFavoriteIds.includes(c.id));
  const savedArticles = articles.filter((a) => savedFavoriteIds.includes(a.id));
  const totalCount = savedFacilities.length + savedCoaches.length + savedArticles.length;

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-hero-headline text-[28px] text-dark-slate">
              قائمة المحفوظات والمفضلة ({totalCount})
            </h1>
            <p className="font-body-compact text-text-muted mt-1">
              الأكاديميات، الكباتن، والمقالات التي قمت بحفظها للرجوع السريع والمقارنة
            </p>
          </div>
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold w-fit"
          >
            استكشف المزيد ←
          </Link>
        </div>

        {totalCount === 0 ? (
          <div className="bg-surface-card rounded-[20px] p-12 text-center shadow-sm flex flex-col items-center gap-4">
            <Icon name="bookmark_border" className="text-[36px] text-deep-olive" />
            <h2 className="font-section-title text-dark-slate">قائمة المفضلة فارغة حالياً</h2>
            <p className="text-sm text-text-muted">
              اضغط على علامة الحفظ في أي منشأة أو مقال لإضافته هنا ومقارنته لاحقاً.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-space-xl">
            {savedFacilities.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-section-title text-dark-slate">
                  المنشآت والأندية المحفوظة ({savedFacilities.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
                  {savedFacilities.map((f) => (
                    <FacilityCard key={f.id} facility={f} />
                  ))}
                </div>
              </section>
            )}

            {savedCoaches.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-section-title text-dark-slate">
                  الكباتن المحفوظون ({savedCoaches.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
                  {savedCoaches.map((c) => (
                    <VerifiedCoachCard key={c.id} coach={c} />
                  ))}
                </div>
              </section>
            )}

            {savedArticles.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-section-title text-dark-slate">
                  المقالات والأدلة المحفوظة ({savedArticles.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                  {savedArticles.map((art) => (
                    <div
                      key={art.id}
                      className="bg-surface-card rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div className="relative h-40">
                        <img src={art.imageUrl} alt={art.titleAr} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => toggleFavorite(art.id)}
                          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-electric-volt text-dark-slate flex items-center justify-center shadow"
                        >
                          <Icon name="bookmark" className="text-[16px]" />
                        </button>
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        <span className="text-[11px] font-bold text-deep-olive">{art.categoryAr}</span>
                        <Link
                          href={`/magazine/${art.slug}`}
                          className="font-card-title-sm text-dark-slate hover:text-deep-olive"
                        >
                          {art.titleAr}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
