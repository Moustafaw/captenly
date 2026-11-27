"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { RoleAccessDeniedScreen } from "@/components/auth/RoleAccessDeniedScreen";
import { isMemberAccountRole } from "@/types/captenly";

export default function FamilySettingsPage() {
  const {
    isAuthenticated,
    currentPersona,
    minorAthletes,
    sessionLedgers,
    addMinorAthlete,
    updateMinorAthlete,
    removeMinorAthlete,
  } = useCaptenly();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(8);
  const [childGender, setChildGender] = useState<"male" | "female">("male");
  const [childSport, setChildSport] = useState<"swimming" | "fitness">("swimming");
  const [law151Consent, setLaw151Consent] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pendingDeleteChild, setPendingDeleteChild] = useState<{
    id: string;
    fullNameAr: string;
  } | null>(null);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="إدارة العائلة والأبناء"
        descriptionAr="سجّل دخولك بحساب السبّاح وولي الأمر لإضافة ومتابعة ملفات الأبناء وحماية خصوصيتهم."
      />
    );
  }

  if (!isMemberAccountRole(currentPersona.role)) {
    return (
      <RoleAccessDeniedScreen
        titleAr="متابعة الأبناء والأسرة خاصة بحساب السبّاح وولي الأمر"
        descriptionAr="هذه الصفحة مخصصة لحسابات السبّاحين وأولياء الأمور لإضافة ومتابعة ملفات الأبناء من نفس الحساب الموحد."
        fallbackHref={
          currentPersona.role === "facility_manager"
            ? "/dashboard/facility"
            : currentPersona.role === "coach"
            ? "/dashboard/coach"
            : "/dashboard/athlete"
        }
        fallbackLabelAr="العودة للوحة حسابك"
      />
    );
  }

  const openAddModal = () => {
    setEditingChildId(null);
    setChildName("");
    setChildAge(8);
    setChildGender("male");
    setChildSport("swimming");
    setLaw151Consent(true);
    setModalOpen(true);
  };

  const openEditModal = (child: (typeof minorAthletes)[number]) => {
    setEditingChildId(child.id);
    setChildName(child.fullNameAr);
    setChildAge(child.age);
    setChildGender(child.gender);
    setChildSport(child.primarySport);
    setLaw151Consent(true);
    setModalOpen(true);
  };

  const handleSaveChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !law151Consent) return;

    if (editingChildId) {
      updateMinorAthlete(editingChildId, {
        fullNameAr: childName.trim(),
        age: childAge,
        gender: childGender,
        primarySport: childSport,
      });
    } else {
      addMinorAthlete({
        fullNameAr: childName.trim(),
        age: childAge,
        gender: childGender,
        primarySport: childSport,
      });
    }

    setEditingChildId(null);
    setChildName("");
    setChildAge(8);
    setModalOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 pt-6 lg:pt-6 pb-12 flex flex-col gap-6" dir="rtl">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-micro-caption text-text-muted">
          <Link href="/dashboard/athlete/settings" className="hover:text-dark-slate transition-colors">
            الإعدادات
          </Link>
          <span>/</span>
          <span className="text-deep-olive font-bold">إدارة العائلة والأبناء</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-cairo font-bold text-section-title text-dark-slate">
              إدارة الأبناء والجواز الرياضي العائلي
            </h1>
            <p className="text-body-compact text-text-muted mt-0.5">
              ربط ملفات الأبناء بالمدربين والأكاديميات وحفظ السجلات المعتمدة
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-full bg-deep-olive text-white font-bold text-body-compact hover:brightness-105 transition-all shadow-sm flex items-center gap-1.5"
          >
            <Icon name="add" className="text-[18px]" />
            <span>إضافة ابن / بطل جديد</span>
          </button>
        </div>
      </div>

      {/* Law 151 Minor Protection Compliance Notice */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border-hairline shadow-xs flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
          <Icon name="shield" className="text-[20px]" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-card-title-sm text-dark-slate">
              حماية خصوصية بيانات الأطفال (قانون رقم 151 لسنة 2020)
            </span>
            <span className="text-deep-olive text-[11px] font-extrabold">
              حماية مشددة ✓
            </span>
          </div>
          <p className="text-micro-caption text-text-muted leading-relaxed">
            جميع ملفات وسجلات الأبناء الرياضية مضبوطة افتراضياً على وضع الخصوصية التامة (Private by Default). لا يمكن لأي مدرب أو منشأة الاطلاع على سجلات الابن أو إشراكه في الحصص دون موافقة إلكترونية صريحة وموثقة من ولي الأمر المسجل.
          </p>
        </div>
      </div>

      {/* Registered Children Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {minorAthletes.map((athlete) => {
          const activeLedger =
            sessionLedgers.find((l) => l.athleteId === athlete.id && l.status === "active") ||
            sessionLedgers.find((l) => l.athleteId === athlete.id);
          const childCode =
            athlete.childMemberCode ||
            `CAP-JR-${athlete.id.replace(/[^A-Z0-9]/gi, "").slice(-4).toUpperCase()}`;
          return (
          <div
            key={athlete.id}
            className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center font-bold text-card-title-sm">
                    {athlete.fullNameAr.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-card-title text-dark-slate">
                      {athlete.fullNameAr}
                    </h3>
                    <p className="text-micro-caption text-text-muted">
                      {athlete.age} سنوات • مواليد {athlete.birthYear}
                    </p>
                  </div>
                </div>

                <span className="text-deep-olive text-[11px] font-extrabold">
                  {athlete.currentStarLevel > 0 && athlete.starTitleAr
                    ? athlete.starTitleAr
                    : "حساب طفل محمي"}
                </span>
              </div>

              {/* Child Sub-Code Banner */}
              <div className="px-3 py-2 rounded-xl bg-lime-tint/60 border border-deep-olive/25 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-deep-olive">كود السباح الفرعي:</span>
                <div className="flex items-center gap-2">
                  <code dir="ltr" className="font-mono font-black text-dark-slate">
                    {childCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(childCode).catch(() => {});
                      setCopiedCode(childCode);
                      setTimeout(() => setCopiedCode(null), 1800);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-dark-slate text-electric-volt text-[10px] font-bold"
                  >
                    {copiedCode === childCode ? "تم النسخ ✓" : "نسخ"}
                  </button>
                </div>
              </div>

              {/* Status Tickers */}
              <div className="p-3 rounded-xl bg-surface-snow border border-border-hairline space-y-1.5 text-micro-caption">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">الأكاديمية النشطة:</span>
                  <span className="font-bold text-dark-slate">
                    {activeLedger?.facilityNameAr || athlete.activeFacilityNameAr || "غير مرتبط بعد"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">الكابتن المشرف:</span>
                  <span className="font-bold text-deep-olive">
                    {activeLedger?.coachNameAr || athlete.activeCoachNameAr || "متابعة ذاتية"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border-hairline">
                  <span className="text-text-muted">حالة موافقة ولي الأمر:</span>
                  <span className="font-bold text-status-success flex items-center gap-1">
                    <Icon name="check_circle" className="text-[14px]" />
                    <span>موثقة إلكترونياً</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border-hairline">
              <Link
                href="/dashboard/athlete"
                className="flex-1 py-2 rounded-xl bg-dark-slate text-electric-volt font-bold text-micro-caption text-center hover:bg-deep-carbon transition-colors"
              >
                دفتر الحصص والجواز
              </Link>
              <button
                type="button"
                onClick={() => openEditModal(athlete)}
                className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-dark-slate text-micro-caption font-bold transition-colors"
                title="تعديل البيانات"
              >
                تعديل
              </button>
              <button
                type="button"
                onClick={() =>
                  setPendingDeleteChild({ id: athlete.id, fullNameAr: athlete.fullNameAr })
                }
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-status-danger text-micro-caption font-bold transition-colors"
                title="حذف ملف الطفل"
              >
                حذف
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {pendingDeleteChild && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-child-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-carbon/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-surface-card border border-border-hairline shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-hairline pb-3">
              <h3 id="delete-child-modal-title" className="font-bold text-card-title text-dark-slate">
                تأكيد حذف ملف الابن
              </h3>
              <button
                type="button"
                onClick={() => setPendingDeleteChild(null)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full bg-surface-snow text-text-muted hover:text-dark-slate flex items-center justify-center"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              هل تريد بالتأكيد حذف ملف <strong className="text-dark-slate">{pendingDeleteChild.fullNameAr}</strong> من قائمة الأبناء؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteChild(null)}
                className="px-4 py-2 rounded-xl bg-surface-snow text-text-muted hover:text-dark-slate text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  removeMinorAthlete(pendingDeleteChild.id);
                  setPendingDeleteChild(null);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Child Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-carbon/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-card rounded-3xl shadow-2xl overflow-hidden border border-border-hairline p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-hairline pb-3">
              <h3 className="font-bold text-card-title text-dark-slate">
                {editingChildId ? "تعديل بيانات الابن" : "إضافة ابن أو بطل رياضي جديد"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-snow text-text-muted hover:text-dark-slate flex items-center justify-center"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <form onSubmit={handleSaveChild} className="space-y-4">
              <div>
                <label className="block text-body-compact font-bold text-dark-slate mb-1">
                  الاسم الرباعي للطفل:
                </label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: يوسف طارق عبد الحميد"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-snow border border-border-hairline text-dark-slate text-body-compact outline-none focus:ring-2 focus:ring-deep-olive/20 focus:border-deep-olive"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-body-compact font-bold text-dark-slate mb-1">
                    العمر الحالي (سنوات):
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="17"
                    value={childAge}
                    onChange={(e) => setChildAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-snow border border-border-hairline text-dark-slate text-body-compact outline-none focus:border-deep-olive"
                    required
                  />
                </div>
                <div>
                  <label className="block text-body-compact font-bold text-dark-slate mb-1">
                    النوع:
                  </label>
                  <select
                    value={childGender}
                    onChange={(e) => setChildGender(e.target.value as "male" | "female")}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-snow border border-border-hairline text-dark-slate text-body-compact outline-none focus:border-deep-olive"
                  >
                    <option value="male">ولد (ذكر)</option>
                    <option value="female">بنت (أنثى)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-body-compact font-bold text-dark-slate mb-1">
                  المسار الرياضي (السباحة):
                </label>
                <select
                  value={childSport === "fitness" ? "swimming" : childSport}
                  onChange={(e) => setChildSport(e.target.value as "swimming")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-snow border border-border-hairline text-dark-slate text-body-compact outline-none focus:border-deep-olive"
                >
                  <option value="swimming">السباحة والألعاب المائية (المسار الأولمبي)</option>
                </select>
              </div>

              {/* Law 151 Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-lime-tint/50 border border-athletic-olive/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="law151"
                  checked={law151Consent}
                  onChange={(e) => setLaw151Consent(e.target.checked)}
                  className="w-4 h-4 mt-1 accent-deep-olive rounded cursor-pointer"
                  required
                />
                <label htmlFor="law151" className="text-micro-caption text-deep-olive font-medium leading-relaxed cursor-pointer">
                  أقر بصفتي ولي أمر الطفل بالموافقة على إنشاء هذا السجل الرياضي وفقاً لأحكام قانون حماية البيانات الشخصية رقم 151 لسنة 2020، وقبول شروط دفتر الحصص والجواز الرياضي بكابتنلي.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-hairline">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-muted hover:text-dark-slate text-body-compact font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!law151Consent || !childName.trim()}
                  className="px-6 py-2.5 rounded-full bg-deep-olive disabled:opacity-50 text-white font-bold text-body-compact hover:brightness-105 transition-all shadow-sm"
                >
                  تأكيد وحفظ الملف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
