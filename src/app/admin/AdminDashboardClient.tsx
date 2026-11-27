"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import {
  ShieldCheck,
  Award,
  PlusCircle,
  BarChart3,
  FlaskConical,
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
    reviewEntityBadge,
    checkInSession,
    validateAndSaveCoachBio,
    switchPersona,
    allPersonas,
    roleClaims,
    refreshRoleClaims,
    reviewRoleClaim,
  } = useCaptenly();

  const [activeAdminTab, setActiveAdminTab] = useState<
    "simulation_lab" | "concierge_seed" | "badges_queue" | "role_claims" | "gates_kpis"
  >("simulation_lab");
  const [claimFilter, setClaimFilter] = useState<
    "all" | "pending_review" | "approved" | "rejected"
  >("pending_review");
  const [reviewNotesById, setReviewNotesById] = useState<Record<string, string>>({});
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null);
  const [claimActionFeedback, setClaimActionFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // 12-Step Concierge Pre-Builder State
  const [seedName, setSeedName] = useState(
    "أكاديمية النخبة للسباحة — نادي بلدية المحلة"
  );
  const [seedCity, setSeedCity] = useState("");
  const [adminStatus, setAdminStatus] = useState<{
    loading: boolean;
    configured: boolean;
    authorized: boolean;
    reason?: string;
  }>({ loading: true, configured: false, authorized: false });
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthBusy, setAdminAuthBusy] = useState(false);

  const [demandRadarRows, setDemandRadarRows] = useState<
    Array<{
      id: string;
      fullNameAr: string;
      phone: string;
      city: string;
      governorate: string;
      targetSport: string;
      targetFacilityId: string | null;
      targetFacilityNameAr: string | null;
      createdAt: string | null;
    }>
  >([]);
  const [demandRadarLoading, setDemandRadarLoading] = useState(false);
  const [demandRadarError, setDemandRadarError] = useState<string | null>(null);

  const loadDemandRadar = async () => {
    setDemandRadarLoading(true);
    setDemandRadarError(null);
    try {
      const res = await fetch("/api/supabase/demand-radar", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        items?: typeof demandRadarRows;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        setDemandRadarError(
          res.status === 401 || res.status === 403
            ? "صلاحية الإدارة مطلوبة لعرض طلبات رادار الطلب."
            : "تعذر تحميل بيانات رادار الطلب حالياً."
        );
        return;
      }
      setDemandRadarRows(data.items);
    } catch {
      setDemandRadarError("تعذر الاتصال بالخادم لجلب طلبات رادار الطلب.");
    } finally {
      setDemandRadarLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/auth/admin-verify", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { configured?: boolean; authorized?: boolean; reason?: string }) => {
        if (!active) return;
        const authOk = Boolean(data.authorized);
        setAdminStatus({
          loading: false,
          configured: Boolean(data.configured),
          authorized: authOk,
          reason: data.reason,
        });
        if (authOk) {
          refreshRoleClaims(true).catch(() => undefined);
          loadDemandRadar().catch(() => undefined);
        }
      })
      .catch(() => {
        if (!active) return;
        setAdminStatus({ loading: false, configured: false, authorized: false });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdminKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKeyInput.trim()) return;
    setAdminAuthBusy(true);
    setAdminAuthError(null);
    try {
      const res = await fetch("/api/auth/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKeyInput.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        configured?: boolean;
        authorized?: boolean;
        messageAr?: string;
      };
      if (!res.ok || !data.authorized) {
        setAdminAuthError(data.messageAr || "تعذر التحقق من صلاحية الإدارة.");
        return;
      }
      setAdminStatus({
        loading: false,
        configured: Boolean(data.configured),
        authorized: true,
      });
      setAdminKeyInput("");
      await refreshRoleClaims(true).catch(() => undefined);
      await loadDemandRadar().catch(() => undefined);
    } catch {
      setAdminAuthError("تعذر الاتصال بخادم التحقق من صلاحية الإدارة.");
    } finally {
      setAdminAuthBusy(false);
    }
  };
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

  // Live Badge Queue derived from coaches & facilities documents pending review or expired
  const badgeQueueItems = useMemo(() => {
    const coachRows = coaches.flatMap((c) =>
      (c.badges || [])
        .filter((b) => b.status === "pending" || b.status === "expiring_soon" || b.status === "expired")
        .map((b) => ({
          id: `coach::${c.id}::${b.code}`,
          kind: "coach" as const,
          entityId: c.id,
          badgeCode: b.code,
          coachName: `${c.fullNameAr} (${c.SingleCoachId || c.id})`,
          badgeTitle: b.titleAr,
          submittedAgo: b.verifiedDate || "بانتظار مراجعة الإدارة",
          docRef: b.documentRef || "وثيقة مرفوعة عبر المنصة",
          status: b.status === "expired" ? ("suspended" as const) : ("pending" as const),
        }))
    );

    const facilityRows = facilities.flatMap((f) =>
      (f.badges || [])
        .filter((b) => b.status === "pending" || b.status === "expiring_soon" || b.status === "expired")
        .map((b) => ({
          id: `facility::${f.id}::${b.code}`,
          kind: "facility" as const,
          entityId: f.id,
          badgeCode: b.code,
          coachName: `${f.nameAr} (${f.city})`,
          badgeTitle: b.titleAr,
          submittedAgo: b.verifiedDate || "بانتظار مراجعة الإدارة",
          docRef: b.documentRef || "سجل / مستند المنشأة",
          status: b.status === "expired" ? ("suspended" as const) : ("pending" as const),
        }))
    );

    return [...coachRows, ...facilityRows];
  }, [coaches, facilities]);

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

  const handleApproveBadgeReq = (item: (typeof badgeQueueItems)[number]) => {
    reviewEntityBadge(item.kind, item.entityId, item.badgeCode, "active");
    setSimResultText(`✓ تم اعتماد «${item.badgeTitle}» لـ ${item.coachName} ومزامنتها.`);
  };

  if (adminStatus.loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center" dir="rtl">
        <div className="rounded-[24px] bg-surface-card border border-surface-container p-8 shadow-sm">
          <div className="w-8 h-8 rounded-full border-2 border-deep-olive border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-dark-slate">جاري التحقق من صلاحيات لوحة الإدارة...</p>
        </div>
      </div>
    );
  }

  if (!adminStatus.authorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14" dir="rtl">
        <div className="rounded-[24px] bg-surface-card border border-surface-container p-7 sm:p-8 shadow-sm space-y-5">
          <div className="space-y-1.5 text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-dark-slate text-electric-volt text-xs font-extrabold">
              منطقة الإدارة المحمية
            </span>
            <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-dark-slate">
              لوحة تحكم المؤسس وإدارة كابتنلي
            </h1>
            <p className="text-xs text-text-muted leading-relaxed">
              تتطلب هذه الصفحة تحققاً صريحاً عبر حساب بريد معتمد في <code>CAPTENLY_ADMIN_EMAILS</code> أو مفتاح الإدارة <code>CAPTENLY_ADMIN_KEY</code>.
            </p>
          </div>

          {!adminStatus.configured ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 font-semibold leading-relaxed">
              لم يتم إعداد متغير البيئة <code>CAPTENLY_ADMIN_KEY</code> أو <code>CAPTENLY_ADMIN_EMAILS</code> على الخادم بعد. أضف أحدهما في إعدادات الاستضافة/<code>.env.local</code> لتفعيل الدخول الآمن.
            </div>
          ) : (
            <form onSubmit={handleAdminKeySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-dark-slate mb-1.5">
                  مفتاح الإدارة السري (CAPTENLY_ADMIN_KEY)
                </label>
                <input
                  type="password"
                  required
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="أدخل مفتاح الإدارة..."
                  className="w-full rounded-xl bg-surface-snow border border-surface-container px-4 py-3 text-sm outline-none focus:border-deep-olive"
                />
              </div>

              {adminAuthError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-700">
                  {adminAuthError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminAuthBusy}
                className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs sm:text-sm hover:opacity-95 disabled:opacity-60"
              >
                {adminAuthBusy ? "جاري التحقق..." : "دخول لوحة الإدارة ✓"}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link href="/" className="text-xs font-bold text-deep-olive hover:underline">
              ← العودة إلى الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Founder Super Admin Header */}
      <div className="bg-dark-slate text-white rounded-3xl p-6 sm:p-8 border-2 border-electric-volt shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-electric-volt text-dark-slate text-xs font-black px-3 py-0.5 rounded-full">
              🛡️ لوحة تحكم المؤسس والأدمن (Founder Command Center & Simulation Lab)
            </span>
            <h1 className="text-2xl sm:text-3xl font-black pt-1">
              مركز قيادة كابتنلي (CAPTENLY) ومعمل اختبار العمليات
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              هنا تقدر تختبر كل تفاعلات المنصة، تجهز صفحات الأكاديميات قبل الزيارة الميدانية (12-Step Concierge)، تراجع الشارات الست، وتتابع بوابات الجاهزية الست للشهر السادس.
            </p>
          </div>

          <div className="bg-deep-carbon border border-white/15 px-4 py-3 rounded-2xl text-xs space-y-1">
            <div className="text-electric-volt font-black">
              وضع التشغيل والرقابة الإدارية:
            </div>
            <div className="font-inter font-extrabold text-white">
              {facilities.length} منشآت | {coaches.length} كباتن | {sessionLedgers.length} دفاتر نشطة
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
              id: "role_claims",
              label: `🛡️ طلبات اعتماد الأدوار (كابتن / منشأة)${
                roleClaims.filter((c) => c.status === "pending_review").length > 0
                  ? ` (${roleClaims.filter((c) => c.status === "pending_review").length})`
                  : ""
              }`,
              icon: Users,
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
                      | "role_claims"
                      | "gates_kpis"
                  )
                }
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition ${
                  activeAdminTab === tab.id
                    ? "bg-electric-volt text-dark-slate shadow-md"
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
          <div className="bg-white rounded-3xl p-6 border-2 border-deep-olive shadow-sm space-y-4">
            <h2 className="text-xl font-black text-dark-slate flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-deep-olive" />
              <span>
                معمل المحاكاة التفاعلي: اختبر أهم 4 سيناريوهات في المنصة بضغطة زر
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              صممنا لك المعمل ده عشان تختبر العمليات المشتركة بين (ولي الأمر + الكابتن + المنشأة) وتشوف النتيجة قدام عينك فوراً:
            </p>

            {simResultText && (
              <div className="bg-dark-slate text-electric-volt p-4 rounded-2xl text-xs sm:text-sm font-bold border-2 border-electric-volt shadow-lg">
                ⚡ نتيجة المحاكاة اللحظية: {simResultText}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Scenario 1: Offline Poolside PIN Check-in */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-dark-slate text-electric-volt px-2.5 py-1 rounded-lg">
                    سيناريو 1 • MVP-09 (PWA أوفلاين)
                  </span>
                  <WifiOff className="w-5 h-5 text-deep-olive" />
                </div>
                <h3 className="font-black text-base text-dark-slate">
                  اختبار ختم الحصة #7 أوفلاين وتفعيل تنبيه التجديد
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يبصم الحصة رقم 7 في دفتر السباح «يوسف طارق» بكود PIN (4829) عبر نظام الحفظ المحلي (Offline Queue)، ويطلق تنبيه التجديد الذكي عند تبقي حصتين أو أقل.
                </p>
                <button
                  onClick={() => {
                    const targetLedger = sessionLedgers[0];
                    if (!targetLedger) {
                      setSimResultText(
                        "لا توجد دفاتر حصص نشطة حالياً للمحاكاة — أنشئ دفتراً من لوحة المنشأة أو الكابتن أولاً."
                      );
                      return;
                    }
                    const res = checkInSession(
                      targetLedger.id,
                      targetLedger.pinCode,
                      "offline_sync",
                      "تسجيل حصة في طابور المزامنة التلقائي"
                    );
                    setSimResultText(res.messageAr);
                  }}
                  className="w-full bg-dark-slate hover:bg-deep-carbon text-electric-volt font-black text-xs py-3 rounded-xl transition"
                >
                  اختبار ختم حصة في طابور المزامنة ←
                </button>
              </div>

              {/* Scenario 2: Public Data Refresh Simulation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-dark-slate text-electric-volt px-2.5 py-1 rounded-lg">
                    سيناريو 2 • تحديث بيانات المنشآت
                  </span>
                  <Clock className="w-5 h-5 text-deep-olive" />
                </div>
                <h3 className="font-black text-base text-dark-slate">
                  محاكاة أولوية المنشآت المحدثة مؤخراً في الدليل
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يختبر إعادة ترتيب وتنشيط تحديث بيانات منشأة مفعّلة في خوارزمية الظهور بالدليل.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const targetFac = facilities[0];
                      setSimResultText(
                        targetFac
                          ? `النظام يعرض المنشأة «${targetFac.nameAr}» (${targetFac.city}) بنظام الباقات الموحد (${targetFac.pricePackages.length} باقة / ${targetFac.schoolPrograms?.length || 0} مدرسة).`
                          : "لا توجد منشآت في القائمة حالياً."
                      );
                    }}
                    className="flex-1 bg-red-700 hover:bg-red-800 text-white font-black text-xs py-3 rounded-xl transition"
                  >
                    محاكاة تأخر التحديث
                  </button>
                  <button
                    onClick={() => {
                      const targetFac = facilities[0];
                      setSimResultText(
                        targetFac
                          ? `تم تنشيط فهرس المنشأة «${targetFac.nameAr}» (${targetFac.city}) بنجاح.`
                          : "لا توجد منشآت في القائمة حالياً."
                      );
                    }}
                    className="bg-emerald-700 text-white font-black text-xs px-3 py-3 rounded-xl"
                  >
                    تنشيط التحديث ✓
                  </button>
                </div>
              </div>

              {/* Scenario 3: Sports Training Scope Validation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-dark-slate text-electric-volt px-2.5 py-1 rounded-lg">
                    سيناريو 3 • التوثيق والالتزام المهني
                  </span>
                  <FileWarning className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-black text-base text-dark-slate">
                  مراجعة نطاق السير المهنية لمدربي السباحة
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تتحقق المنصة تلقائياً من مطابقة بيانات المدربين لنطاق التدريب الرياضي والإنقاذ المائي فقط قبل النشر.
                </p>
                <button
                  onClick={() => {
                    const targetCoach = coaches[0];
                    if (!targetCoach) {
                      setSimResultText("لا يوجد مدربون مسجلون للمحاكاة حالياً.");
                      return;
                    }
                    const res = validateAndSaveCoachBio(
                      targetCoach.id,
                      "مدرب سباحة وتأسيس أطفال وإنقاذ مائي معتمد من الاتحاد المصري للسباحة."
                    );
                    setSimResultText(res.messageAr);
                  }}
                  className="w-full bg-dark-slate hover:bg-deep-carbon text-electric-volt font-black text-xs py-3 rounded-xl transition"
                >
                  تحقق من سلامة ملف التدريب ←
                </button>
              </div>

              {/* Scenario 4: Role Switching Matrix */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black bg-dark-slate text-electric-volt px-2.5 py-1 rounded-lg">
                    سيناريو 4 • التبديل بين الحسابات ({allPersonas.length})
                  </span>
                  <Users className="w-5 h-5 text-deep-olive" />
                </div>
                <h3 className="font-black text-base text-dark-slate">
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
                      className="bg-white hover:bg-lime-tint border border-slate-300 text-dark-slate font-extrabold text-[11px] py-2 px-2.5 rounded-xl text-right truncate transition"
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
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-5">
          <div>
            <span className="text-xs font-extrabold text-deep-olive bg-lime-tint px-3 py-0.5 rounded-full">
              القسم 05 من استراتيجية النمو • قاعدة «ابنِ الصفحة أولاً ثم اعرضها جاهزة» (يرفع القبول إلى &gt; 70%)
            </span>
            <h2 className="text-xl font-black text-dark-slate mt-1">
              أداة البذر الميداني السريع (تجهيز صفحة مسودة لمنشأة قبل زيارتها)
            </h2>
            <p className="text-xs text-slate-600">
              جهّز صفحة الأكاديمية في دقيقتين قبل النزول الميداني في مدن مصر، ثم افتحها على موبايلك أمام المدير ليسلمك الأسعار ويستلم إدارتها فوراً.
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
                required
                value={seedCity}
                onChange={(e) => setSeedCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold"
              >
                <option value="">-- اختر المدينة / المحافظة --</option>
                {EGYPT_CITY_PRESETS.map((preset) => (
                  <option key={preset.city} value={preset.city}>
                    {preset.city} ({preset.governorate})
                  </option>
                ))}
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
                  className="accent-deep-olive"
                />
                <span>🔥 مسبح مدفأ شتاءً</span>
              </label>
              <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedLadies}
                  onChange={(e) => setSeedLadies(e.target.checked)}
                  className="accent-deep-olive"
                />
                <span>👩 مواعيد سيدات مستقلة</span>
              </label>

              <button
                type="submit"
                className="ms-auto bg-dark-slate hover:bg-deep-carbon text-electric-volt font-black text-xs px-6 py-3 rounded-xl shadow-lg transition"
              >
                + إنشاء الصفحة المسودة وتوليد رابط الاستلام الميداني
              </button>
            </div>
          </form>

          {seededSuccessSlug && (
            <div className="bg-lime-tint border-2 border-deep-olive p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
              <span className="text-dark-slate">
                ✓ تم إنشاء الصفحة المسودة بنجاح! يمكنك فتحها الآن أمام مدير المنشأة وتجربة زر «استلم إدارة المنشأة مجاناً».
              </span>
              <Link
                href={`/academy/${seededSuccessSlug}`}
                className="bg-dark-slate text-electric-volt font-black px-4 py-2 rounded-xl"
              >
                افتح الصفحة المسودة الجديدة ↗
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 6 INDEPENDENT BADGES VERIFICATION QUEUE & 12H EMERGENCY SLA */}
      {activeAdminTab === "badges_queue" && (
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-dark-slate">
                طابور فحص وثائق الشارات الست المستقلة (SLA 24–48h) وبروتوكول طوارئ الـ 12 ساعة
              </h2>
              <p className="text-xs text-slate-600">
                كل مستند مرفوع محفوظ داخل حاوية خاصة مقفولة (Private Storage Bucket)؛ لا تُمنح الشارة إلا بعد فحصك البصري لتاريخ الصلاحية.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {badgeQueueItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                لا توجد وثائق أو شارات قيد الانتظار حالياً — جميع حسابات المدربين والمنشآت المسجلة مراجَعة.
              </div>
            ) : (
              badgeQueueItems.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-4 text-xs ${
                    req.status === "suspended"
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-black text-sm text-dark-slate">
                      {req.coachName}
                    </div>
                    <div className="font-bold text-deep-olive">{req.badgeTitle}</div>
                    <div className="text-slate-500">
                      المرجع: {req.docRef} • {req.submittedAgo}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {req.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApproveBadgeReq(req)}
                          className="bg-dark-slate text-electric-volt font-black px-4 py-2.5 rounded-xl"
                        >
                          اعتماد الوثيقة ومنح الشارة ✓
                        </button>
                        <button
                          onClick={() => {
                            reviewEntityBadge(req.kind, req.entityId, req.badgeCode, "expired");
                            setSimResultText(`تم رفض/تعليق «${req.badgeTitle}» لـ ${req.coachName}.`);
                          }}
                          className="bg-red-50 text-red-700 border border-red-200 font-black px-3.5 py-2.5 rounded-xl"
                        >
                          رفض / إيقاف
                        </button>
                      </>
                    )}
                    {req.status === "suspended" && (
                      <>
                        <span className="inline-flex items-center gap-1 font-black text-red-900 bg-red-200 px-3 py-1.5 rounded-xl">
                          <AlertTriangle className="w-4 h-4" />
                          موقوف / منتهي الصلاحية
                        </span>
                        <button
                          onClick={() => handleApproveBadgeReq(req)}
                          className="bg-dark-slate text-electric-volt font-black px-3.5 py-2 rounded-xl"
                        >
                          إعادة التفعيل ✓
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3B: ADMIN ROLE CLAIMS QUEUE (COACH / FACILITY VERIFICATION) */}
      {activeAdminTab === "role_claims" && (
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-dark-slate flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-deep-olive" />
                <span>طابور طلبات اعتماد الأدوار (كابتن / إدارة منشأة)</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                لا يحصل أي متقدم على صلاحية الكابتن أو إدارة المنشأة إلا بعد مراجعة المستندات وفحص قانون 3 لسنة 1985 من هنا.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["pending_review", "approved", "rejected", "all"] as const).map((flt) => (
                <button
                  key={flt}
                  type="button"
                  onClick={() => setClaimFilter(flt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    claimFilter === flt
                      ? "bg-dark-slate text-electric-volt"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {flt === "pending_review"
                    ? "قيد المراجعة"
                    : flt === "approved"
                    ? "معتمد"
                    : flt === "rejected"
                    ? "مرفوض"
                    : "الكل"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => refreshRoleClaims(true)}
                className="px-3.5 py-1.5 rounded-full bg-lime-tint text-deep-olive text-xs font-extrabold"
              >
                تحديث الطابور ↻
              </button>
            </div>
          </div>

          {claimActionFeedback && (
            <div
              className={`rounded-2xl p-3.5 text-xs font-bold border ${
                claimActionFeedback.ok
                  ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {claimActionFeedback.msg}
            </div>
          )}

          <div className="space-y-4">
            {roleClaims
              .filter((c) => claimFilter === "all" || c.status === claimFilter)
              .map((claim) => {
                const payload = (claim.proposedPayload || {}) as Record<string, unknown>;
                const bio = typeof payload.bioAr === "string" ? payload.bioAr : "";
                const syndicateRef =
                  typeof payload.syndicateCardRef === "string" ? payload.syndicateCardRef : "";
                const commercialRef =
                  typeof payload.commercialRegRef === "string" ? payload.commercialRegRef : "";
                const noteVal = reviewNotesById[claim.id] || "";
                const isBusy = claimBusyId === claim.id;

                return (
                  <div
                    key={claim.id}
                    className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-dark-slate text-electric-volt font-extrabold">
                            {claim.claimType === "facility" ? "إدارة منشأة" : "كابتن سباحة"}
                          </span>
                          <span className="font-black text-base text-dark-slate">
                            {claim.applicantNameAr}
                          </span>
                          <span className="font-mono font-bold text-deep-olive">
                            ({claim.applicantMemberCode})
                          </span>
                        </div>
                        <div className="text-slate-600 flex flex-wrap gap-3">
                          <span>الهاتف: {claim.applicantPhone || "غير متاح"}</span>
                          {claim.applicantEmail && <span>البريد: {claim.applicantEmail}</span>}
                          <span>المدينة: {claim.cityAr || "غير محددة"}</span>
                          {claim.targetFacilityNameAr && (
                            <span className="font-bold text-dark-slate">
                              المنشأة: {claim.targetFacilityNameAr}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full font-extrabold ${
                          claim.status === "approved"
                            ? "bg-lime-tint text-deep-olive"
                            : claim.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : claim.status === "withdrawn"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {claim.status === "approved"
                          ? "معتمد ✓"
                          : claim.status === "rejected"
                          ? "مرفوض ✕"
                          : claim.status === "withdrawn"
                          ? "مسحوب"
                          : "قيد المراجعة ⏳"}
                      </span>
                    </div>

                    {(syndicateRef || commercialRef || claim.proofNotesAr) && (
                      <div className="bg-white rounded-xl p-3 border border-slate-200 text-slate-700 space-y-1">
                        {syndicateRef && <div>رقم كارنيه النقابة/الشهادة: {syndicateRef}</div>}
                        {commercialRef && <div>مرجع السجل/التفويض: {commercialRef}</div>}
                        {claim.proofNotesAr && <div>ملاحظات المتقدم: {claim.proofNotesAr}</div>}
                      </div>
                    )}

                    {bio && (
                      <div className="bg-white rounded-xl p-3 border border-slate-200 text-slate-700">
                        <div className="font-bold text-deep-olive mb-1">
                          السيرة المهنية (مفحوصة بقانون 3 لسنة 1985 ✓):
                        </div>
                        <p className="leading-relaxed">{bio}</p>
                      </div>
                    )}

                    {claim.proofDocumentUrl && (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-dark-slate">المستند المرفق:</span>
                        {claim.proofDocumentUrl.startsWith("data:image/") ? (
                          <img
                            src={claim.proofDocumentUrl}
                            alt={`مستند ${claim.applicantNameAr}`}
                            className="max-h-48 w-auto object-contain rounded-xl border border-slate-300 self-start bg-white p-1"
                          />
                        ) : (
                          <a
                            href={claim.proofDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-deep-olive font-bold underline w-fit"
                          >
                            فتح رابط المستند المرفق ↗
                          </a>
                        )}
                      </div>
                    )}

                    {claim.reviewerNoteAr && (
                      <div className="text-slate-600 font-bold">
                        ملاحظة المراجع السابقة: {claim.reviewerNoteAr}
                      </div>
                    )}

                    {claim.status === "pending_review" && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-200">
                        <input
                          value={noteVal}
                          onChange={(e) =>
                            setReviewNotesById((prev) => ({ ...prev, [claim.id]: e.target.value }))
                          }
                          placeholder="ملاحظة للمتقدم (اختياري للموافقة / سبب الرفض)..."
                          className="flex-1 rounded-xl bg-white border border-slate-300 px-3.5 py-2 outline-none"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setClaimBusyId(claim.id);
                            setClaimActionFeedback(null);
                            const res = await reviewRoleClaim(
                              claim.id,
                              "approve",
                              noteVal.trim() || undefined
                            );
                            setClaimActionFeedback({ ok: res.ok, msg: res.messageAr });
                            setClaimBusyId(null);
                          }}
                          className="bg-dark-slate text-electric-volt font-black px-4 py-2.5 rounded-xl disabled:opacity-50"
                        >
                          {isBusy ? "جاري التنفيذ..." : "اعتماد وتفعيل الدور ✓"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setClaimBusyId(claim.id);
                            setClaimActionFeedback(null);
                            const res = await reviewRoleClaim(
                              claim.id,
                              "reject",
                              noteVal.trim() || "يرجى استيفاء صورة كارنيه أو تفويض واضح وإعادة الإرسال."
                            );
                            setClaimActionFeedback({ ok: res.ok, msg: res.messageAr });
                            setClaimBusyId(null);
                          }}
                          className="bg-red-50 text-red-700 border border-red-200 font-black px-4 py-2.5 rounded-xl disabled:opacity-50"
                        >
                          رفض الطلب ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {roleClaims.filter((c) => claimFilter === "all" || c.status === claimFilter).length === 0 && (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                لا توجد طلبات توثيق في هذا التصنيف حالياً.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: THE 6 MANDATORY MONTH-6 STAGE GATES & 16 GROWTH KPIS */}
      {activeAdminTab === "gates_kpis" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-dark-slate">
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
                  target: "تأسيس الكيان القانوني والضريبي + إيداع علامة CAPTENLY + تفعيل بوابة الدفع الإلكتروني",
                  status: "مجدول وفق خطة الإطلاق التشغيلية",
                },
                {
                  gate: "البوابة 6: حوكمة التشغيل الميداني والموثوقية",
                  target: "اكتمال توثيق الشارات الست، ومزامنة دفتر الحصص أوفلاين بدون أخطاء",
                  status: `نشط بالمحاكي: ${verifiedLeads.length} طلب تواصل | ${roleClaims.filter((c) => c.status === "pending_review").length} طلب توثيق`,
                },
              ].map((g) => (
                <div
                  key={g.gate}
                  className="bg-surface-snow border border-deep-olive/30 rounded-2xl p-4 space-y-1.5"
                >
                  <div className="font-black text-sm text-dark-slate">{g.gate}</div>
                  <p className="text-slate-600 leading-relaxed">{g.target}</p>
                  <div className="text-[11px] font-extrabold text-deep-olive pt-1">
                    الحالة: {g.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-dark-slate">
                  رادار الطلب والتوسع الميداني ({demandRadarRows.length})
                </h3>
                <p className="text-xs text-slate-600">
                  الطلبات المسجلة فعلياً من قاعدة البيانات (captenly_demand_radar) — متاحة للإدارة فقط.
                </p>
              </div>
              <button
                type="button"
                disabled={demandRadarLoading}
                onClick={loadDemandRadar}
                className="px-3.5 py-1.5 rounded-full bg-lime-tint text-deep-olive text-xs font-extrabold disabled:opacity-60"
              >
                {demandRadarLoading ? "جاري التحديث..." : "تحديث الطلبات ↻"}
              </button>
            </div>

            {demandRadarError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-800">
                {demandRadarError}
              </div>
            )}

            {demandRadarLoading && demandRadarRows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                جاري تحميل طلبات رادار الطلب...
              </div>
            ) : demandRadarRows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-600">
                لا توجد طلبات مسجلة في رادار الطلب حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-500">
                      <th className="pb-2.5 pr-2">مقدم الطلب</th>
                      <th className="pb-2.5">التواصل / الكود</th>
                      <th className="pb-2.5">المدينة / المحافظة</th>
                      <th className="pb-2.5">الرياضة</th>
                      <th className="pb-2.5">المنشأة المستهدفة</th>
                      <th className="pb-2.5 pl-2">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demandRadarRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2 font-bold text-dark-slate">{row.fullNameAr}</td>
                        <td className="py-2.5 font-mono text-slate-700" dir="ltr">
                          {row.phone}
                        </td>
                        <td className="py-2.5 text-slate-700">
                          {row.city} ({row.governorate})
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {row.targetSport}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-700">
                          {row.targetFacilityNameAr || "توسع مدينة"}
                        </td>
                        <td className="py-2.5 pl-2 font-mono text-[11px] text-slate-500">
                          {row.createdAt ? row.createdAt.slice(0, 10) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
