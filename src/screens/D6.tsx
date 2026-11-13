"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";

export default function Desktop6() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

  const { articles, facilities, isFavorite, toggleFavorite } = useCaptenly();
  const [scrollPct, setScrollPct] = useState(0);

  const article = useMemo(
    () => articles.find((a) => a.slug === slug || a.id === slug) || articles[0],
    [articles, slug]
  );

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (h > 0) setScrollPct(Math.min(100, Math.round((window.scrollY / h) * 100)));
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!article) return null;

  const saved = isFavorite(article.id);
  const recommendedFacilities = facilities.filter((f) =>
    article.recommendedFacilitySlugs.includes(f.slug)
  );
  const paragraphs = article.contentMarkdownAr.split("\n").filter((l) => l.trim() !== "");

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      {/* Reading Progress Bar */}
      <div className="fixed top-[110px] left-0 right-0 h-1 bg-surface-container z-40">
        <div className="h-full bg-electric-volt transition-all" style={{ width: `${scrollPct}%` }} />
      </div>

      <article className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-dark-slate">
            الرئيسية
          </Link>
          <span>/</span>
          <Link href="/magazine" className="hover:text-dark-slate">
            المجلة الرياضية
          </Link>
          <span>/</span>
          <span className="text-deep-olive font-bold">{article.categoryAr}</span>
        </nav>

        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-deep-olive font-bold text-xs">
              {article.categoryAr} • {article.readingMinutes} دقائق قراءة
            </span>
            <button
              type="button"
              onClick={() => toggleFavorite(article.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                saved ? "bg-electric-volt text-dark-slate" : "bg-surface-card text-dark-slate shadow-sm"
              }`}
            >
              <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[16px]" />
              <span>{saved ? "محفوظ في مفضلتك" : "حفظ المقال"}</span>
            </button>
          </div>

          <h1 className="font-hero-headline text-[28px] md:text-[36px] text-dark-slate leading-tight">
            {article.titleAr}
          </h1>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="font-bold text-dark-slate">{article.authorNameAr}</span>
            <span>•</span>
            <span>{article.authorRoleAr}</span>
            <span>•</span>
            <span>{article.publishedDateAr}</span>
          </div>
        </header>

        <div className="w-full h-[360px] rounded-[20px] overflow-hidden shadow-md">
          <img src={article.imageUrl} alt={article.titleAr} className="w-full h-full object-cover" />
        </div>

        <section className="bg-surface-card rounded-[20px] p-6 md:p-10 shadow-sm flex flex-col gap-4 leading-relaxed">
          <p className="text-lg font-bold text-deep-olive border-r-4 border-electric-volt pr-4">
            {article.excerptAr}
          </p>

          <div className="flex flex-col gap-3 text-dark-slate">
            {paragraphs.map((line, i) => {
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="font-section-title text-section-title text-dark-slate pt-3">
                    {line.replace("## ", "")}
                  </h2>
                );
              }
              return (
                <p key={i} className="font-body-default text-text-muted leading-loose">
                  {line.replace(/\*\*/g, "")}
                </p>
              );
            })}
          </div>
        </section>

        {recommendedFacilities.length > 0 && (
          <section className="flex flex-col gap-4 pt-2">
            <h2 className="font-section-title text-dark-slate">
              منشآت مرتبطة بموضوع هذا الدليل
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
              {recommendedFacilities.map((f) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
