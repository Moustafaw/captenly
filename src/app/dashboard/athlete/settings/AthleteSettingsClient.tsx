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
    facilities,
    updateFacilityHeroImage,
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
            badgeColor: "bg-[#EAF4F8] text-[#1D6E7D] border border-[#00ACC1]/20",
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
          ? "bg-[#EAF4F8] text-[#1D6E7D]"
          : "bg-[#F7F9FA] text-[#475569]",
    },
    {
      href: "/dashboard/athlete/settings/security",
      titleAr: "الخصوصية والأمان وكلمة المرور",
      descAr: "تأكيد رقم الهاتف، إعدادات الخصوصية الافتراضية، وتنزيل نسخة من بياناتك",
      icon: "shield_lock",
      badgeAr: currentPersona.phone ? "رقم مؤكد" : "حماية الحساب",
      badgeColor: currentPersona.phone
        ? "bg-[#EAF4F8] text-[#1D6E7D]"
        : "bg-[#F7F9FA] text-[#475569]",
    },
    {
      href: "/dashboard/athlete/settings/history",
      titleAr: "أرشيف الإيصالات والاشتراكات السابقة",
      descAr: "سجل الحوالات (إنستاباي وفودافون كاش) وإيصالات الدفع الموثقة للأكاديميات",
      icon: "receipt_long",
      badgeAr: "أرشيف دائم",
      badgeColor: "bg-[#F7F9FA] text-[#475569]",
    },
  ];

  const isIdentityVerified = Boolean(
    currentPersona.phone || currentPersona.linkedFacilityId || currentPersona.linkedCoachId
  );
  const linkedFacility = currentPersona.linkedFacilityId
    ? facilities.find((f) => f.id === currentPersona.linkedFacilityId)
    : undefined;

  return (
    <div className="min-h-screen bg-[#F7F9FA]">
      <div className="flex w-full max-w-4xl mx-auto px-margin lg:px-6 pt-6 pb-16 flex-col gap-6" dir="rtl">
        {/* 1. Page Header & Identity Card */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-cairo font-bold text-section-title text-[#0F172A]">
              إعدادات الحساب والملف الرياضي
            </h1>
            <p className="text-body-compact text-[#64748B] mt-0.5">
              إدارة بيانات العائلة، إشعارات واتساب، والخصوصية الرقمية
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/15 text-micro-caption font-extrabold">
            الحساب: {currentPersona.shortLabelAr}
          </span>
        </div>

        {/* 2. Identity Snapshot Card */}
        <div className="w-full bg-white rounded-[24px] p-5 md:p-6 border border-[#0F172A]/8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarUploader size="lg" labelAr="تغيير الصورة الشخصية" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-cairo font-bold text-card-title text-[#0F172A]">
                  {currentPersona.fullNameAr}
                </h2>
                {isIdentityVerified && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-micro-caption font-extrabold">
                    موثق ✓
                  </span>
                )}
              </div>
              <p className="text-body-compact text-[#64748B]">
                {currentPersona.personaTitleAr}
                {currentPersona.phone ? ` • ${currentPersona.phone}` : ""}
              </p>
              <div className="flex items-center gap-2 text-micro-caption text-[#64748B] pt-0.5">
                <Icon name="location_on" className="text-[15px] text-[#1D6E7D]" />
                <span>
                  {userLocation.isSpecified
                    ? `النطاق: ${userLocation.city} (${userLocation.governorate})`
                    : "النطاق: كل مصر (نطاق مفتوح)"}
                </span>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="text-[#1D6E7D] font-bold hover:underline mr-1"
                >
                  تغيير
                </button>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
            <Link
              href={dashboardHref}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-body-compact text-center transition-colors shadow-sm"
            >
              {dashboardLabel}
            </Link>
            <Link
              href="/auth"
              className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] border border-[#0F172A]/10 font-bold text-body-compact text-center transition-colors"
            >
              تسجيل الدخول بحساب آخر
            </Link>
          </div>
        </div>

        {/* Linked Facility Cover/Logo Card (for facility owners/admins) */}
        {linkedFacility && (
          <div className="w-full bg-white rounded-[24px] p-5 md:p-6 border border-[#1D6E7D]/20 shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AvatarUploader
                size="lg"
                shape="rounded"
                initialUrl={linkedFacility.heroImage}
                titleAr="ضبط وتكبير شعار أو صورة المنشأة"
                labelAr="تغيير صورة المنشأة"
                onLocalSelect={(dataUrl) =>
                  updateFacilityHeroImage(linkedFacility.id, dataUrl)
                }
              />
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-extrabold">
                  <Icon name="pool" className="text-[13px]" />
                  <span>شعار وصورة المنشأة العامة</span>
                </span>
                <h3 className="font-cairo font-bold text-base text-[#0F172A]">
                  {linkedFacility.nameAr}
                </h3>
                <p className="text-xs text-[#64748B]">
                  تظهر هذه الصورة في كروت البحث والصفحة العامة للمنشأة، بينما الصورة بالأعلى تخص حسابك الشخصي.
                </p>
              </div>
            </div>
            <Link
              href={`/academy/${linkedFacility.slug}`}
              className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-[#EAF4F8] hover:bg-[#D7ECF4] text-[#1D6E7D] font-bold text-xs text-center transition-colors shrink-0"
            >
              معاينة صفحة المنشأة ←
            </Link>
          </div>
        )}

        {/* Staff Role Account Switcher inside Settings */}
        {(myStaffAssignments.length > 0 || activeStaffAssignment) && (
          <div className="w-full bg-[#EAF4F8]/80 rounded-2xl p-5 border border-[#1D6E7D]/25 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-cairo font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Icon name="swap_horiz" className="text-[18px] text-[#1D6E7D]" />
                  <span>تبديل الحساب الوظيفي بالمنشأة</span>
                </h3>
                <p className="text-xs text-[#475569] mt-0.5">
                  {activeStaffAssignment
                    ? `أنت تعمل حالياً بصلاحية «${activeStaffAssignment.roleTitleAr}» في ${activeStaffAssignment.facilityNameAr}.`
                    : "يمكنك قبول دعوات الإدارة أو التبديل لواجهة المنشأة لأداء مهامك الوظيفية بصلاحياتك المحددة."}
                </p>
              </div>
              {activeStaffAssignment && (
                <button
                  type="button"
                  onClick={() => switchToStaffMode(null)}
                  className="px-4 py-2 rounded-full bg-[#1D6E7D] text-white text-xs font-bold shrink-0"
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
                      className="rounded-xl bg-white p-3 border border-[#1D6E7D]/20 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="text-xs">
                        <span className="font-bold text-[#0F172A]">
                          دعوة وظيفية: {st.roleTitleAr}
                        </span>{" "}
                        <span className="text-[#64748B]">({st.facilityNameAr})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => respondToStaffInvitation(st.facilityId, st.id, "accepted")}
                          className="px-3 py-1.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold"
                        >
                          قبول الدعوة ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToStaffInvitation(st.facilityId, st.id, "declined")}
                          className="px-3 py-1.5 rounded-full bg-red-50 text-[#DC2626] text-xs font-bold"
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
                      className="w-fit px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold"
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
              className="bg-white rounded-[20px] p-5 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:border-[#1D6E7D]/30 hover:shadow-md transition-all flex flex-col justify-between group gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center transition-colors shrink-0">
                  <Icon name={link.icon} className="text-[22px]" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${link.badgeColor}`}>
                  {link.badgeAr}
                </span>
              </div>

              <div>
                <h3 className="font-cairo font-bold text-card-title text-[#0F172A] group-hover:text-[#1D6E7D] transition-colors">
                  {link.titleAr}
                </h3>
                <p className="text-micro-caption text-[#64748B] mt-1 leading-relaxed">
                  {link.descAr}
                </p>
              </div>

              <div className="flex items-center justify-between text-micro-caption font-bold text-[#1D6E7D] pt-2 border-t border-[#0F172A]/6">
                <span>فتح الإعدادات</span>
                <Icon name="arrow_forward" className="text-[16px] rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        {/* 4. Bio & Social Links Editor */}
        <AthleteProfileSocialEditor />

        {/* 5. Legal, Child Safety & Verification Standards (Moved here from Side Drawer) */}
        <div className="bg-white rounded-[24px] p-5 md:p-6 border border-[#0F172A]/8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-3">
          <div>
            <h3 className="font-cairo font-bold text-card-title-sm text-[#0F172A]">
              الخصوصية، الشروط القانونية ومعايير التوثيق
            </h3>
            <p className="text-micro-caption text-[#64748B] mt-0.5">
              مراجعة سياسة حماية القُصّر (قانون 151)، اللوائح المنظمة (قانون الرياضة 3 لسنة 1985)، ومعايير شارات الاعتماد.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { href: "/privacy", icon: "shield", label: "الخصوصية وحماية القُصّر" },
              { href: "/terms", icon: "gavel", label: "الشروط وقانون 3 لسنة 1985" },
              { href: "/badges", icon: "verified", label: "معايير الشارات والتوثيق" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl bg-[#F7F9FA] hover:bg-[#EAF4F8] border border-[#0F172A]/8 hover:border-[#1D6E7D]/25 text-xs font-bold text-[#0F172A] hover:text-[#1D6E7D] transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon name={item.icon} className="text-[16px] text-[#1D6E7D] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <Icon name="chevron_left" className="text-[15px] text-[#64748B] shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* 6. Discreet Self-Upgrade Section (Athlete / Parent only, zero public ads) */}
        {!isFacility && !isCoach && (
          <div className="p-5 rounded-[24px] bg-white border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-cairo font-bold text-card-title-sm text-[#0F172A]">
                ترقية الحساب (كابتن معتمد أو إدارة منشأة)
              </h3>
              <p className="text-micro-caption text-[#64748B] mt-0.5">
                إذا كنت مدرب سباحة أو مدير نادي/أكاديمية وترغب في توثيق حسابك وإدارة الحصص، يمكنك تقديم الطلب من هنا.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/claim?mode=coach"
                className="px-4 py-2 rounded-full bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] text-xs font-bold border border-[#1D6E7D]/20 transition-colors"
              >
                توثيق حساب كابتن
              </Link>
              <Link
                href="/claim"
                className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm transition-colors"
              >
                إدارة منشأة / أكاديمية
              </Link>
            </div>
          </div>
        )}

        {/* 7. Sign Out & Permanent Account Deletion */}
        <div className="p-5 rounded-[24px] bg-white border border-red-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-cairo font-bold text-card-title-sm text-[#0F172A]">
                الجلسة وحذف الحساب
              </h3>
              <p className="text-micro-caption text-[#64748B] mt-0.5 leading-relaxed">
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
                className="px-4 py-2 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] text-xs font-bold border border-[#0F172A]/10 transition-colors"
              >
                تسجيل الخروج
              </button>
              {!confirmDeleteOpen && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#DC2626] text-white text-xs font-bold hover:opacity-90"
                >
                  حذف الحساب نهائياً
                </button>
              )}
            </div>
          </div>

          {confirmDeleteOpen && (
            <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#DC2626]">
                سيتم حذف حسابك وكل عملياتك وسجلاتك المحفوظة نهائياً. هل تريد المتابعة؟
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-full bg-[#DC2626] text-white text-xs font-bold disabled:opacity-60"
                >
                  {deletingAccount
                    ? "جاري الحذف..."
                    : "تأكيد حذف الحساب وجميع البيانات نهائياً"}
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setConfirmDeleteOpen(false)}
                  className="px-4 py-2 rounded-full bg-white text-[#0F172A] border border-[#0F172A]/10 text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
