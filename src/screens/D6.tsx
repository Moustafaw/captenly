"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { ShareButton } from "@/components/editorial/ShareButton";
import { CaptenlyImage } from "@/components/CaptenlyImage";

function renderInlineBold(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={idx} className="font-black text-[#0B1C2E]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] }
  | { type: "paragraph"; text: string };

/**
 * Parses natural user-written article lines (`## Heading`, `1. Step`, `- Bullet`, plain paragraphs)
 * into clean editorial blocks matching AuthorArticlesManager output identically.
 */
function parseArticleBlocks(rawContent: string): ArticleBlock[] {
  const lines = rawContent.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: ArticleBlock[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("### ")) {
      blocks.push({ type: "heading", text: line.replace(/^#{2,3}\s+/, "").trim() });
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ordered") {
        last.items.push(orderedMatch[1]);
      } else {
        blocks.push({ type: "ordered", items: [orderedMatch[1]] });
      }
      continue;
    }

    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "unordered") {
        last.items.push(bulletMatch[1]);
      } else {
        blocks.push({ type: "unordered", items: [bulletMatch[1]] });
      }
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  return blocks;
}

export default function Desktop6() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

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
  const rawBody =
    article.contentMarkdownAr && article.contentMarkdownAr.trim()
      ? article.contentMarkdownAr
      : (article.bodyParagraphsAr || []).join("\n\n");
  const blocks = parseArticleBlocks(rawBody);
  const takeaways = (article.keyTakeawaysAr || []).map((t) => t.trim()).filter(Boolean);

  const authorHref =
    article.authorSlug && article.authorType === "coach"
      ? `/c/${article.authorSlug}`
      : article.authorSlug && article.authorType === "facility"
      ? `/academy/${article.authorSlug}`
      : null;

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0B1C2E] antialiased min-h-screen pt-4 md:pt-6 pb-24 lg:pb-16">
      {/* Option B Top Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-[#E2E8F0] z-[60]">
        <div
          className="h-full bg-gradient-to-l from-[#00ACC1] to-[#1D6E7D] transition-all duration-150"
          style={{ width: `${scrollPct}%` }}
        />
      </div>

      <article className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop py-space-md flex flex-col gap-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#64748B] font-semibold flex-wrap">
          <Link href="/" className="hover:text-[#1D6E7D] transition">
            الرئيسية
          </Link>
          <span>/</span>
          <Link href="/magazine" className="hover:text-[#1D6E7D] transition">
            المجلة الرياضية
          </Link>
          <span>/</span>
          <span className="text-[#1D6E7D] font-bold">{article.categoryAr}</span>
        </nav>

        {/* Article Header */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] font-bold text-xs">
                {article.categoryAr}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#64748B]">
                <Icon name="schedule" className="text-[14px] text-[#00ACC1]" />
                <span>{article.readingMinutes} دقائق قراءة</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ShareButton
                title={article.titleAr}
                text={article.excerptAr}
                url={`/magazine/${article.slug}`}
                label="مشاركة"
              />
              <button
                type="button"
                onClick={() => toggleFavorite(article.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  saved
                    ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-sm"
                    : "bg-white text-[#0B1C2E] border-[#E2E8F0] shadow-sm hover:bg-[#EAF4F8]"
                }`}
              >
                <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[16px]" />
                <span>{saved ? "محفوظ في مفضلتك ✓" : "حفظ المقال"}</span>
              </button>
            </div>
          </div>

          <h1 className="font-hero-headline text-[24px] sm:text-[30px] md:text-[36px] font-black text-[#0B1C2E] leading-snug">
            {article.titleAr}
          </h1>

          {/* Author Strip */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] px-4 py-3 flex items-center justify-between flex-wrap gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#00ACC1]/25 font-black text-xs flex items-center justify-center shrink-0">
                {article.authorNameAr.slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xs sm:text-sm text-[#0B1C2E]">
                  {article.authorNameAr}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  {article.authorRoleAr} • {article.publishedDateAr}
                </span>
              </div>
            </div>
            {authorHref && (
              <Link
                href={authorHref}
                className="text-xs font-bold text-[#1D6E7D] hover:underline inline-flex items-center gap-1"
              >
                <span>عرض ملف الكاتب</span>
                <Icon name="arrow_back" className="text-[14px]" />
              </Link>
            )}
          </div>
        </header>

        {/* Optional Cover Image (never renders broken/empty box when article is text-only) */}
        {article.imageUrl && (
          <div className="relative w-full h-[220px] sm:h-[320px] md:h-[380px] rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-[0_12px_36px_rgba(11,28,46,0.07)]">
            <CaptenlyImage
              src={article.imageUrl}
              alt={article.titleAr}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 900px"
              className="object-cover"
            />
          </div>
        )}

        {/* Natural Rich Editorial Reading Sheet */}
        <section className="bg-white rounded-3xl border border-[#E2E8F0] p-5 sm:p-8 md:p-10 shadow-[0_8px_30px_rgba(11,28,46,0.04)] flex flex-col gap-6 leading-relaxed">
          {/* Article Summary Box (excerptAr) */}
          {article.excerptAr && (
            <div className="rounded-2xl bg-[#EAF4F8]/65 border border-[#00ACC1]/20 border-r-4 border-r-[#1D6E7D] p-4 md:p-5 flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#1D6E7D]">
                <Icon name="menu_book" className="text-[15px]" />
                <span>خلاصة المقال</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-[#0B1C2E] leading-relaxed">
                {article.excerptAr}
              </p>
            </div>
          )}

          {/* Natural Formatted Paragraphs, Subheadings, Numbered & Bulleted Lists */}
          <div className="flex flex-col gap-4 text-[#0B1C2E]">
            {blocks.map((block, i) => {
              if (block.type === "heading") {
                return (
                  <h2
                    key={i}
                    className="font-section-title text-lg md:text-xl font-black text-[#0B1C2E] border-r-4 border-[#1D6E7D] pr-3 pt-1 mt-2 leading-snug"
                  >
                    {block.text}
                  </h2>
                );
              }

              if (block.type === "ordered") {
                return (
                  <ol key={i} className="flex flex-col gap-2.5 my-1">
                    {block.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-3.5 text-sm md:text-[15px] text-[#334155] leading-relaxed"
                      >
                        <span className="w-6 h-6 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/30 text-[#1D6E7D] font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{renderInlineBold(item)}</span>
                      </li>
                    ))}
                  </ol>
                );
              }

              if (block.type === "unordered") {
                return (
                  <ul key={i} className="flex flex-col gap-2.5 my-1 pr-1">
                    {block.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm md:text-[15px] text-[#334155] leading-relaxed"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#00ACC1] shrink-0 mt-2.5" />
                        <span>{renderInlineBold(item)}</span>
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <p
                  key={i}
                  className="font-body-default text-[15px] md:text-base text-[#334155] leading-loose"
                >
                  {renderInlineBold(block.text)}
                </p>
              );
            })}
          </div>

          {/* Optional Key Takeaways Box (from AuthorArticlesManager keyTakeawaysAr) */}
          {takeaways.length > 0 && (
            <div className="rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-5 flex flex-col gap-3 mt-1">
              <div className="flex items-center gap-2 text-sm font-black text-[#0B1C2E]">
                <Icon name="check_circle" className="text-[18px] text-[#1D6E7D]" />
                <span>أهم النقاط المستفادة</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {takeaways.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-xl bg-white border border-[#E2E8F0] p-3 text-xs sm:text-sm font-semibold text-[#0B1C2E] leading-relaxed"
                  >
                    <Icon name="check" className="text-[15px] text-[#00ACC1] shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Share & Back Actions */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ShareButton
                title={article.titleAr}
                text={article.excerptAr}
                url={`/magazine/${article.slug}`}
                label="مشاركة المقال"
              />
              <button
                type="button"
                onClick={() => toggleFavorite(article.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  saved
                    ? "bg-[#1D6E7D] text-white border-[#1D6E7D]"
                    : "bg-[#F7F9FA] text-[#0B1C2E] border-[#E2E8F0] hover:bg-[#EAF4F8]"
                }`}
              >
                <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[15px]" />
                <span>{saved ? "محفوظ ✓" : "حفظ للقراءة لاحقاً"}</span>
              </button>
            </div>
            <Link
              href="/magazine"
              className="text-xs font-black text-[#1D6E7D] hover:underline inline-flex items-center gap-1"
            >
              <span>كل مقالات المجلة</span>
              <Icon name="arrow_back" className="text-[15px]" />
            </Link>
          </div>
        </section>

        {/* Linked Facilities */}
        {recommendedFacilities.length > 0 && (
          <section className="flex flex-col gap-4 pt-2">
            <h2 className="font-section-title text-lg md:text-2xl font-black text-[#0B1C2E]">
              منشآت مرتبطة بموضوع هذا الدليل
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
