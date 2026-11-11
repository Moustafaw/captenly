"use client";

import React from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function HistorySettingsPage() {
  const { sessionLedgers } = useCaptenly();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6" dir="rtl">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-micro-caption text-text-muted">
          <Link href="/dashboard/athlete/settings" className="hover:text-dark-slate transition-colors">
            الإعدادات
          </Link>
          <span>/</span>
          <span className="text-deep-olive font-bold">أرشيف الإيصالات والاشتراكات</span>
        </nav>

        <h1 className="font-cairo font-bold text-section-title text-dark-slate">
          أرشيف إيصالات الدفع والاشتراكات الموثقة
        </h1>
        <p className="text-body-compact text-text-muted">
          سجل الحوالات الرقمية (إنستاباي / فودافون كاش) لحفظ حقوق أولياء الأمور والأكاديميات
        </p>
      </div>

      {/* Receipts List */}
      <div className="space-y-4">
        {sessionLedgers.map((ledger) => {
          const hasReceipt = Boolean(ledger.receipts && ledger.receipts.length > 0);
          const receipt = hasReceipt ? ledger.receipts[0] : null;

          return (
            <div
              key={ledger.id}
              className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-card-title-sm text-dark-slate">
                    {ledger.packageTitleAr}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ledger.status === "active"
                        ? "bg-lime-tint text-deep-olive"
                        : "bg-surface-container text-text-muted"
                    }`}
                  >
                    {ledger.status === "active" ? "باقة جارية" : "مكتملة"}
                  </span>
                </div>

                <p className="text-micro-caption text-text-muted">
                  المنشأة: {ledger.facilityNameAr} • المتدرب: {ledger.athleteNameAr} • ({ledger.completedSessions} من {ledger.totalSessions} حصة)
                </p>

                {hasReceipt && receipt ? (
                  <div className="flex items-center gap-3 pt-1 text-micro-caption text-deep-olive font-mono">
                    <span className="flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      <span>كود العملية: {receipt.referenceNumber}</span>
                    </span>
                    <span>•</span>
                    <span>{receipt.channel}</span>
                    <span>•</span>
                    <span className="font-bold">{receipt.amountEgp} ج.م</span>
                  </div>
                ) : (
                  <span className="text-micro-caption text-amber-700 block">
                    لم يُرفع إيصال إلكتروني بعد (دفع نقدي بمقر النادي)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/athlete"
                  className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-dark-slate text-micro-caption font-bold transition-colors"
                >
                  استعراض الحصص
                </Link>
                {hasReceipt && receipt && (
                  <button
                    type="button"
                    onClick={() => alert(`إيصال رسمي موثق:\nالمرجع: ${receipt.referenceNumber}\nالمبلغ: ${receipt.amountEgp} ج.م\nالقناة: ${receipt.channel}\nالتاريخ: ${receipt.uploadedDateAr}`)}
                    className="px-4 py-2 rounded-xl bg-dark-slate text-electric-volt text-micro-caption font-bold hover:bg-deep-carbon transition-colors"
                  >
                    عرض الإيصال
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
