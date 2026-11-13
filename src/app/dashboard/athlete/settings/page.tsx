"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { AthleteProfileSocialEditor } from "@/components/editorial/AthleteProfileSocialEditor";

export default function SettingsHubPage() {
  const { currentPersona, userLocation, setLocationModalOpen, minorAthletes } = useCaptenly();

  const settingsLinks = [
    {
      href: "/dashboard/athlete/settings/family",
      titleAr: "إدارة العائلة والأبناء",
      descAr: "بيانات الأبناء، موافقة ولي الأمر الرسمية، وحماية خصوصية القُصّر (قانون 151)",
      icon: "family_restroom",
      badgeAr: `${minorAthletes.length} مسجلين`,
      badgeColor: "bg-lime-tint text-deep-olive",
    },
    {
      href: "/dashboard/athlete/settings/notifications",
      titleAr: "تفضيلات الإشعارات ورسائل واتساب",
      descAr: "تذكير الحصص قبل موعدها بساعتين، تنبيهات تجديد الاشتراك، وأكواد الحضور",
      icon: "notifications",
      badgeAr: "مفعلة عبر واتساب",
      badgeColor: "bg-surface-container text-dark-slate",
    },
    {
      href: "/dashboard/athlete/settings/security",
      titleAr: "الخصوصية والأمان وكلمة المرور",
      descAr: "تأكيد رقم الهاتف، إعدادات الخصوصية الافتراضية، وتنزيل نسخة من بياناتك",
      icon: "shield_lock",
      badgeAr: "آمن 100%",
      badgeColor: "bg-lime-tint text-deep-olive",
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
              <span className="text-deep-olive text-micro-caption font-extrabold">
                موثق ✓
              </span>
            </div>
            <p className="text-body-compact text-text-muted">
              {currentPersona.personaTitleAr} • {currentPersona.phone}
            </p>
            <div className="flex items-center gap-2 text-micro-caption text-text-muted pt-0.5">
              <Icon name="location_on" className="text-[15px] text-deep-olive" />
              <span>النطاق: {userLocation.city} ({userLocation.governorate})</span>
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
            href="/dashboard/athlete"
            className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-bold text-body-compact text-center hover:bg-deep-carbon transition-colors"
          >
            دفتر الحصص والجواز
          </Link>
          <Link
            href="/auth"
            className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-dark-slate font-bold text-body-compact text-center transition-colors"
          >
            تبديل الحساب
          </Link>
        </div>
      </div>

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
    </div>
  );
}
