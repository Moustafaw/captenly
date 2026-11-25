"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { getFacilityPoolDeskConfig } from "@/lib/poolDeskPricing";
import type {
  AcademyAgreementType,
  Facility,
  FacilityLinkedEntity,
} from "@/types/captenly";

interface CoachHostLinksPanelProps {
  facilities: Facility[];
  facilityLinks: FacilityLinkedEntity[];
  coachId: string;
  coachMemberCode?: string;
  coachNameAr: string;
  compact?: boolean;
  onRequestHostLink: (payload: {
    facilityId: string;
    facilityNameAr: string;
    entityKind?: "academy" | "coach";
    displayNameAr?: string;
    agreementType?: AcademyAgreementType;
    fixedMonthlyAmountEgp?: number;
    groupLabelAr?: string;
    swimmersCountEstimate?: number;
  }) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;
  onFeedback: (msg: { ok: boolean; msg: string }) => void;
}

/**
 * Bilateral Host-Club Linking & Delegated QR Governance Panel for Coaches / Standalone Academies.
 * Preserves safe-default gate control while letting coaches view approved host agreements and request links.
 */
export function CoachHostLinksPanel({
  facilities,
  facilityLinks,
  coachId,
  coachMemberCode,
  coachNameAr,
  compact = false,
  onRequestHostLink,
  onFeedback,
}: CoachHostLinksPanelProps) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [targetFacilityId, setTargetFacilityId] = useState(facilities[0]?.id || "");
  const [entityKind, setEntityKind] = useState<"academy" | "coach">("academy");
  const [displayNameAr, setDisplayNameAr] = useState(coachNameAr);
  const [groupLabelAr, setGroupLabelAr] = useState("");
  const [agreementType, setAgreementType] =
    useState<AcademyAgreementType>("per_swimmer_water");
  const [fixedMonthlyAmountEgp, setFixedMonthlyAmountEgp] = useState<number>(3000);
  const [swimmersCountEstimate, setSwimmersCountEstimate] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);

  // Merge links from dedicated context table + embedded facility poolDeskConfig
  const myLinks = useMemo(() => {
    const map = new Map<string, FacilityLinkedEntity>();
    const codeUpper = (coachMemberCode || "").trim().toUpperCase();

    const matchesMe = (link: FacilityLinkedEntity) => {
      if (link.linkedCoachId && link.linkedCoachId === coachId) return true;
      if (codeUpper && link.linkedMemberCode?.toUpperCase() === codeUpper) return true;
      if (coachNameAr && link.displayNameAr === coachNameAr) return true;
      return false;
    };

    facilityLinks.filter(matchesMe).forEach((l) => map.set(l.id, l));
    facilities.forEach((fac) => {
      getFacilityPoolDeskConfig(fac)
        .linkedEntities.filter(matchesMe)
        .forEach((l) => {
          if (!map.has(l.id)) {
            map.set(l.id, { ...l, facilityNameAr: l.facilityNameAr || fac.nameAr });
          }
        });
    });

    return Array.from(map.values());
  }, [facilities, facilityLinks, coachId, coachMemberCode, coachNameAr]);

  const approvedCount = myLinks.filter((l) => l.status === "approved").length;
  const delegatedScanCount = myLinks.filter(
    (l) => l.status === "approved" && l.canScanGroupQr
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenFacility = facilities.find((f) => f.id === targetFacilityId);
    if (!chosenFacility) {
      onFeedback({ ok: false, msg: "يرجى اختيار المنشأة أو النادي المضيف أولاً." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await onRequestHostLink({
        facilityId: chosenFacility.id,
        facilityNameAr: chosenFacility.nameAr,
        entityKind,
        displayNameAr: displayNameAr.trim() || coachNameAr,
        agreementType,
        fixedMonthlyAmountEgp:
          agreementType === "fixed_monthly" ? Math.max(0, Number(fixedMonthlyAmountEgp) || 0) : undefined,
        groupLabelAr: groupLabelAr.trim() || undefined,
        swimmersCountEstimate: Math.max(1, Number(swimmersCountEstimate) || 10),
      });
      onFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        setShowRequestForm(false);
        setGroupLabelAr("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className={`rounded-3xl bg-white border border-sand-border shadow-soft-luxury flex flex-col gap-4 ${
        compact ? "p-4" : "p-5 md:p-6"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[10px] font-black">
              <Icon name="hub" size={13} />
              الربط مع الأندية والمسابح المضيفة
            </span>
            {approvedCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">
                {approvedCount} ارتباط معتمد
              </span>
            )}
            {delegatedScanCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#0F4C5C] text-white text-[10px] font-black">
                مفوّض بمسح QR في {delegatedScanCount} نادٍ
              </span>
            )}
          </div>
          <h2 className="text-base md:text-lg font-black text-[#0F4C5C] mt-1">
            حالة الربط بالمسبح المضيف وصلاحية مسح الحصص
          </h2>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
            بمجرد موافقة المنشأة على ربط مجموعتك أو أكاديميتك، يظهر لك سجل حضور متدربيك هنا لحظياً
            عند مسح الكارت على بوابة المسبح — ويمكن لإدارة النادي تفويضك بمسح QR لمجموعتك من المسبح.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRequestForm((prev) => !prev)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] transition-all cursor-pointer shrink-0"
        >
          <Icon name={showRequestForm ? "close" : "add_link"} size={17} />
          <span>{showRequestForm ? "إغلاق الطلب" : "+ طلب ربط بنادٍ مضيف"}</span>
        </button>
      </div>

      {showRequestForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#F7F9FA] border border-[#1D6E7D]/30 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                النادي / المسبح المضيف *
              </label>
              <select
                value={targetFacilityId}
                onChange={(e) => setTargetFacilityId(e.target.value)}
                className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nameAr} — {f.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                صفة العمل داخل النادي
              </label>
              <select
                value={entityKind}
                onChange={(e) => setEntityKind(e.target.value as "academy" | "coach")}
                className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="academy">أكاديمية مستأجرة / مجموعة تدريب</option>
                <option value="coach">كابتن خاص / مدرب متعاقد</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                الاسم الظاهر في لوحة النادي *
              </label>
              <input
                type="text"
                required
                value={displayNameAr}
                onChange={(e) => setDisplayNameAr(e.target.value)}
                placeholder="اسم الأكاديمية أو الكابتن"
                className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                اسم المجموعة / المرحلة (اختياري)
              </label>
              <input
                type="text"
                value={groupLabelAr}
                onChange={(e) => setGroupLabelAr(e.target.value)}
                placeholder="مثال: براعم 5م - تجهيزي بطولات"
                className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                نظام حساب المياه المقترح
              </label>
              <select
                value={agreementType}
                onChange={(e) => setAgreementType(e.target.value as AcademyAgreementType)}
                className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="per_swimmer_water">مقابل مية لكل سباح / حصة</option>
                <option value="fixed_monthly">اتفاق شهري ثابت للأكاديمية</option>
              </select>
            </div>

            {agreementType === "fixed_monthly" ? (
              <div>
                <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                  قيمة الاتفاق الشهري المقترحة (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  value={fixedMonthlyAmountEgp}
                  onChange={(e) => setFixedMonthlyAmountEgp(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-black tabular-nums"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-[#0F4C5C] mb-1">
                  العدد التقديري للسباحين
                </label>
                <input
                  type="number"
                  min={1}
                  value={swimmersCountEstimate}
                  onChange={(e) => setSwimmersCountEstimate(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-black tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer disabled:opacity-50"
            >
              {submitting ? "جاري إرسال الطلب..." : "إرسال طلب الربط لإدارة المنشأة ✓"}
            </button>
          </div>
        </form>
      )}

      {/* Current Host Links List */}
      {myLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-border bg-[#F7F9FA] p-4 text-center text-xs text-ink-muted">
          لا توجد ارتباطات بأندية مضيفة بعد. يمكنك العمل مباشرة في حصصك الخاصة أو إرسال طلب ربط لأي
          منشأة بالأعلى ليظهر متدربوك على نظام البوابة.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myLinks.map((link) => {
            const matchedFac = facilities.find((f) => f.id === link.facilityId);
            const facName = link.facilityNameAr || matchedFac?.nameAr || "منشأة مائية";
            const statusBadge =
              link.status === "approved"
                ? { label: "مرتبط ومعتمد ✓", cls: "bg-emerald-50 text-emerald-700" }
                : link.status === "pending"
                  ? { label: "⏳ بانتظار موافقة المنشأة", cls: "bg-amber-50 text-amber-800" }
                  : { label: "مرفوض", cls: "bg-rose-50 text-rose-700" };

            return (
              <div
                key={link.id}
                className="rounded-2xl border border-sand-border bg-[#F7F9FA] p-4 flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-sm text-[#0F4C5C]">{facName}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {link.displayNameAr}
                      {link.groupLabelAr ? ` • ${link.groupLabelAr}` : ""}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sand-border/70 text-[11px]">
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-sand-border text-ink-slate font-bold">
                    {link.agreementType === "fixed_monthly"
                      ? `اتفاق شهري (${link.fixedMonthlyAmountEgp ?? 0} ج.م)`
                      : "محاسبة المية بالحصة"}
                  </span>

                  {link.status === "approved" && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-black ${
                        link.canScanGroupQr
                          ? "bg-[#0F4C5C] text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Icon
                        name={link.canScanGroupQr ? "qr_code_scanner" : "lock"}
                        size={13}
                      />
                      {link.canScanGroupQr
                        ? "مفوّض بمسح QR مجموعتك بالمسبح"
                        : "المسح مقصور على بوابة النادي"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
