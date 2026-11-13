"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PROHIBITED_MEDICAL_KEYWORDS } from "@/data/seedData";

export default function Desktop17() {
  const [sampleBio, setSampleBio] = useState(
    "مدرب سباحة تأسيس أطفال وإنقاذ مائي معتمد، حاصل على كارنيه نقابة المهن الرياضية."
  );

  const detectedKeyword = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => sampleBio.includes(kw));

  const badges = [
    {
      code: "01",
      title: "الشارة 01: الهوية الوطنية ورقم الهاتف",
      authority: "تحقق الهوية الرسمية",
      desc: "التأكد من هوية المدرب ومسؤولي المنشأة برقم قومي ساري ورقم هاتف فعلي.",
    },
    {
      code: "02",
      title: "الشارة 02: اعتماد المنشأة والمواصفات",
      authority: "مراجعة بيانات النادي / الأكاديمية",
      desc: "توثيق ملكية الصفحة لإدارة المنشأة مع إعلان مواصفات المسبح والمياه بصدق.",
    },
    {
      code: "03",
      title: "الشارة 03: المؤهل العلمي والتخصص الرياضي",
      authority: "كلية التربية الرياضية / الدورات المعتمدة",
      desc: "مطابقة التخصص الدقيق في السباحة والإنقاذ المائي دون ادعاءات طبية مخالفة.",
    },
    {
      code: "04",
      title: "الشارة 04: القيد النقابي والاتحادات الرياضية",
      authority: "نقابة المهن الرياضية / الاتحاد المصري للسباحة",
      desc: "تسجيل رقم كارنيه النقابة الساري وشهادة اعتماد الاتحاد الرياضي المختص.",
    },
    {
      code: "05",
      title: "الشارة 05: الإنقاذ المائي والإسعاف الأولي",
      authority: "الاتحاد المصري للغوص والإنقاذ (EDLF)",
      desc: "إلزامية شهادة الإنقاذ السارية لضمان سلامة السباحين داخل حمامات السباحة.",
    },
    {
      code: "06",
      title: "الشارة 06: الالتزام المهني (القانون 3/1985)",
      authority: "الامتثال التنظيمي والقانوني المصري",
      desc: "تخصيص المصطلحات العلاجية والطبية فقط للأطباء وأخصائيي العلاج الطبيعي المرخصين.",
    },
  ];

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1180px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 md:p-10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="text-electric-volt text-xs font-extrabold tracking-wide">
              نظام الاعتماد والشارات الخضراء (6 شارات)
            </span>
            <h1 className="font-hero-headline text-[26px] md:text-[32px] leading-[1.38] text-surface-card">
              كيف توثّق كابتنلي الكباتن والمنشآت قبل ظهور الشارة الخضراء؟
            </h1>
            <p className="font-body-default text-surface-container-high">
              لا تُنشر أي ملفات كباتن دون مراجعة المستندات وتوثيق رقم الهاتف. اختبر هنا فاحص المعايير الآلي وقدّم لتوثيق ملفك مجاناً.
            </p>
          </div>
          <Link
            href="/claim?mode=coach"
            className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm shrink-0 text-center"
          >
            وثّق ملفك واحصل على الشارات
          </Link>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
          {badges.map((b) => (
            <div key={b.code} className="bg-surface-card rounded-2xl p-6 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="w-9 h-9 rounded-full bg-lime-tint text-deep-olive font-black flex items-center justify-center text-sm shrink-0">
                  {b.code}
                </span>
                <span className="text-[11px] font-extrabold text-deep-olive text-left leading-snug">
                  {b.authority}
                </span>
              </div>
              <h2 className="font-card-title text-dark-slate mt-1">{b.title}</h2>
              <p className="font-body-compact text-text-muted">{b.desc}</p>
            </div>
          ))}
        </section>

        {/* Interactive Law 3/1985 Checker */}
        <section className="bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-4 border border-surface-container">
          <div>
            <h2 className="font-section-title text-dark-slate">
              اختبر فاحص الامتثال القانوني الفوري (القانون 3 لسنة 1985)
            </h2>
            <p className="font-body-compact text-text-muted mt-0.5">
              جرّب كتابة كلمة مثل «علاج طبيعي» أو «تشخيص طبي» داخل النبذة المهنية وشاهد كيف تحمي المنصة المتدربين والكباتن من المخالفة القانونية.
            </p>
          </div>

          <textarea
            rows={3}
            value={sampleBio}
            onChange={(e) => setSampleBio(e.target.value)}
            className="w-full rounded-xl bg-surface-snow p-4 text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
          />

          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
              detectedKeyword ? "bg-red-50 text-red-900 border border-red-200" : "bg-lime-tint/70 text-deep-olive"
            }`}
          >
            <Icon name={detectedKeyword ? "warning" : "check_circle"} className="text-[20px]" />
            <span>
              {detectedKeyword
                ? `تم رصد مصطلح محظور لغير الأطباء: «${detectedKeyword}» — استبدله بمصطلح إعداد بدني أو لياقة رياضية.`
                : "النص متوافق 100% مع القانون رقم 3 لسنة 1985 ومعايير كابتنلي."}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
