"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Award,
  PlusCircle,
  BarChart3,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Clock,
  FileWarning,
  Users,
} from "lucide-react";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function FounderAdminPage() {
  const {
    facilities,
    coaches,
    sessionLedgers,
    verifiedLeads,
    seedNewFacilityConcierge,
    simulateTimeTravelDays,
    isOfflineSimulated,
    toggleOfflineSimulation,
    checkInSession,
    validateAndSaveCoachBio,
    switchPersona,
    allPersonas,
  } = useCaptenly();

  const [activeAdminTab, setActiveAdminTab] = useState<
    "simulation_lab" | "concierge_seed" | "badges_queue" | "gates_kpis"
  >("simulation_lab");

  // 12-Step Concierge Pre-Builder State
  const [seedName, setSeedName] = useState(
    "أكاديمية النخبة للسباحة — نادي بلدية المحلة"
  );
  const [seedCity, setSeedCity] = useState("المحلة الكبرى");
  const [seedDistrict, setSeedDistrict] = useState("منطقة البلدية / محب");
  const [seedSport, setSeedSport] = useState<"swimming" | "fitness" | "both">(
    "swimming"
  );
  const [seedPrice, setSeedPrice] = useState<number>(700);
  const [seedWhatsapp, setSeedWhatsapp] = useState("201055566677");
  const [seedHeated, setSeedHeated] = useState(true);
  const [seedLadies, setSeedLadies] = useState(true);
  const [seededSuccessSlug, setSeededSuccessSlug] = useState("");

  // Simulation Lab Feedback
  const [simResultText, setSimResultText] = useState("");

  // Badge Queue Approval State
  const [badgeQueueItems, setBadgeQueueItems] = useState([
    {
      id: "req-101",
      coachName: "كابتن أحمد حسن الشناوي (CAP-ID-9042)",
      badgeTitle: "شارة #5: تجديد شهادة الإنقاذ السارية (EDLF)",
      submittedAgo: "منذ 4 ساعات (ضمن SLA 24–48h)",
      docRef: "EDLF-LG-2026-9910.webp (58 KB)",
      status: "pending",
    },
    {
      id: "req-102",
      coachName: "كابتن كريم جمال الدسوقي (CAP-ID-9105)",
      badgeTitle: "شارة #4: قيد الاتحاد المصري للسباحة (ESF)",
      submittedAgo: "منذ 9 ساعات (ضمن SLA 24–48h)",
      docRef: "ESF-CARD-2026-441.webp (64 KB)",
      status: "pending",
    },
    {
      id: "req-103",
      coachName: "بلاغ طارئ (SLA 12 ساعة) — حساب مدرب غير مرخص",
      badgeTitle: "مخالفة قانون 3/1985: محاولة ادعاء علاج غضروف وتأهيل طبي",
      submittedAgo: "منذ ساعتين (أولوية قصوى < 12h)",
      docRef: "تم الإيقاف التلقائي بالفلتر القانوني",
      status: "suspended",
    },
  ]);

  const handleCreateConciergeSeed = (e: React.FormEvent) => {
    e.preventDefault();
    const created = seedNewFacilityConcierge({
      nameAr: seedName,
      city: seedCity,
      district: seedDistrict,
      sportSector: seedSport,
      baseMonthlyPrice: seedPrice,
      whatsappNumber: seedWhatsapp,
      isHeatedWinter: seedHeated,
      hasLadiesSlots: seedLadies,
    });
    setSeededSuccessSlug(created.slug);
  };

  const handleApproveBadgeReq = (id: string) => {
    setBadgeQueueItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "approved" } : item))
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Founder Super Admin Header */}
      <div className="bg-captenly-slate text-white rounded-3xl p-6 sm:p-8 border-2 border-captenly-volt shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-captenly-volt text-captenly-slate text-xs font-black px-3 py-0.5 rounded-full">
              🛡️ لوحة تحكم المؤسس والأدمن (Founder Command Center & Simulation Lab)
            </span>
            <h1 className="text-2xl sm:text-3xl font-black pt-1">
              مركز قيادة كابتنلي (CAPTENLY) ومعمل اختبار العمليات
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              هنا تقدر تختبر كل تفاعلات المنصة، تجهز صفحات الأكاديميات قبل الزيارة الميدانية (12-Step Concierge)، تراجع الشارات الست، وتتابع بوابات الجاهزية الست للشهر السادس.
            </p>
          </div>

          <div className="bg-captenly-carbon border border-white/15 px-4 py-3 rounded-2xl text-xs space-y-1">
            <div className="text-captenly-volt font-black">
              ميزانية التأسيس النقدية (شهور 1–6):
            </div>
            <div className="font-inter font-extrabold text-white">
              أقصى عجز: 12,000 ج.م | التعادل: شهر 8 | فائض س1: +70,000 ج.م
            </div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          {[
            {
              id: "simulation_lab",
              label: "🧪 معمل محاكاة واختبار العمليات (Simulation Lab)",
              icon: FlaskConical,
            },
            {
              id: "concierge_seed",
              label: "🏗️ أداة البذر الميداني السريع (12-Step Concierge)",
              icon: PlusCircle,
            },
            {
              id: "badges_queue",
              label: "🏅 طابور فحص الشارات الست وطوارئ الـ 12 ساعة",
              icon: Award,
            },
            {
              id: "gates_kpis",
              label: "📈 بوابات الشهر السادس الست والـ 16 مؤشر KPI",
              icon: BarChart3,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveAdminTab(
                    tab.id as
                      | "simulation_lab"
                      | "concierge_seed"
                      | "badges_queue"
                      | "gates_kpis"
                  )
                }
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition ${
                  activeAdminTab === tab.id
                    ? "bg-captenly-volt text-captenly-slate shadow-volt"
                    : "bg-white/10 text-slate-200 hover:bg-white/20"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: INTERACTIVE WORKFLOW SIMULATION LAB */}
      {activeAdminTab === "simulation_lab" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border-2 border-captenly-olive shadow-card space-y-4">
            <h2 className="text-xl font-black text-captenly-slate flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-captenly-olive" />
              <span>
                معمل المحاكاة التفاعلي: اختبر أهم 4 سيناريوهات في المنصة بضغطة زر
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              صممنا لك المعمل ده عشان تختبر العمليات المشتركة بين (ولي الأمر + الكابتن + المنشأة) وتشوف النتيجة قدام عينك فوراً:
            </p>

            {simResultText && (
              <div className="bg-captenly-slate text-captenly-volt p-4 rounded-2xl text-xs sm:text-sm font-bold border-2 border-captenly-volt shadow-lg">
                ⚡ نتيجة المحاكاة اللحظية: {simResultText}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Scenario 1: Offline Poolside PIN Check-in */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-captenly-slate text-captenly-volt px-2.5 py-1 rounded-lg">
                    سيناريو 1 • MVP-09 (PWA أوفلاين)
                  </span>
                  <WifiOff className="w-5 h-5 text-captenly-olive" />
                </div>
                <h3 className="font-black text-base text-captenly-slate">
                  اختبار ختم الحصة #7 أوفلاين وتفعيل تنبيه التجديد
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يقوم بقطع الشبكة افتراضياً، ثم يبصم الحصة رقم 7 في دفتر السباح «يوسف طارق» بكود PIN (4829)، ويطلق تنبيه التجديد الذكي عند تبقي حصتين أو أقل.
                </p>
                <button
                  onClick={() => {
                    if (!isOfflineSimulated) toggleOfflineSimulation();
                    const res = checkInSession(
                      sessionLedgers[0].id,
                      sessionLedgers[0].pinCode,
                      "offline_sync",
                      "محاكاة ختم أوفلاين من معمل المؤسس"
                    );
                    setSimResultText(res.messageAr);
                  }}
                  className="w-full bg-captenly-slate hover:bg-captenly-carbon text-captenly-volt font-black text-xs py-3 rounded-xl transition"
                >
                  تشغيل محاكاة ختم الحصة الأوفلاين الآن ←
                </button>
              </div>

              {/* Scenario 2: 60 / 120-Day Price Freshness Time-Travel */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-captenly-slate text-captenly-volt px-2.5 py-1 rounded-lg">
                    سيناريو 2 • MVP-03 (حداثة الأسعار 60/120 يوم)
                  </span>
                  <Clock className="w-5 h-5 text-captenly-olive" />
                </div>
                <h3 className="font-black text-base text-captenly-slate">
                  اختبار تقديم الزمن لليوم 125 (إخفاء السعر القديم وخفض الترتيب)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ماذا يحدث لو تجاهلت أكاديمية تأكيد أسعارها لمدة 120 يوماً؟ اضغط لتقديم تاريخ «أكاديمية أبطال الدلتا» لليوم 125 وشاهد كيف يختفي السعر القديم وينزل ترتيبها في الدليل.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      simulateTimeTravelDays("fac-ghazl-mahalla", 125);
                      setSimResultText(
                        "تم تقديم تاريخ «مجمع سباحة نادي غزل المحلة» إلى 125 يوماً! تم إخفاء السعر القديم تلقائياً وخفض ترتيبها في صفحة /explore."
                      );
                    }}
                    className="flex-1 bg-red-700 hover:bg-red-800 text-white font-black text-xs py-3 rounded-xl transition"
                  >
                    محاكاة مرور 125 يوماً بدون تحديث
                  </button>
                  <button
                    onClick={() => {
                      simulateTimeTravelDays("fac-ghazl-mahalla", 0);
                      setSimResultText(
                        "تم تأكيد وتجديد أسعار «مجمع سباحة نادي غزل المحلة» لـ 60 يوماً جديدة باللون الأخضر!"
                      );
                    }}
                    className="bg-emerald-700 text-white font-black text-xs px-3 py-3 rounded-xl"
                  >
                    إعادة لليوم 0 ✓
                  </button>
                </div>
              </div>

              {/* Scenario 3: Law 3/1985 Medical Guardrail Test */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-captenly-slate text-captenly-volt px-2.5 py-1 rounded-lg">
                    سيناريو 3 • القانون رقم 3 لسنة 1985
                  </span>
                  <FileWarning className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-black text-base text-captenly-slate">
                  اختبار حظر انتحال صفة العلاج الطبيعي لغير الأطباء
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يختبر محاولة مدرب لياقة غير حاصل على الشارة السادسة كتابة «دكتور علاج طبيعي وعلاج الانزلاق الغضروفي» في بروفايله، ويريك كيف يرفضه الفلتر القانوني فوراً.
                </p>
                <button
                  onClick={() => {
                    const res = validateAndSaveCoachBio(
                      coaches[0].id,
                      "كابتن متخصص في علاج طبيعي وعلاج الانزلاق الغضروفي وتأهيل إصابات"
                    );
                    setSimResultText(res.messageAr);
                  }}
                  className="w-full bg-captenly-slate hover:bg-captenly-carbon text-captenly-volt font-black text-xs py-3 rounded-xl transition"
                >
                  تشغيل اختبار الفلتر القانوني الطبي ←
                </button>
              </div>

              {/* Scenario 4: Role Switching Matrix */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-captenly-slate text-captenly-volt px-2.5 py-1 rounded-lg">
                    سيناريو 4 • التبديل بين الحسابات الـ 6
                  </span>
                  <Users className="w-5 h-5 text-captenly-olive" />
                </div>
                <h3 className="font-black text-base text-captenly-slate">
                  تبديل الهوية الفوري لاختبار صلاحيات كل حساب
                </h3>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {allPersonas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        switchPersona(p.id);
                        setSimResultText(
                          `تم التبديل بنجاح إلى حساب: (${p.shortLabelAr} — ${p.fullNameAr}).`
                        );
                      }}
                      className="bg-white hover:bg-captenly-tint border border-slate-300 text-captenly-slate font-extrabold text-[11px] py-2 px-2.5 rounded-xl text-right truncate transition"
                    >
                      {p.shortLabelAr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 12-STEP CONCIERGE FIELD ONBOARDING BUILDER */}
      {activeAdminTab === "concierge_seed" && (
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-card space-y-5">
          <div>
            <span className="text-xs font-extrabold text-captenly-olive bg-captenly-tint px-3 py-0.5 rounded-full">
              القسم 05 من استراتيجية النمو • قاعدة «ابنِ الصفحة أولاً ثم اعرضها جاهزة» (يرفع القبول إلى &gt; 70%)
            </span>
            <h2 className="text-xl font-black text-captenly-slate mt-1">
              أداة البذر الميداني السريع (تجهيز صفحة مسودة لمنشأة قبل زيارتها)
            </h2>
            <p className="text-xs text-slate-600">
              جهّز صفحة الأكاديمية في دقيقتين قبل النزول الميداني في المحلة أو طنطا، ثم افتحها على موبايلك أمام المدير ليسلمك الأسعار ويستلم إدارتها فوراً.
            </p>
          </div>

          <form
            onSubmit={handleCreateConciergeSeed}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                اسم الأكاديمية أو المسبح:
              </label>
              <input
                type="text"
                required
                value={seedName}
                onChange={(e) => setSeedName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">المدينة:</label>
              <select
                value={seedCity}
                onChange={(e) => setSeedCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold"
              >
                <option value="المحلة الكبرى">المحلة الكبرى</option>
                <option value="طنطا">طنطا</option>
                <option value="كفر الزيات">كفر الزيات</option>
                <option value="زفتى">زفتى</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                الحي / النادي:
              </label>
              <input
                type="text"
                required
                value={seedDistrict}
                onChange={(e) => setSeedDistrict(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                القطاع الرياضي:
              </label>
              <select
                value={seedSport}
                onChange={(e) =>
                  setSeedSport(e.target.value as "swimming" | "fitness" | "both")
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold"
              >
                <option value="swimming">سباحة وأمان مائي</option>
                <option value="both">تأسيس وإنقاذ مائي متقدم</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                سعر الباقة الشهرية الأساسي (ج.م):
              </label>
              <input
                type="number"
                required
                value={seedPrice}
                onChange={(e) => setSeedPrice(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-inter font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                رقم واتساب الاستقبال:
              </label>
              <input
                type="tel"
                required
                value={seedWhatsapp}
                onChange={(e) => setSeedWhatsapp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-inter font-bold"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-4 pt-2">
              <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedHeated}
                  onChange={(e) => setSeedHeated(e.target.checked)}
                  className="accent-captenly-olive"
                />
                <span>🔥 مسبح مدفأ شتاءً</span>
              </label>
              <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedLadies}
                  onChange={(e) => setSeedLadies(e.target.checked)}
                  className="accent-captenly-olive"
                />
                <span>👩 مواعيد سيدات مستقلة</span>
              </label>

              <button
                type="submit"
                className="ms-auto bg-captenly-slate hover:bg-captenly-carbon text-captenly-volt font-black text-xs px-6 py-3 rounded-xl shadow-lg transition"
              >
                + إنشاء الصفحة المسودة وتوليد رابط الاستلام الميداني
              </button>
            </div>
          </form>

          {seededSuccessSlug && (
            <div className="bg-captenly-tint border-2 border-captenly-olive p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
              <span className="text-captenly-slate">
                ✓ تم إنشاء الصفحة المسودة بنجاح! يمكنك فتحها الآن أمام مدير المنشأة وتجربة زر «استلم إدارة المنشأة مجاناً».
              </span>
              <Link
                href={`/f/${seededSuccessSlug}`}
                className="bg-captenly-slate text-captenly-volt font-black px-4 py-2 rounded-xl"
              >
                افتح الصفحة المسودة الجديدة ↗
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 6 INDEPENDENT BADGES VERIFICATION QUEUE & 12H EMERGENCY SLA */}
      {activeAdminTab === "badges_queue" && (
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-captenly-slate">
                طابور فحص وثائق الشارات الست المستقلة (SLA 24–48h) وبروتوكول طوارئ الـ 12 ساعة
              </h2>
              <p className="text-xs text-slate-600">
                كل مستند مرفوع محفوظ داخل حاوية خاصة مقفولة (Private Storage Bucket)؛ لا تُمنح الشارة إلا بعد فحصك البصري لتاريخ الصلاحية.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {badgeQueueItems.map((req) => (
              <div
                key={req.id}
                className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-4 text-xs ${
                  req.status === "suspended"
                    ? "bg-red-50 border-red-300"
                    : req.status === "approved"
                    ? "bg-emerald-50 border-emerald-300"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="space-y-1">
                  <div className="font-black text-sm text-captenly-slate">
                    {req.coachName}
                  </div>
                  <div className="font-bold text-captenly-olive">{req.badgeTitle}</div>
                  <div className="text-slate-500">
                    الملف: {req.docRef} • {req.submittedAgo}
                  </div>
                </div>

                <div>
                  {req.status === "pending" && (
                    <button
                      onClick={() => handleApproveBadgeReq(req.id)}
                      className="bg-captenly-slate text-captenly-volt font-black px-4 py-2.5 rounded-xl"
                    >
                      اعتماد الوثيقة ومنح الشارة ✓
                    </button>
                  )}
                  {req.status === "approved" && (
                    <span className="inline-flex items-center gap-1 font-black text-emerald-800 bg-emerald-200 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                      تم التوثيق وتفعيل الشارة
                    </span>
                  )}
                  {req.status === "suspended" && (
                    <span className="inline-flex items-center gap-1 font-black text-red-900 bg-red-200 px-3 py-1.5 rounded-xl">
                      <AlertTriangle className="w-4 h-4" />
                      موقوف بموجب بروتوكول الـ 12 ساعة
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: THE 6 MANDATORY MONTH-6 STAGE GATES & 16 GROWTH KPIS */}
      {activeAdminTab === "gates_kpis" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-card space-y-4">
            <h2 className="text-xl font-black text-captenly-slate">
              بوابات الجاهزية الست الحاكمة بنهاية الشهر السادس (Month-6 Stage Gates) قبل تفعيل الدفع
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {[
                {
                  gate: "البوابة 1: إثبات الاستعداد للدفع (WTP)",
                  target: "110 مقابلة ميدانية + ≥ 25% قبول سعري + ≥ 10 خطابات نوايا (LOIs)",
                  status: "قيد التحقق الميداني (المرحلة 1B)",
                },
                {
                  gate: "البوابة 2: الكتلة الحرجة للمنشآت",
                  target: "≥ 60 منشأة نشطة وموثقة في المحلة وطنطا والغربية (اكتمال ≥ 85%)",
                  status: `نشط بالمحاكي: ${facilities.length} منشآت نموذجية`,
                },
                {
                  gate: "البوابة 3: الكتلة الحرجة للكباتن",
                  target: "≥ 156 كابتن مستقل موثق بالشارات الست (سباحة + لياقة)",
                  status: `نشط بالمحاكي: ${coaches.length} كباتن نموذجيين`,
                },
                {
                  gate: "البوابة 4: سيولة الطلب والاحتفاظ",
                  target: "≥ 18,000 زيارة/شهر + ≥ 450 ليد واتساب موثق + ≥ 150 دفتر حصص نشط",
                  status: `دفاتر نشطة: ${sessionLedgers.length} | ليدات: ${verifiedLeads.length}`,
                },
                {
                  gate: "البوابة 5: الجاهزية القانونية والضريبية",
                  target: "تأسيس الكيان الضريبي + الفاتورة الإلكترونية + إيداع علامة CAPTENLY في ITDA + Paymob",
                  status: "مجدول للشهر الرابع والخامس (4,500 ج.م)",
                },
                {
                  gate: "البوابة 6: الانضباط النقدي التأسيسي",
                  target: "عدم تجاوز إجمالي الكاش المصروف في أول 6 شهور سقف 12,000 ج.م",
                  status: "4,500 ج.م (1A) + 7,500 ج.م (1B) = 12,000 ج.م ✓",
                },
              ].map((g) => (
                <div
                  key={g.gate}
                  className="bg-captenly-soft border border-captenly-olive/30 rounded-2xl p-4 space-y-1.5"
                >
                  <div className="font-black text-sm text-captenly-slate">{g.gate}</div>
                  <p className="text-slate-600 leading-relaxed">{g.target}</p>
                  <div className="text-[11px] font-extrabold text-captenly-olive pt-1">
                    الحالة: {g.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
