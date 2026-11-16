"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { ShareButton } from "@/components/editorial/ShareButton";

export default function Desktop21() {
  const { articles, facilities, isFavorite, toggleFavorite, subscribeNewsletter, currentPersona } =
    useCaptenly();
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
  const gridArticles =
    featured && selectedCat === "الكل" && !searchQ.trim()
      ? filteredArticles.filter((a) => a.id !== featured.id)
      : filteredArticles;

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    const res = subscribeNewsletter(email);
    setNewsletterMsg(res.messageAr);
    if (res.ok) setEmail("");
  };

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0B1C2E] antialiased min-h-screen pt-6 pb-24 lg:pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-7">
        {/* Header & Search */}
        <header className="flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/25 text-[#1D6E7D] font-bold text-xs w-fit">
                <Icon name="menu_book" className="text-[15px] text-[#00ACC1]" />
                <span>دليل التوعية الرياضي الموثق — {articles.length} مقالات تأسيسية</span>
              </span>
              <h1 className="font-hero-headline text-[28px] md:text-[36px] font-black text-[#0B1C2E] tracking-tight leading-tight">
                مجلة كابتنلي الرياضية
              </h1>
              <p className="font-body-default text-sm text-[#64748B] leading-relaxed">
                أدلة عملية وإرشادية لأولياء الأمور والسباحين في مصر لاختيار المسبح الآمن، التحقق من الكباتن، تغذية الناشئين، واستخدام دفتر الحصص أوفلاين.
              </p>
            </div>

            <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {(currentPersona.role === "coach" || currentPersona.role === "facility_manager") && (
                <Link
                  href={currentPersona.role === "coach" ? "/dashboard/coach" : "/dashboard/facility"}
                  className="px-4 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition shrink-0"
                >
                  <Icon name="edit_note" className="text-[17px]" />
                  <span>+ كتابة أو تعديل مقالاتي</span>
                </Link>
              )}
              <div className="relative flex items-center bg-white rounded-full shadow-sm px-4 py-2.5 border border-[#E2E8F0] focus-within:border-[#00ACC1] w-full sm:w-72 transition">
                <Icon name="search" className="text-[#64748B] ml-2 text-[18px] shrink-0" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="ابحث في موضوعات ومقالات السباحة..."
                  className="w-full bg-transparent outline-none text-xs sm:text-sm text-[#0B1C2E] placeholder:text-[#94A3B8]"
                />
                {searchQ && (
                  <button
                    type="button"
                    onClick={() => setSearchQ("")}
                    aria-label="مسح البحث"
                    className="text-[#94A3B8] hover:text-[#0B1C2E] mr-1 cursor-pointer"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => {
              const active = selectedCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`shrink-0 px-4 py-2 rounded-full font-badge-label text-xs transition-all cursor-pointer border ${
                    active
                      ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-sm"
                      : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0B1C2E] hover:border-[#00ACC1]/40"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </header>

        {/* Bright Pure-White Option B Featured Article */}
        {featured && selectedCat === "الكل" && !searchQ.trim() && (
          <article className="relative w-full rounded-3xl bg-white border border-[#E2E8F0] overflow-hidden shadow-[0_12px_36px_rgba(11,28,46,0.06)] grid grid-cols-1 lg:grid-cols-12 min-h-[290px]">
            {featured.imageUrl && (
              <div className="lg:col-span-5 relative min-h-[230px] lg:min-h-full order-1 lg:order-2 overflow-hidden">
                <Link href={`/magazine/${featured.slug}`} className="block w-full h-full">
                  <img
                    src={featured.imageUrl}
                    alt={featured.titleAr}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <span className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1D6E7D] text-white font-bold text-[11px] shadow-md">
                  <Icon name="star" className="text-[13px] text-[#EAF4F8]" />
                  <span>مقال الأسبوع المختار</span>
                </span>
                <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5">
                  <ShareButton
                    title={featured.titleAr}
                    text={featured.excerptAr}
                    url={`/magazine/${featured.slug}`}
                    variant="icon"
                    ariaLabel="مشاركة المقال المختار"
                  />
                </div>
              </div>
            )}

            <div
              className={`${
                featured.imageUrl ? "lg:col-span-7 order-2 lg:order-1" : "lg:col-span-12"
              } p-6 md:p-9 flex flex-col justify-between gap-5`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {!featured.imageUrl && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1D6E7D] text-white font-bold text-[11px]">
                      <Icon name="star" className="text-[13px]" />
                      <span>مقال الأسبوع المختار</span>
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] font-bold text-xs">
                    {featured.categoryAr}
                  </span>
                  <span className="text-xs text-[#64748B] font-semibold inline-flex items-center gap-1">
                    <Icon name="schedule" className="text-[14px] text-[#00ACC1]" />
                    <span>{featured.readingMinutes} دقائق قراءة</span>
                  </span>
                </div>
                <Link href={`/magazine/${featured.slug}`}>
                  <h2 className="font-section-title text-[20px] md:text-[26px] font-black text-[#0B1C2E] hover:text-[#1D6E7D] transition-colors leading-snug">
                    {featured.titleAr}
                  </h2>
                </Link>
                <p className="font-body-default text-sm text-[#475569] leading-relaxed line-clamp-3">
                  {featured.excerptAr}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#EAF4F8] text-[#1D6E7D] font-black text-xs flex items-center justify-center border border-[#00ACC1]/20 shrink-0">
                    {featured.authorNameAr.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm text-[#0B1C2E]">
                      {featured.authorNameAr}
                    </div>
                    <div className="text-[11px] text-[#64748B]">{featured.authorRoleAr}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!featured.imageUrl && (
                    <ShareButton
                      title={featured.titleAr}
                      text={featured.excerptAr}
                      url={`/magazine/${featured.slug}`}
                      variant="icon"
                      ariaLabel="مشاركة المقال المختار"
                    />
                  )}
                  <Link
                    href={`/magazine/${featured.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs shadow-sm transition"
                  >
                    <span>اقرأ الدليل كاملاً</span>
                    <Icon name="arrow_back" className="text-[16px]" />
                  </Link>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Latest Articles Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-section-title text-xl md:text-2xl font-black text-[#0B1C2E]">
                {selectedCat === "الكل" ? "أحدث المقالات والأدلة الرياضية" : selectedCat}
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                مقالات وأدلة تخصصية مكتوبة وموثقة لمساعدتك في اتخاذ قرارات تدريبية سليمة.
              </p>
            </div>
            {(selectedCat !== "الكل" || searchQ.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCat("الكل");
                  setSearchQ("");
                }}
                className="text-xs font-bold text-[#1D6E7D] hover:underline cursor-pointer"
              >
                عرض كافة المقالات ←
              </button>
            )}
          </div>

          {gridArticles.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#E2E8F0] p-10 text-center flex flex-col items-center gap-2">
              <Icon name="menu_book" className="text-[28px] text-[#94A3B8]" />
              <div className="font-bold text-sm text-[#0B1C2E]">لا توجد مقالات مطابقة لبحثك</div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCat("الكل");
                  setSearchQ("");
                }}
                className="mt-1 px-4 py-2 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-bold cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {gridArticles.map((art) => {
                const fav = isFavorite(art.id);
                return (
                  <article
                    key={art.id}
                    className="bg-white rounded-3xl border border-[#E2E8F0] overflow-hidden shadow-[0_6px_22px_rgba(11,28,46,0.04)] hover:shadow-[0_12px_32px_rgba(11,28,46,0.08)] transition-shadow flex flex-col justify-between group"
                  >
                    <div>
                      {art.imageUrl ? (
                        <div className="relative h-48 w-full overflow-hidden">
                          <Link href={`/magazine/${art.slug}`}>
                            <img
                              src={art.imageUrl}
                              alt={art.titleAr}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </Link>
                          <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#EAF4F8]/95 border border-[#00ACC1]/20 text-[#1D6E7D] font-bold text-[11px] backdrop-blur-xs">
                            {art.categoryAr}
                          </span>
                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(art.id)}
                              aria-label={fav ? "إزالة من المفضلة" : "حفظ المقال"}
                              className={`w-8 h-8 rounded-full flex items-center justify-center shadow transition cursor-pointer ${
                                fav
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-white/95 text-[#0B1C2E] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
                              }`}
                            >
                              <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 pt-5 flex items-center justify-between gap-2">
                          <span className="px-3 py-1 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] font-bold text-[11px]">
                            {art.categoryAr}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(art.id)}
                            aria-label={fav ? "إزالة من المفضلة" : "حفظ المقال"}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border transition cursor-pointer ${
                              fav
                                ? "bg-[#1D6E7D] text-white border-[#1D6E7D]"
                                : "bg-[#F7F9FA] text-[#0B1C2E] border-[#E2E8F0] hover:bg-[#EAF4F8]"
                            }`}
                          >
                            <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
                          </button>
                        </div>
                      )}

                      <div className="p-5 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px] text-[#64748B] font-semibold">
                          <span className="truncate">{art.authorNameAr}</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Icon name="schedule" className="text-[13px] text-[#00ACC1]" />
                            <span>{art.readingMinutes} دقائق</span>
                          </span>
                        </div>
                        <Link href={`/magazine/${art.slug}`}>
                          <h3 className="font-card-title text-base font-black text-[#0B1C2E] group-hover:text-[#1D6E7D] transition-colors line-clamp-2 leading-snug">
                            {art.titleAr}
                          </h3>
                        </Link>
                        <p className="font-body-compact text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                          {art.excerptAr}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-2 border-t border-[#E2E8F0]/60 flex items-center justify-between gap-2">
                      <Link
                        href={`/magazine/${art.slug}`}
                        className="inline-flex items-center gap-1.5 text-[#1D6E7D] hover:text-[#155460] font-black text-xs transition"
                      >
                        <span>قراءة المقال الكامل</span>
                        <Icon name="arrow_back" className="text-[15px]" />
                      </Link>
                      <ShareButton
                        title={art.titleAr}
                        text={art.excerptAr}
                        url={`/magazine/${art.slug}`}
                        variant="icon"
                        ariaLabel={`مشاركة مقال ${art.titleAr}`}
                        className="w-8 h-8 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#64748B] hover:text-[#1D6E7D] border border-[#E2E8F0] flex items-center justify-center transition cursor-pointer"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Nearby Recommended Facilities */}
        {facilities.length > 0 && (
          <section className="flex flex-col gap-4 pt-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="font-section-title text-lg md:text-2xl font-black text-[#0B1C2E]">
                  منشآت ومسابح مرتبطة بالأدلة الإرشادية
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  مسابح وأكاديميات سباحة مسجّلة على المنصة لاستكشاف المواعيد والباقات
                </p>
              </div>
              <Link href="/explore" className="text-xs font-black text-[#1D6E7D] hover:underline">
                تصفح كل المسابح ←
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {facilities.slice(0, 3).map((f) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          </section>
        )}

        {/* Newsletter — Option B Bright Card */}
        <section className="rounded-3xl bg-white border border-[#E2E8F0] shadow-[0_8px_28px_rgba(11,28,46,0.04)] p-6 md:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl flex items-start gap-3.5">
            <span className="w-11 h-11 rounded-2xl bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] flex items-center justify-center shrink-0">
              <Icon name="mail" className="text-[22px]" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-xs text-[#1D6E7D]">نشرة كابتنلي الأسبوعية</span>
              <h2 className="font-section-title text-lg md:text-2xl font-black text-[#0B1C2E]">
                اشترك في نشرة كابتنلي الأسبوعية للسباحة
              </h2>
              <p className="text-xs text-[#64748B]">
                أدلة اختيار الأكاديميات الآمنة وبرامج تغذية الناشئين مجاناً مباشرة في بريدك.
              </p>
            </div>
          </div>

          <div className="w-full lg:w-auto">
            {newsletterMsg ? (
              <div className="px-5 py-3 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/25 text-[#1D6E7D] font-bold text-xs sm:text-sm">
                ✓ {newsletterMsg}
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="أدخل بريدك الإلكتروني..."
                  className="rounded-full bg-[#F7F9FA] px-5 py-3 text-sm text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1] w-full sm:w-72"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs sm:text-sm shrink-0 shadow-sm transition cursor-pointer"
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
