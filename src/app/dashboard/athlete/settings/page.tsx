"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { AthleteProfileSocialEditor } from "@/components/editorial/AthleteProfileSocialEditor";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { isMemberAccountRole } from "@/types/captenly";

export default function SettingsHubPage() {
  const router = useRouter();
  const {
    currentPersona,
    userLocation,
    userSettings,
    setLocationModalOpen,
    minorAthletes,
    isAuthenticated,
    myStaffAssignments,
    activeStaffAssignment,
    switchToStaffMode,
    respondToStaffInvitation,
    signOutToGuest,
    deleteCurrentAccount,
  } = useCaptenly();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleConfirmDelete = async () => {
    setDeletingAccount(true);
    try {
      const res = await deleteCurrentAccount();
      if (res.ok) {
        router.push("/");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="إعدادات الحساب وصورة البروفايل"
        descriptionAr="سجّل دخولك أو أنشئ حسابك على Captenly لإدارة صورتك الشخصية، بياناتك، وإعدادات الأمان."
      />
    );
  }

  const isFacility = currentPersona.role === "facility_manager";
  const isCoach = currentPersona.role === "coach";
  const dashboardHref = isFacility
    ? "/dashboard/facility"
    : isCoach
    ? "/dashboard/coach"
    : "/dashboard/athlete";
  const dashboardLabel = isFacility
    ? "لوحة إدارة المنشأة"
    : isCoach
    ? "لوحة الكابتن"
    : "ملفي الرياضي والجواز";

  const settingsLinks = [
    ...(isMemberAccountRole(currentPersona.role)
      ? [
          {
            href: "/dashboard/athlete/settings/family",
            titleAr: "إدارة العائلة والأبناء (اختياري)",
            descAr: "بيانات الأبناء، موافقة ولي الأمر الرسمية، وحماية خصوصية القُصّر (قانون 151)",
            icon: "family_restroom",
            badgeAr: `${minorAthletes.length} مسجلين`,
            badgeColor: "bg-lime-tint text-deep-olive",
          },
        ]
      : []),
    {
      href: "/dashboard/athlete/settings/notifications",
      titleAr: "تفضيلات الإشعارات ورسائل واتساب",
      descAr: "تذكير الحصص قبل موعدها بساعتين، تنبيهات تجديد الاشتراك، وأكواد الحضور",
      icon: "notifications",
      badgeAr:
        userSettings.notifyWhatsappSessions && currentPersona.phone
          ? "مفعلة عبر واتساب"
          : currentPersona.phone
          ? "متوقفة"
          : "بانتظار رقم الهاتف",
      badgeColor:
        userSettings.notifyWhatsappSessions && currentPersona.phone
          ? "bg-lime-tint text-deep-olive"
          : "bg-surface-container text-dark-slate",
    },
    {
      href: "/dashboard/athlete/settings/security",
      titleAr: "الخصوصية والأمان وكلمة المرور",
      descAr: "تأكيد رقم الهاتف، إعدادات الخصوصية الافتراضية، وتنزيل نسخة من بياناتك",
      icon: "shield_lock",
      badgeAr: currentPersona.phone ? "رقم مؤكد" : "حماية الحساب",
      badgeColor: currentPersona.phone
        ? "bg-lime-tint text-deep-olive"
        : "bg-surface-container text-dark-slate",
    },
    {
      href: "/dashboard/athlete/settings/history",
      titleAr: "أرشيف الإيصالات والاشتراكات السابقة",
      descAr: "سجل الحوالات (إنستاباي وفودافون كاش) وإيصالات الدفع الموثقة للأكاديميات",
      icon: "receipt_long",
      badgeAr: "أرشيف دائم",
      badgeColor: "bg-surface-container text-dark-slate",
    },
  ];

  const isIdentityVerified = Boolean(
    currentPersona.phone || currentPersona.linkedFacilityId || currentPersona.linkedCoachId
  );

  return (
    <div className="flex w-full max-w-4xl mx-auto px-margin lg:px-6 pt-6 pb-12 flex-col gap-6" dir="rtl">
      {/* 1. Page Header & Identity Card */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo font-bold text-section-title text-dark-slate">
            إعدادات الحساب والملف الرياضي
          </h1>
          <p className="text-body-compact text-text-muted mt-0.5">
            إدارة بيانات العائلة، إشعارات واتساب، والخصوصية الرقمية
          </p>
        </div>
        <span className="text-micro-caption font-extrabold text-deep-olive">
          الحساب: {currentPersona.shortLabelAr}
        </span>
      </div>

      {/* 2. Identity Snapshot Card */}
      <div className="w-full bg-surface-card rounded-2xl p-5 border border-border-hairline shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarUploader size="lg" labelAr="تغيير الصورة" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-cairo font-bold text-card-title text-dark-slate">
                {currentPersona.fullNameAr}
              </h2>
              {isIdentityVerified && (
                <span className="text-deep-olive text-micro-caption font-extrabold">
                  موثق ✓
                </span>
              )}
            </div>
            <p className="text-body-compact text-text-muted">
              {currentPersona.personaTitleAr}
              {currentPersona.phone ? ` • ${currentPersona.phone}` : ""}
            </p>
            <div className="flex items-center gap-2 text-micro-caption text-text-muted pt-0.5">
              <Icon name="location_on" className="text-[15px] text-deep-olive" />
              <span>
                {userLocation.isSpecified
                  ? `النطاق: ${userLocation.city} (${userLocation.governorate})`
                  : "النطاق: كل مصر (نطاق مفتوح)"}
              </span>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="text-deep-olive font-bold hover:underline mr-1"
              >
                تغيير
              </button>
            </div>
          </div>
        </div>

        <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
          <Link
            href={dashboardHref}
            className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-bold text-body-compact text-center hover:bg-deep-carbon transition-colors"
          >
            {dashboardLabel}
          </Link>
          <Link
            href="/auth"
            className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-dark-slate font-bold text-body-compact text-center transition-colors"
          >
            تبديل الحساب
          </Link>
        </div>
      </div>

      {/* Staff Role Account Switcher inside Settings */}
      {(myStaffAssignments.length > 0 || activeStaffAssignment) && (
        <div className="w-full bg-lime-tint rounded-2xl p-5 border border-deep-olive/35 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-cairo font-bold text-sm text-dark-slate flex items-center gap-2">
                <Icon name="swap_horiz" className="text-[18px] text-deep-olive" />
                <span>تبديل الحساب الوظيفي بالمنشأة</span>
              </h3>
              <p className="text-xs text-deep-olive mt-0.5">
                {activeStaffAssignment
                  ? `أنت تعمل حالياً بصلاحية «${activeStaffAssignment.roleTitleAr}» في ${activeStaffAssignment.facilityNameAr}.`
                  : "يمكنك قبول دعوات الإدارة أو التبديل لواجهة المنشأة لأداء مهامك الوظيفية بصلاحياتك المحددة."}
              </p>
            </div>
            {activeStaffAssignment && (
              <button
                type="button"
                onClick={() => switchToStaffMode(null)}
                className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold shrink-0"
              >
                العودة لحسابي الشخصي ↩
              </button>
            )}
          </div>

          {!activeStaffAssignment && (
            <div className="flex flex-col gap-2">
              {myStaffAssignments.map((st) =>
                st.invitationStatus === "pending" ? (
                  <div
                    key={st.id}
                    className="rounded-xl bg-surface-card p-3 border border-deep-olive/25 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="text-xs">
                      <span className="font-bold text-dark-slate">
                        دعوة وظيفية: {st.roleTitleAr}
                      </span>{" "}
                      <span className="text-text-muted">({st.facilityNameAr})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => respondToStaffInvitation(st.facilityId, st.id, "accepted")}
                          className="px-3 py-1.5 rounded-full bg-deep-olive text-white text-xs font-bold"
                        >
                          قبول الدعوة ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToStaffInvitation(st.facilityId, st.id, "declined")}
                          className="px-3 py-1.5 rounded-full bg-red-50 text-status-danger text-xs font-bold"
                        >
                          رفض ✕
                        </button>
                    </div>
                  </div>
                ) : (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      switchToStaffMode(st.id);
                      router.push("/dashboard/facility");
                    }}
                    className="w-fit px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
                  >
                    التبديل لوظيفة: {st.roleTitleAr} ({st.facilityNameAr}) ←
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Settings Navigation Sub-Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-surface-card rounded-2xl p-5 border border-border-hairline shadow-card hover:shadow-md transition-all flex flex-col justify-between group gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-snow group-hover:bg-lime-tint text-deep-olive flex items-center justify-center transition-colors shrink-0 border border-border-hairline">
                <Icon name={link.icon} className="text-[24px]" />
              </div>
              <span className="text-[11px] font-extrabold text-deep-olive">
                {link.badgeAr}
              </span>
            </div>

            <div>
              <h3 className="font-cairo font-bold text-card-title text-dark-slate group-hover:text-deep-olive transition-colors">
                {link.titleAr}
              </h3>
              <p className="text-micro-caption text-text-muted mt-1 leading-relaxed">
                {link.descAr}
              </p>
            </div>

            <div className="flex items-center justify-between text-micro-caption font-bold text-deep-olive pt-2 border-t border-border-hairline/60">
              <span>فتح الإعدادات</span>
              <Icon name="arrow_forward" className="text-[16px] rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* 4. Bio & Social Links Editor */}
      <AthleteProfileSocialEditor />

      {/* 5. Discreet Self-Upgrade Section (Athlete / Parent only, zero public ads) */}
      {!isFacility && !isCoach && (
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-cairo font-bold text-card-title-sm text-dark-slate">
              ترقية الحساب (كابتن معتمد أو إدارة منشأة)
            </h3>
            <p className="text-micro-caption text-text-muted mt-0.5">
              إذا كنت مدرب سباحة أو مدير نادي/أكاديمية وترغب في توثيق حسابك وإدارة الحصص، يمكنك تقديم الطلب من هنا.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/claim?mode=coach"
              className="px-4 py-2 rounded-full bg-surface-snow hover:bg-lime-tint text-dark-slate text-xs font-bold border border-border-hairline"
            >
              توثيق حساب كابتن
            </Link>
            <Link
              href="/claim"
              className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
            >
              إدارة منشأة / أكاديمية
            </Link>
          </div>
        </div>
      )}

      {/* 6. Sign Out & Permanent Account Deletion */}
      <div className="p-5 rounded-2xl bg-surface-card border border-status-danger/25 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-cairo font-bold text-card-title-sm text-dark-slate">
              الجلسة وحذف الحساب
            </h3>
            <p className="text-micro-caption text-text-muted mt-0.5 leading-relaxed">
              تسجيل الخروج يحفظ حسابك وكافة عملياتك كما هي عند عودتك. حذف الحساب يمسح الحساب وجميع السجلات نهائياً.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                signOutToGuest();
                router.push("/");
              }}
              className="px-4 py-2 rounded-full bg-surface-snow hover:bg-surface-container text-dark-slate text-xs font-bold border border-border-hairline"
            >
              تسجيل الخروج
            </button>
            {!confirmDeleteOpen && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="px-4 py-2 rounded-full bg-status-danger text-white text-xs font-bold hover:opacity-90"
              >
                حذف الحساب نهائياً
              </button>
            )}
          </div>
        </div>

        {confirmDeleteOpen && (
          <div className="p-4 rounded-xl bg-red-50/70 border border-status-danger/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-bold text-status-danger">
              سيتم حذف حسابك وكل عملياتك وسجلاتك المحفوظة نهائياً. هل تريد المتابعة؟
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-full bg-status-danger text-white text-xs font-bold disabled:opacity-60"
              >
                {deletingAccount
                  ? "جاري الحذف..."
                  : "تأكيد حذف الحساب وجميع البيانات نهائياً"}
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-full bg-white text-dark-slate border border-border-hairline text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
