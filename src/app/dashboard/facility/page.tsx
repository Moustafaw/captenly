"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  Radar,
  CheckCircle2,
  Clock,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Users,
  Eye,
  Scale,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function FacilityDashboardPage() {
  const {
    facilities,
    coaches,
    verifiedLeads,
    demandRadar,
    confirmFacilityPrices60d,
    simulateTimeTravelDays,
    approveAffiliationMutual,
  } = useCaptenly();

  const [selectedFacId, setSelectedFacId] = useState(facilities[0].id);
  const facility =
    facilities.find((f) => f.id === selectedFacId) || facilities[0];

  const [newBasePrice, setNewBasePrice] = useState<number>(
    facility.pricePackages[0]?.baseMonthlyEgp || 750
  );
  const [priceConfirmedMsg, setPriceConfirmedMsg] = useState("");
  const [selectedRadarCity, setSelectedRadarCity] = useState("المحلة الكبرى");

  // Paymob B2B Checkout Sandbox State (Phase 2A - Month 7)
  const [selectedPlan, setSelectedPlan] = useState<"facility_pro" | "prepaid_leads">(
    "facility_pro"
  );
  const [paymobPaidSuccess, setPaymobPaidSuccess] = useState(false);

  const facilityLeads = verifiedLeads.filter((l) => l.targetId === facility.id);
  const activeRadar =
    demandRadar.find((r) => r.city === selectedRadarCity) || demandRadar[0];

  // Coaches requesting affiliation with this facility
  const pendingCoaches = coaches.filter((c) =>
    c.affiliations.some(
      (a) => a.facilityId === facility.id && a.status === "pending"
    )
  );

  const handleConfirmPrices = (e: React.FormEvent) => {
    e.preventDefault();
    confirmFacilityPrices60d(facility.id, newBasePrice);
    setPriceConfirmedMsg(
      "✓ تم تأكيد وتحديث جدول الأسعار الشامل بضغطة زر! تجدد عداد الـ 60 يوماً باللون الأخضر فوراً."
    );
    setTimeout(() => setPriceConfirmedMsg(""), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-captenly-slate text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-captenly-volt text-captenly-slate text-xs font-black px-3 py-0.5 rounded-full">
              MVP-11 & MVP-12 • لوحة تحكم المنشأة وإثبات العائد التجاري (B2B)
            </span>
            <span className="text-xs font-bold bg-white/10 text-captenly-tint px-3 py-0.5 rounded-full">
              أول 6 شهور مجانية 100% (إثبات القيمة قبل التسييل)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            لوحة إدارة: {facility.nameAr}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            تابع مشاهدات صفحتك، المقارنات، الليدات المؤهلة بكود #CAP، رادار الطلب المحلي في منطقتك، وحدّث أسعارك في ثانية.
          </p>
        </div>

        {/* Facility Selector for Testing */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedFacId}
            onChange={(e) => {
              setSelectedFacId(e.target.value);
              const found = facilities.find((f) => f.id === e.target.value);
              if (found && found.pricePackages[0]) {
                setNewBasePrice(found.pricePackages[0].baseMonthlyEgp);
              }
            }}
            className="bg-captenly-carbon border border-captenly-volt/50 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nameAr}
              </option>
            ))}
          </select>

          <Link
            href={`/f/${facility.slug}`}
            className="bg-captenly-volt text-captenly-slate font-black text-xs px-4 py-2.5 rounded-xl"
          >
            معاينة صفحة المنشأة ↗
          </Link>
        </div>
      </div>

      {/* B2B MONTHLY VALUE PROOF SCORECARD (MVP-11 / Appendix F) */}
      <div className="bg-captenly-gradient text-white rounded-3xl p-6 sm:p-8 border-2 border-captenly-volt shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div>
            <span className="text-xs font-extrabold text-captenly-volt">
              📊 الملحق (F) • بطاقة إثبات القيمة الشهرية الموثقة للمنشأة (MVP-11 Value Proof)
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-1">
              تقرير العائد الشهري الفعلي لـ «{facility.nameAr.split("—")[0]}» — نوفمبر 2026
            </h2>
          </div>
          <div className="bg-black/30 border border-captenly-volt/40 px-4 py-2 rounded-2xl text-xs font-bold text-captenly-tint">
            قيمة باقة Facility Pro (900 ج.م) = اشتراك لاعب واحد فقط في الشهر!
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-captenly-carbon/80 border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>مشاهدات أولياء الأمور</span>
              <Eye className="w-4 h-4 text-captenly-volt" />
            </div>
            <div className="font-inter font-black text-3xl text-white">
              {facility.monthlyMetrics.profileViews.toLocaleString()}
            </div>
            <div className="text-[11px] text-captenly-tint">
              باحث نشط في {facility.city} هذا الشهر
            </div>
          </div>

          <div className="bg-captenly-carbon/80 border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>الظهور في جدول المقارنة</span>
              <Scale className="w-4 h-4 text-captenly-volt" />
            </div>
            <div className="font-inter font-black text-3xl text-white">
              {facility.monthlyMetrics.comparisonAppearances}
            </div>
            <div className="text-[11px] text-captenly-tint">
              مقارنة مباشرة (MVP-04) مع المنافسين
            </div>
          </div>

          <div className="bg-captenly-carbon/80 border border-captenly-volt/50 rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-captenly-volt font-bold">
              <span>استفسارات واتساب مؤهلة</span>
              <MessageCircle className="w-4 h-4 text-captenly-volt" />
            </div>
            <div className="font-inter font-black text-3xl text-captenly-volt">
              {facility.monthlyMetrics.verifiedWhatsappLeads}
            </div>
            <div className="text-[11px] text-slate-300">
              عميل فريد بكود (#CAP) مخصوم التكرار 30 يوم
            </div>
          </div>

          <div className="bg-captenly-carbon/80 border border-white/10 rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>دفاتر الحصص النشطة</span>
              <QrCode className="w-4 h-4 text-captenly-volt" />
            </div>
            <div className="font-inter font-black text-3xl text-white">
              {facility.monthlyMetrics.activeSessionLedgers}
            </div>
            <div className="text-[11px] text-captenly-tint">
              مشترك يتابع حصصه وإيصالاته أسبوعياً
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Right Column (7 cols): Hyper-Local Demand Radar (MVP-12) + 60/120-Day Price Manager */}
        <div className="lg:col-span-7 space-y-6">
          {/* HYPER-LOCAL DEMAND RADAR (MVP-12 with Sample Size >= 30 Rule) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-card space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-extrabold text-captenly-olive bg-captenly-tint px-2.5 py-0.5 rounded-full">
                  MVP-12 • رادار الطلب المحلي (قاعدة النزاهة الإحصائية Sample Size ≥ 30)
                </span>
                <h2 className="text-lg font-black text-captenly-slate mt-1 flex items-center gap-2">
                  <Radar className="w-5 h-5 text-captenly-olive" />
                  <span>على ماذا يبحث الأهالي والمتدربون في مدينتك هذا الشهر؟</span>
                </h2>
              </div>

              <select
                value={selectedRadarCity}
                onChange={(e) => setSelectedRadarCity(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-extrabold"
              >
                <option value="المحلة الكبرى">المحلة الكبرى (عينة = 412 بحث ✓)</option>
                <option value="طنطا">طنطا (عينة = 328 بحث ✓)</option>
                <option value="زفتى">زفتى (عينة = 19 بحث — اختبار حجب &lt; 30)</option>
              </select>
            </div>

            {activeRadar.totalSearchesMonth < 30 ? (
              <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-5 space-y-2">
                <div className="font-black text-sm flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    حماية النزاهة الإحصائية (Sample Size = {activeRadar.totalSearchesMonth} &lt; 30 عملية بحث):
                  </span>
                </div>
                <p className="text-xs leading-relaxed">
                  التزاماً بميثاق مصداقية كابتنلي أمام مديري المنشآت، لا يتم عرض أي نسب مئوية أو مؤشرات فجوة سعرية في «رادار الطلب المحلي» لمدينة ({activeRadar.city}) حتى يتجاوز حجم العينة 30 عملية بحث مفلترة حقيقية خلال الشهر.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-slate-600 font-bold">
                  إجمالي عمليات البحث المفلترة الموثقة في ({activeRadar.city}) هذا الشهر:{" "}
                  <strong className="font-inter text-captenly-slate">
                    {activeRadar.totalSearchesMonth} عملية بحث
                  </strong>
                </div>

                {activeRadar.topUnmetFilters.map((item) => (
                  <div
                    key={item.filterTitleAr}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-black text-captenly-slate">
                        {item.filterTitleAr}
                      </span>
                      <span className="font-inter font-black text-sm text-captenly-olive bg-captenly-tint px-2.5 py-0.5 rounded-lg">
                        {item.percentage}% ({item.searchCount} باحث)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-captenly-olive rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-800">
                      💡 توصية كابتنلي التجارية: {item.opportunityNoteAr}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 60 / 120-DAY PRICE FRESHNESS LIFECYCLE MANAGER & TIME-TRAVEL TESTER */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black text-captenly-slate flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-captenly-olive" />
                <span>إدارة الأسعار ودورة الحداثة التلقائية (60 / 120 يوماً — MVP-03)</span>
              </h2>
              <span className="text-xs font-bold text-slate-500">
                حالة السعر الحالية: منذ {facility.priceLastVerifiedDaysAgo} يوم
              </span>
            </div>

            {/* Founder Time-Travel Simulation Buttons */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="text-xs font-extrabold text-captenly-slate">
                🧪 محاكي اختبار دورة الـ 60/120 يوماً (للمؤسس):
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => simulateTimeTravelDays(facility.id, 5)}
                  className="text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl transition"
                >
                  يوم 5 (أخضر نشط &lt; 60 يوم)
                </button>
                <button
                  type="button"
                  onClick={() => simulateTimeTravelDays(facility.id, 75)}
                  className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-xl transition"
                >
                  يوم 75 (كهرماني تذكير 61–119 يوم)
                </button>
                <button
                  type="button"
                  onClick={() => simulateTimeTravelDays(facility.id, 125)}
                  className="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-900 px-3 py-1.5 rounded-xl transition"
                >
                  يوم 125 (أحمر قديم &gt; 120 يوم — إخفاء السعر وخفض الترتيب)
                </button>
              </div>
            </div>

            <form
              onSubmit={handleConfirmPrices}
              className="flex flex-wrap items-end gap-3 pt-2"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  تحديث أو تأكيد سعر الاشتراك الشهري الأساسي (ج.م):
                </label>
                <input
                  type="number"
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-inter font-black text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-captenly-slate hover:bg-captenly-carbon text-captenly-volt font-black text-xs px-5 py-3 rounded-xl transition"
              >
                ✓ أؤكد صحة وثبات الأسعار لـ 60 يوماً جديدة
              </button>
            </form>

            {priceConfirmedMsg && (
              <div className="bg-emerald-100 text-emerald-900 p-3 rounded-xl text-xs font-bold">
                {priceConfirmedMsg}
              </div>
            )}
          </div>

          {/* Pending Coach Affiliations Approval */}
          {pendingCoaches.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 space-y-3">
              <h3 className="font-black text-sm text-captenly-slate">
                طلبات ربط ثنائي واردة من كباتن مستقلين ({pendingCoaches.length}):
              </h3>
              {pendingCoaches.map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-black text-captenly-slate">
                      {c.fullNameAr} ({c.SingleCoachId})
                    </div>
                    <div className="text-slate-600">{c.titleAr}</div>
                  </div>
                  <button
                    onClick={() => approveAffiliationMutual(c.id, facility.id)}
                    className="bg-captenly-olive text-white font-black px-4 py-2 rounded-xl"
                  >
                    موافقة وتأكيد الربط الثنائي ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Left Column (5 cols): Verified Leads Inbox (SLA < 2h) + Paymob B2B Subscription Sandbox */}
        <div className="lg:col-span-5 space-y-6">
          {/* Verified Leads Inbox & SLA < 2 Hours Tracker */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold text-captenly-olive bg-captenly-tint px-2.5 py-0.5 rounded-full">
                  MVP-11 • عدم تكرار الرقم خلال 30 يوماً
                </span>
                <h3 className="text-base font-black text-captenly-slate mt-1">
                  صندوق استفسارات واتساب الموثقة ({facilityLeads.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                SLA الرد: {facility.avgReplyMinutes} د
              </span>
            </div>

            <div className="space-y-3">
              {facilityLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-inter font-black bg-captenly-slate text-captenly-volt px-2 py-0.5 rounded">
                      {lead.referralCode}
                    </span>
                    <span className="text-[11px] text-slate-500">{lead.createdAtAr}</span>
                  </div>
                  <div className="font-black text-captenly-slate">
                    {lead.inquirerNameAr} ({lead.inquirerPhone}) — سن اللاعب: {lead.athleteAge}{" "}
                    سنوات
                  </div>
                  <div className="text-slate-600">
                    التخصص: <strong>{lead.requestedSpecialtyAr}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-emerald-700 font-bold">
                      ✓ تم الرد خلال {lead.replyMinutes} دقيقة (&lt; ساعتين)
                    </span>
                    {lead.convertedToLedger && (
                      <span className="bg-captenly-tint text-captenly-olive font-extrabold px-2 py-0.5 rounded">
                        تحول لدفتر حصص نشط ✓
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PAYMOB B2B SUBSCRIPTION & PREPAID LEADS SANDBOX (Phase 2A - Month 7) */}
          <div className="bg-captenly-slate text-white rounded-3xl p-6 border-2 border-captenly-volt shadow-xl space-y-4">
            <div className="space-y-1 border-b border-white/10 pb-3">
              <span className="bg-captenly-volt text-captenly-slate text-xs font-black px-3 py-0.5 rounded-full">
                محاكي الترقية المدفوعة (الشهر السابع — المرحلة 2A عبر Paymob)
              </span>
              <h3 className="text-lg font-black pt-1">
                خيارات اشتراك المنشأة بعد انتهاء الـ 6 شهور المجانية
              </h3>
              <p className="text-xs text-slate-300">
                في كابتنلي، المنشأة تختار بحرية بين الاشتراك الشهري الثابت أو الدفع بالعميل المؤهل (Prepaid Verified Leads):
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div
                onClick={() => setSelectedPlan("facility_pro")}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition ${
                  selectedPlan === "facility_pro"
                    ? "bg-captenly-carbon border-captenly-volt"
                    : "bg-white/5 border-white/15"
                }`}
              >
                <div className="flex items-center justify-between font-black text-sm">
                  <span className="text-captenly-volt">
                    1. باقة كابتنلي برو للمنشآت (Facility Pro SaaS)
                  </span>
                  <span className="font-inter text-lg text-white">900 ج.م / شهر</span>
                </div>
                <p className="text-slate-300 mt-1 text-[11px]">
                  تعادل اشتراك متدرب واحد فقط! تفتح دفاتر حصص غير محدودة، تقارير رادار الطلب المحلي، وأولوية الظهور الموثق.
                </p>
              </div>

              <div
                onClick={() => setSelectedPlan("prepaid_leads")}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition ${
                  selectedPlan === "prepaid_leads"
                    ? "bg-captenly-carbon border-captenly-volt"
                    : "bg-white/5 border-white/15"
                }`}
              >
                <div className="flex items-center justify-between font-black text-sm">
                  <span className="text-captenly-volt">
                    2. باقة رصيد الليدز المسبقة الدفع (Prepaid Verified Leads)
                  </span>
                  <span className="font-inter text-lg text-white">400 ج.م / 10 عملاء</span>
                </div>
                <p className="text-slate-300 mt-1 text-[11px]">
                  خيار مرن للمنشآت الصغيرة (40 ج.م لكل عميل مؤهل فريد غير مكرر خلال 30 يوماً مع ضمان استرداد 14 يوماً).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPaymobPaidSuccess(true)}
              className="w-full bg-captenly-volt hover:brightness-105 text-captenly-slate font-black text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-volt transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                محاكاة الدفع عبر بوابة Paymob المرخصة وإصدار الفاتورة الإلكترونية
              </span>
            </button>

            {paymobPaidSuccess && (
              <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 p-3.5 rounded-2xl text-xs font-bold space-y-1">
                <div className="flex items-center gap-1.5 text-white">
                  <CheckCircle2 className="w-4 h-4 text-captenly-volt" />
                  <span>تمت محاكاة عملية الدفع بنجاح (Paymob Sandbox)!</span>
                </div>
                <div className="text-[11px]">
                  استقطاع البوابة 3.56% فقط (هامش مساهمة صافي 84.44% = 760 ج.م للمنصة وفق النموذج المالي الشيت 07).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
