"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function Desktop17() {
  const { isAuthenticated, currentPersona } = useCaptenly();
  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
  const isCoach = isAuthenticated && currentPersona.role === "coach";

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
      title: "الشارة 06: الالتزام المهني ومعايير السلامة",
      authority: "ميثاق العمل الرياضي والإنقاذ المائي",
      desc: "تخصيص ملفات التدريب للنطاق الرياضي وتأسيس السباحة والإنقاذ دون توصيفات طبية غير مرخصة.",
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
              لا تُنشر أي ملفات كباتن دون مراجعة المستندات وتوثيق رقم الهاتف لضمان موثوقية التدريب والسلامة داخل المسابح.
            </p>
          </div>
          <Link
            href={isFacilityManager ? "/dashboard/facility" : isCoach ? "/dashboard/coach" : "/claim"}
            className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm shrink-0 text-center"
          >
            {isFacilityManager ? "لوحة إدارة منشأتك" : isCoach ? "إدارة ملفك وشهاداتك" : "وثّق منشأتك أو ملفك الآن"}
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
      </div>
    </div>
  );
}
