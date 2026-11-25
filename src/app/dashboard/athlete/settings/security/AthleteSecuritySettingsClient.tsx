"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { signOut } from "next-auth/react";
import { GoogleMark, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { isMemberAccountRole } from "@/types/captenly";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    currentPersona,
    userSettings,
    updateUserSettings,
    signOutToGuest,
    deleteCurrentAccount,
    pbRecords,
    sessionLedgers,
    minorAthletes,
    getSkillEvaluationForAthlete,
  } = useCaptenly();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await deleteCurrentAccount();
      if (res.ok) {
        router.push("/");
      } else {
        setDeleteError("حدث خطأ أثناء حذف الحساب من الخادم. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="الخصوصية والأمان وتصدير البيانات"
        descriptionAr="سجّل دخولك أولاً لإدارة إعدادات الأمان، كلمة المرور، أو تنزيل نسخة من سجلاتك."
      />
    );
  }

  const handleDownloadData = () => {
    const myLedgers = sessionLedgers.filter(
      (l) =>
        l.athleteId === currentPersona.id ||
        (currentPersona.memberCode &&
          l.memberCode?.toUpperCase() === currentPersona.memberCode.toUpperCase()) ||
        minorAthletes.some((m) => m.id === l.athleteId)
    );
    const myPBs = pbRecords.filter(
      (p) =>
        p.athleteId === currentPersona.id ||
        minorAthletes.some((m) => m.id === p.athleteId)
    );
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      platform: "Captenly",
      profile: {
        id: currentPersona.id,
        memberCode: currentPersona.memberCode,
        fullNameAr: currentPersona.fullNameAr,
        role: currentPersona.role,
        city: currentPersona.city,
        phone: currentPersona.phone,
        email: currentPersona.email,
      },
      minorAthletes: isMemberAccountRole(currentPersona.role) ? minorAthletes : [],
      personalBests: myPBs,
      skillEvaluation: getSkillEvaluationForAthlete(currentPersona.id),
      sessionLedgers: myLedgers,
    };

    try {
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `captenly-data-${currentPersona.memberCode || currentPersona.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch {
      // ignore fallback
    }
  };

  const handleSetPasswordFromGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword.length < 6) {
      setPwMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          newPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; messageAr?: string };
      setPwMessage(
        data.messageAr ||
          (data.ok ? "تم حفظ كلمة المرور الجديدة بنجاح." : "تتطلب هذه العملية جلسة Google نشطة أو رمز OTP.")
      );
      if (data.ok) {
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6 lg:pt-6 pb-12 flex flex-col gap-6" dir="rtl">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-micro-caption text-text-muted">
          <Link href="/dashboard/athlete/settings" className="hover:text-dark-slate transition-colors">
            الإعدادات
          </Link>
          <span>/</span>
          <span className="text-deep-olive font-bold">الخصوصية والأمان</span>
        </nav>

        <h1 className="font-cairo font-bold text-section-title text-dark-slate">
          إعدادات الأمان والخصوصية وحماية البيانات
        </h1>
        <p className="text-body-compact text-text-muted">
          إدارة حماية الحساب، التحقق الثنائي عبر OTP، وتنزيل نسخة رسمية من السجلات
        </p>
      </div>

      {downloadSuccess && (
        <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-deep-olive text-body-compact font-bold flex items-center gap-2">
          <Icon name="file_download_done" className="text-[18px]" />
          <span>تم تجهيز نسخة بياناتك الشخصية الموثقة وتنزيلها بصيغة JSON آمنة!</span>
        </div>
      )}

      {/* Security Cards */}
      <div className="space-y-4">
        {/* Card 0: Google OAuth Connection */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-snow border border-surface-container flex items-center justify-center shrink-0">
                <GoogleMark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  الدخول والربط السريع عبر حساب Google (OAuth 2.0)
                </h3>
                <p className="text-micro-caption text-text-muted">
                  {currentPersona.authProvider === "google" && currentPersona.email
                    ? `مربوط حالياً بالبريد: ${currentPersona.email}`
                    : "دخول فوري بضغطة واحدة عبر حساب Google"}
                </p>
              </div>
            </div>
            {currentPersona.authProvider === "google" ? (
              <span className="text-deep-olive text-micro-caption font-extrabold">
                مربوط عبر Google ✓
              </span>
            ) : (
              <GoogleSignInButton compact labelAr="ربط / دخول عبر Google" />
            )}
          </div>
          {currentPersona.authProvider === "google" && (
            <div className="flex items-center justify-between pt-1 border-t border-surface-container/60 text-micro-caption">
              <Link href="/dashboard/athlete/settings" className="text-deep-olive font-bold hover:underline">
                تعديل بيانات الحساب والملف العائلي
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOutToGuest();
                  signOut({ redirect: false }).catch(() => undefined);
                }}
                className="text-status-danger font-bold hover:underline"
              >
                فصل / تسجيل الخروج من Google
              </button>
            </div>
          )}
        </div>

        {/* Card 1: Password & Account Recovery */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-tint text-deep-olive flex items-center justify-center">
                <Icon name="lock" className="text-[20px]" />
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  كلمة المرور وتشفير الحساب (scrypt)
                </h3>
                <p className="text-micro-caption text-text-muted">
                  تُحفظ كلمات المرور مشفّرة بخوارزمية scrypt ولا تُخزن كنص صريح أبداً
                </p>
              </div>
            </div>
            <Link
              href="/auth/forgot"
              className="text-micro-caption font-bold text-deep-olive hover:underline"
            >
              تغيير/استعادة برمز OTP ←
            </Link>
          </div>
          {currentPersona.authProvider === "google" ? (
            <form onSubmit={handleSetPasswordFromGoogle} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border-hairline">
              <input
                type="password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="كلمة مرور جديدة (6+ أحرف)"
                className="rounded-xl bg-surface-snow px-3 py-2 text-xs border border-border-hairline outline-none"
              />
              <input
                type="password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تأكيد كلمة المرور"
                className="rounded-xl bg-surface-snow px-3 py-2 text-xs border border-border-hairline outline-none"
              />
              <button
                type="submit"
                disabled={pwSaving}
                className="rounded-xl bg-dark-slate text-electric-volt text-xs font-bold py-2 disabled:opacity-60"
              >
                {pwSaving ? "جاري التعيين..." : "تعيين كلمة مرور للدخول السريع"}
              </button>
              {pwMessage && (
                <p className="sm:col-span-3 text-micro-caption font-bold text-deep-olive">{pwMessage}</p>
              )}
            </form>
          ) : (
            <p className="text-micro-caption text-text-muted leading-relaxed">
              لتعديل كلمة المرور عبر البريد الإلكتروني أو الهاتف المسجل، انتقل لصفحة استعادة الحساب وسيُرسل رمز تحقق مكون من 6 أرقام عند تفعيل بوابة الرسائل.
            </p>
          )}
        </div>

        {/* Card 2: Privacy by Default (Law 151) */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-snow text-dark-slate flex items-center justify-center border border-border-hairline">
                <Icon name="visibility_off" className="text-[20px]" />
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  حالة إخفاء الملف الشخصي وسجلات الأبناء
                </h3>
                <p className="text-micro-caption text-text-muted">
                  مضبوط افتراضياً على الخصوصية التامة (Private Profile)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateUserSettings({ privacyProfilePublic: !userSettings.privacyProfilePublic })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                userSettings.privacyProfilePublic ? "bg-amber-600" : "bg-deep-olive"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  userSettings.privacyProfilePublic ? "left-0.5" : "right-0.5"
                }`}
              />
            </button>
          </div>
          <p className="text-micro-caption text-text-muted leading-relaxed">
            {userSettings.privacyProfilePublic
              ? "الملف ظاهر جزئياً للأكاديميات المعتمدة للترشيح المباشر."
              : "الملف مخفي بالكامل ومحمي، ولن يظهر إلا للمدربين والمنشآت التي توافق على إعطائها كود الربط الخاص بك."}
          </p>
        </div>

        {/* Card 3: Data Export / Portability */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-snow text-dark-slate flex items-center justify-center border border-border-hairline">
                <Icon name="download" className="text-[20px]" />
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  حق تصدير وتنزيل البيانات (قانون رقم 151)
                </h3>
                <p className="text-micro-caption text-text-muted">
                  تنزيل سجل دفتر الحصص والأزمنة القياسية والإيصالات
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadData}
              className="px-4 py-2 rounded-xl bg-dark-slate text-electric-volt font-bold text-micro-caption hover:bg-deep-carbon transition-colors"
            >
              تنزيل أرشيفي
            </button>
          </div>
        </div>

        {/* Card 4: Permanent Account Deletion */}
        <div className="p-5 rounded-2xl bg-red-50/60 border border-status-danger/30 shadow-card space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-status-danger flex items-center justify-center shrink-0">
                <Icon name="delete_forever" className="text-[20px]" />
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-status-danger">
                  حذف الحساب نهائياً
                </h3>
                <p className="text-micro-caption text-text-muted mt-0.5 leading-relaxed">
                  تسجيل الخروج يحفظ حسابك وكودك وجميع عملياتك للعودة لاحقاً. أما حذف الحساب فيمسح الملف الشخصي، الأرقام القياسية، المفضلة، الحصص، الإشعارات، وبيانات الأبناء نهائياً ولا يمكن التراجع عنه.
                </p>
              </div>
            </div>
            {!confirmDeleteOpen && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="px-4 py-2 rounded-xl bg-status-danger text-white font-bold text-micro-caption hover:opacity-90 transition-opacity shrink-0"
              >
                حذف الحساب نهائياً
              </button>
            )}
          </div>

          {confirmDeleteOpen && (
            <div className="p-4 rounded-xl bg-white border border-status-danger/30 space-y-3">
              <p className="text-xs font-bold text-dark-slate">
                هل أنت متأكد؟ سيتم حذف حسابك وكل السجلات والعمليات المرتبطة به نهائياً.
              </p>
              {deleteError && (
                <p className="text-xs font-bold text-status-danger">{deleteError}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleConfirmDeleteAccount}
                  className="px-4 py-2 rounded-xl bg-status-danger text-white font-bold text-xs disabled:opacity-60"
                >
                  {deletingAccount
                    ? "جاري حذف الحساب..."
                    : "تأكيد حذف الحساب وجميع البيانات نهائياً"}
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => {
                    setConfirmDeleteOpen(false);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-snow text-dark-slate border border-border-hairline font-bold text-xs"
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
