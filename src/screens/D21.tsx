"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";

export default function Desktop21() {
  const { articles, facilities, isFavorite, toggleFavorite, subscribeNewsletter } = useCaptenly();
  const [selectedCat, setSelectedCat] = useState("الكل");
  const [searchQ, setSearchQ] = useState("");
  const [email, setEmail] = useState("");
  const [newsletterMsg, setNewsletterMsg] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(articles.map((a) => a.categoryAr)));
    return ["الكل", ...unique];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedCat !== "الكل" && a.categoryAr !== selectedCat) return false;
      if (q && !`${a.titleAr} ${a.excerptAr} ${a.categoryAr}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [articles, selectedCat, searchQ]);

  const featured = articles[0];

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    const res = subscribeNewsletter(email);
    setNewsletterMsg(res.messageAr);
    if (res.ok) setEmail("");
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-xl">
        {/* Header */}
        <header className="flex flex-col gap-space-md">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
            <div className="flex flex-col gap-space-xs max-w-2xl">
              <span className="inline-flex items-center gap-1.5 text-deep-olive font-bold text-xs w-fit">
                <Icon name="menu_book" className="text-[16px]" />
                <span>دليل التوعية الرياضي الموثق — {articles.length} مقالات تأسيسية</span>
              </span>
              <h1 className="font-hero-headline text-hero-headline text-dark-slate tracking-tight">
                مجلة كابتنلي الرياضية
              </h1>
              <p className="font-body-default text-text-muted">
                أدلة عملية لاختيار المسبح الآمن، التحقق من الكباتن، تغذية الناشئين، واستخدام دفتر الحصص أوفلاين.
              </p>
            </div>

            <div className="w-full md:w-80 shrink-0">
              <div className="relative flex items-center bg-surface-card rounded-full shadow-sm px-4 py-2.5 border border-surface-container">
                <Icon name="search" className="text-text-muted ml-2 text-[18px]" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="ابحث في المقالات..."
                  className="w-full bg-transparent outline-none text-sm text-dark-slate"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`shrink-0 px-4 py-2 rounded-full font-badge-label text-xs transition-all ${
                  selectedCat === cat
                    ? "bg-dark-slate text-electric-volt shadow-sm"
                    : "bg-surface-card text-text-muted hover:text-dark-slate shadow-sm"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* Featured Article */}
        {featured && selectedCat === "الكل" && !searchQ.trim() && (
          <article className="relative w-full rounded-2xl bg-dark-slate text-surface-card overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
            <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-xs">
                    مقال الأسبوع المختار
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-xs">{featured.categoryAr}</span>
                  <span className="text-xs text-surface-container-high inline-flex items-center gap-1">
                    <Icon name="schedule" className="text-[14px]" />
                    <span>{featured.readingMinutes} دقائق قراءة</span>
                  </span>
                </div>
                <h2 className="font-section-title text-section-title text-surface-card leading-snug">
                  {featured.titleAr}
                </h2>
                <p className="font-body-default text-surface-container-high line-clamp-3">
                  {featured.excerptAr}
                </p>
              </div>

              <div className="pt-6 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-card-title-sm text-surface-card">{featured.authorNameAr}</div>
                  <div className="text-xs text-surface-variant">{featured.authorRoleAr}</div>
                </div>
                <Link
                  href={`/magazine/${featured.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm"
                >
                  <span>اقرأ الدليل كاملاً</span>
                  <Icon name="arrow_back" className="text-[17px]" />
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 relative min-h-[240px]">
              <img src={featured.imageUrl} alt={featured.titleAr} className="w-full h-full object-cover" />
            </div>
          </article>
        )}

        {/* Articles Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
          {filteredArticles.map((art) => {
            const fav = isFavorite(art.id);
            return (
              <article
                key={art.id}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Link href={`/magazine/${art.slug}`}>
                      <img
                        src={art.imageUrl}
                        alt={art.titleAr}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-lime-tint text-deep-olive font-badge-label text-xs">
                      {art.categoryAr}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(art.id)}
                      className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center shadow ${
                        fav ? "bg-electric-volt text-dark-slate" : "bg-surface-card/90 text-dark-slate"
                      }`}
                    >
                      <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[17px]" />
                    </button>
                  </div>
                  <div className="p-5 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{art.authorNameAr}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="schedule" className="text-[13px]" />
                        <span>{art.readingMinutes} دقائق</span>
                      </span>
                    </div>
                    <Link href={`/magazine/${art.slug}`}>
                      <h3 className="font-card-title text-dark-slate group-hover:text-deep-olive transition-colors line-clamp-2">
                        {art.titleAr}
                      </h3>
                    </Link>
                    <p className="font-body-compact text-text-muted line-clamp-2">{art.excerptAr}</p>
                  </div>
                </div>
                <Link
                  href={`/magazine/${art.slug}`}
                  className="p-5 pt-0 flex items-center justify-between text-deep-olive font-badge-label text-xs"
                >
                  <span>قراءة المقال الكامل</span>
                  <Icon name="arrow_back" className="text-[16px]" />
                </Link>
              </article>
            );
          })}
        </section>

        {/* Nearby Recommended Facilities */}
        <section className="flex flex-col gap-4">
          <h2 className="font-section-title text-dark-slate">منشآت بارزة مرتبطة بأدلة الاختيار الآمن</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
            {facilities.slice(0, 3).map((f) => (
              <FacilityCard key={f.id} facility={f} />
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="rounded-2xl bg-surface-card shadow-sm p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl flex flex-col gap-1">
            <span className="font-badge-label text-xs text-deep-olive">نشرة كابتنلي الأسبوعية</span>
            <h2 className="font-section-title text-dark-slate">
              احصل على دليل اختيار الأكاديميات وبرامج التغذية مجاناً
            </h2>
          </div>
          <div className="w-full lg:w-auto">
            {newsletterMsg ? (
              <div className="px-5 py-3 rounded-full bg-lime-tint text-deep-olive font-bold text-sm">
                ✓ {newsletterMsg}
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني..."
                  className="rounded-full bg-surface-snow px-5 py-3 text-sm outline-none border border-surface-container w-full sm:w-72"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-deep-olive text-white font-badge-label shrink-0"
                >
                  اشترك الآن
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
