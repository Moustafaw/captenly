"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { EditorialArticle } from "@/types/captenly";

interface AuthorArticlesManagerProps {
  authorType: "coach" | "facility";
  authorEntityId?: string;
  authorSlug?: string;
  authorNameAr: string;
  authorRoleAr: string;
  onFeedback?: (fb: { ok: boolean; msg: string }) => void;
}

const ARTICLE_CATEGORIES = [
  "تدريب وتكنيك السباحة",
  "سلامة مائية وتأسيس أطفال",
  "تجهيز البطولات والفرق",
  "تغذية ولياقة السباحين",
  "نصائح لأولياء الأمور",
  "أخبار وفعاليات الأكاديمية",
];

export function AuthorArticlesManager({
  authorType,
  authorEntityId,
  authorSlug,
  authorNameAr,
  authorRoleAr,
  onFeedback,
}: AuthorArticlesManagerProps) {
  const { articles, currentPersona, saveEditorialArticle, deleteEditorialArticle } = useCaptenly();

  const myArticles = articles.filter(
    (a) =>
      (authorEntityId && a.authorEntityId === authorEntityId) ||
      a.authorPersonaId === currentPersona.id ||
      a.authorNameAr.trim() === authorNameAr.trim()
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleAr, setTitleAr] = useState("");
  const [categoryAr, setCategoryAr] = useState(ARTICLE_CATEGORIES[0]);
  const [excerptAr, setExcerptAr] = useState("");
  const [takeawaysText, setTakeawaysText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [localMsg, setLocalMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (art: EditorialArticle) => {
    setEditingId(art.id);
    setTitleAr(art.titleAr);
    setCategoryAr(art.categoryAr || ARTICLE_CATEGORIES[0]);
    setExcerptAr(art.excerptAr || "");
    setTakeawaysText((art.keyTakeawaysAr || []).join("\n"));
    setBodyText((art.bodyParagraphsAr || []).join("\n\n"));
    setImageUrl(art.imageUrl || "");
    setLocalMsg(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitleAr("");
    setCategoryAr(ARTICLE_CATEGORIES[0]);
    setExcerptAr("");
    setTakeawaysText("");
    setBodyText("");
    setImageUrl("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalMsg({ ok: false, text: "يرجى اختيار ملف صورة صالح (JPG / PNG / WebP)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1200;
        const maxH = 675;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        if (h > maxH) {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.84);
          setImageUrl(compressed);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanParagraphs = bodyText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const cleanTakeaways = takeawaysText
      .split(/\n+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (!titleAr.trim() || cleanParagraphs.length === 0) {
      const err = "يرجى كتابة عنوان المقال ونص المقال الأساسي أولاً.";
      setLocalMsg({ ok: false, text: err });
      onFeedback?.({ ok: false, msg: err });
      return;
    }

    setIsSaving(true);
    setSaveProgress(18);
    setLocalMsg(null);
    const t1 = setTimeout(() => setSaveProgress(56), 500);
    const t2 = setTimeout(() => setSaveProgress(86), 1100);

    setTimeout(() => {
      clearTimeout(t1);
      clearTimeout(t2);
      setSaveProgress(100);

      const res = saveEditorialArticle({
        id: editingId || undefined,
        titleAr: titleAr.trim(),
        categoryAr,
        excerptAr: excerptAr.trim(),
        keyTakeawaysAr: cleanTakeaways,
        bodyParagraphsAr: cleanParagraphs,
        // إذا لم يرفع الكاتب صورة، يتم حفظ المقال بدون أي صورة افتراضية نهائياً
        imageUrl: imageUrl.trim() || undefined,
        authorNameAr,
        authorRoleAr,
        authorType,
        authorEntityId,
        authorSlug,
      });

      setTimeout(() => {
        setIsSaving(false);
        setSaveProgress(0);
        setLocalMsg({ ok: res.ok, text: res.messageAr });
        onFeedback?.({ ok: res.ok, msg: res.messageAr });
        if (res.ok) {
          resetForm();
        }
      }, 220);
    }, 1650);
  };

  return (
    <div className="flex flex-col gap-6 animate-captenly-enter">
      {/* Header & Overview */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-card-title text-[#0B1C2E] font-black flex items-center gap-2">
            <Icon name="article" className="text-[20px] text-[#1D6E7D]" />
            <span>مقالاتي ومنشوراتي الرياضية ({myArticles.length})</span>
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            انشر مقالاتك ونصائحك التدريبية لتظهر فوراً في «مجلة كابتنلي» وفي بروفايلك العام مع إمكانية تعديلها في أي وقت.
          </p>
        </div>
        <Link
          href="/magazine"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F7F9FA] border border-[#E2E8F0] text-xs font-bold text-[#0B1C2E] hover:bg-[#EAF4F8] transition"
        >
          <Icon name="menu_book" className="text-[15px] text-[#1D6E7D]" />
          <span>تصفح مجلة كابتنلي</span>
        </Link>
      </div>

      {localMsg && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-bold border flex items-center justify-between gap-2 ${
            localMsg.ok
              ? "bg-[#EAF4F8] text-[#1D6E7D] border-[#00ACC1]/30"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <span>{localMsg.text}</span>
          <button type="button" onClick={() => setLocalMsg(null)} className="underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Existing Articles List */}
      {myArticles.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-extrabold text-[#0B1C2E]">
            مقالاتك المنشورة ({myArticles.length}) — اضغط على «تعديل» لتحديث أي مقال:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myArticles.map((art) => (
              <div
                key={art.id}
                className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#E2E8F0] flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {art.imageUrl ? (
                    <img
                      src={art.imageUrl}
                      alt={art.titleAr}
                      className="w-20 h-16 rounded-xl object-cover shrink-0 border border-[#E2E8F0]"
                    />
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[10px] font-bold text-[#64748B] shrink-0">
                      مقال نصي
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold text-[#1D6E7D] bg-[#EAF4F8] px-2.5 py-0.5 rounded-full">
                        {art.categoryAr}
                      </span>
                      <span className="text-[10px] text-[#64748B]">{art.publishedDateAr}</span>
                    </div>
                    <Link
                      href={`/magazine/${art.slug}`}
                      className="font-bold text-sm text-[#0B1C2E] hover:text-[#1D6E7D] line-clamp-1"
                    >
                      {art.titleAr}
                    </Link>
                    <p className="text-xs text-[#64748B] line-clamp-2">{art.excerptAr}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                  <Link
                    href={`/magazine/${art.slug}`}
                    className="text-[11px] font-bold text-[#1D6E7D] hover:underline flex items-center gap-1"
                  >
                    <Icon name="open_in_new" className="text-[13px]" />
                    <span>عرض المقال</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(art)}
                      className="px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-[11px] font-bold text-[#0B1C2E] hover:bg-[#EAF4F8] transition cursor-pointer"
                    >
                      تعديل المقال
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteEditorialArticle(art.id);
                        if (editingId === art.id) resetForm();
                        setLocalMsg({ ok: true, text: "تم حذف المقال من المجلة ومن بروفايلك." });
                      }}
                      className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold hover:bg-red-100 transition cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Article Composer / Editor Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl bg-[#F7F9FA] p-5 border border-[#E2E8F0] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-card-title-sm text-[#0B1C2E] font-black flex items-center gap-1.5">
            <Icon name={editingId ? "edit_note" : "post_add"} className="text-[18px] text-[#1D6E7D]" />
            <span>
              {editingId ? "تعديل المقال المنشور" : "كتابة ونشر مقال رياضي جديد"}
            </span>
          </h4>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
            >
              إلغاء التعديل وبدء مقال جديد
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C2E]">عنوان المقال *</label>
            <input
              required
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder="مثلاً: كيف تختار مدرسة السباحة المناسبة لطفلك قبل موسم الصيف؟"
              className="rounded-xl bg-white px-3.5 py-2.5 text-xs text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#0B1C2E]">التصنيف الرياضي</label>
            <select
              value={categoryAr}
              onChange={(e) => setCategoryAr(e.target.value)}
              className="rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
            >
              {ARTICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C2E]">
            مقدمة مختصرة / ملخص سريع (اختياري)
          </label>
          <input
            value={excerptAr}
            onChange={(e) => setExcerptAr(e.target.value)}
            placeholder="جملة أو جملتان تلخص فكرة المقال للقراء في بطاقة المجلة وصندوق الخلاصة..."
            className="rounded-xl bg-white px-3.5 py-2.5 text-xs text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C2E]">
            نص المقال الكامل * (افصل بين الفقرات بسطر جديد — يدعم `## للعناوين الفرعية` و `1.` و `-` للقوائم و `**للتعريض**`)
          </label>
          <textarea
            required
            rows={6}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="اكتب محتوى المقال بالتفصيل هنا... كل سطر جديد يُعرض كفقرة منظمة ومريحة للقراءة في المجلة."
            className="rounded-xl bg-white px-3.5 py-3 text-xs text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1] leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#0B1C2E]">
            أهم النقاط المستفادة (اختياري — نقطة في كل سطر، تظهر بصندوق مستقل بنهاية المقال)
          </label>
          <textarea
            rows={3}
            value={takeawaysText}
            onChange={(e) => setTakeawaysText(e.target.value)}
            placeholder={"التأكد من تواجد منقذ معتمد بجوار الحمام\nاختيار مجموعة لا تتجاوز 6 سباحين في الحارة"}
            className="rounded-xl bg-white px-3.5 py-2.5 text-xs text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
          />
        </div>

        {/* Optional Cover Image (Never injects a default image if empty) */}
        <div className="rounded-2xl bg-white p-3.5 border border-[#E2E8F0] flex flex-col gap-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#0B1C2E]">
                صورة المقال (اختيارية تماماً — المقاس الموصى به 1200×675 بكسل)
              </span>
              <span className="text-[11px] text-[#64748B]">
                إذا لم تقم برفع صورة، سيُنشر المقال بتصميم نصي نظيف بدون إضافة أي صورة افتراضية.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-full bg-[#F7F9FA] border border-[#E2E8F0] text-xs font-bold text-[#0B1C2E] hover:bg-[#EAF4F8] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Icon name="add_photo_alternate" className="text-[16px] text-[#1D6E7D]" />
                <span>{imageUrl ? "تغيير الصورة" : "رفع صورة للمقال (اختياري)"}</span>
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="px-3 py-2 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 transition cursor-pointer"
                >
                  إزالة الصورة (نشر بدون صورة)
                </button>
              )}
            </div>
          </div>

          {imageUrl && (
            <div className="flex items-center gap-3 pt-1">
              <img
                src={imageUrl}
                alt="معاينة صورة المقال"
                className="w-32 h-20 rounded-xl object-cover border border-[#E2E8F0]"
              />
              <span className="text-[11px] font-bold text-[#1D6E7D]">
                تم إرفاق صورة للمقال وستظهر في بطاقة المجلة وأعلى المقال ✓
              </span>
            </div>
          )}
        </div>

        {isSaving && (
          <div className="rounded-2xl bg-[#EAF4F8] border border-[#00ACC1]/30 p-3.5 flex flex-col gap-2 animate-captenly-enter">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#1D6E7D]">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-[#1D6E7D] border-t-transparent animate-spin" />
                {editingId ? "جاري حفظ تعديلات المقال..." : "جاري رفع ونشر المقال في المجلة والبروفايل..."}
              </span>
              <span dir="ltr">{saveProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white overflow-hidden">
              <div
                className="h-full bg-[#1D6E7D] rounded-full transition-all duration-300"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs shadow-sm disabled:opacity-60 flex items-center gap-2 transition cursor-pointer"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>جاري الحفظ ({saveProgress}%)...</span>
              </>
            ) : (
              <>
                <Icon name="publish" className="text-[16px]" />
                <span>{editingId ? "حفظ تعديلات المقال ✓" : "نشر المقال الآن ✓"}</span>
              </>
            )}
          </button>
          <span className="text-[11px] text-[#64748B]">
            الكاتب: <strong className="text-[#0B1C2E]">{authorNameAr}</strong> ({authorRoleAr})
          </span>
        </div>
      </form>
    </div>
  );
}
