"use client";

import React from "react";
import { Icon } from "@/components/Icon";
import type { SessionLedger } from "@/types/captenly";

interface LedgerPricingAuditBoxProps {
  ledger: SessionLedger;
  onPrintBagCard: () => void;
  compact?: boolean;
}

/**
 * Shared financial snapshot breakdown & CR80 bag-card print launcher
 * used across Desktop (D8) and Mobile (P5) Swimmer Pass Ledgers.
 */
export function LedgerPricingAuditBox({
  ledger,
  onPrintBagCard,
  compact = false,
}: LedgerPricingAuditBoxProps) {
  const snap = ledger.pricingSnapshot;

  return (
    <div
      className={`rounded-2xl bg-[#F7F9FA] border border-[#0F4C5C]/15 flex flex-col gap-3 w-full ${
        compact ? "p-3.5" : "p-4"
      }`}
    >
      {ledger.linkedEntityNameAr && (
        <div className="flex items-center justify-between gap-2 text-[11px] bg-white rounded-xl px-3 py-2 border border-sand-border">
          <span className="text-ink-muted font-bold">الجهة / الأكاديمية المنظمة:</span>
          <span className="font-black text-[#0F4C5C]">{ledger.linkedEntityNameAr}</span>
        </div>
      )}

      {snap ? (
        <div className="space-y-1.5 text-xs">
          <div className="font-black text-[#0F4C5C] flex items-center gap-1.5 mb-1">
            <Icon name="receipt_long" size={16} />
            <span>تفصيل تكلفة الاشتراك المحفوظة</span>
          </div>

          <div className="flex items-center justify-between text-ink-slate">
            <span>
              حساب المية ({snap.waterFeePerSessionEgp} ج × {ledger.totalSessions} حصة)
            </span>
            <span className="font-bold tabular-nums">{snap.waterTotalEgp} ج.م</span>
          </div>

          <div className="flex items-center justify-between text-ink-slate">
            <span>مقابل التدريب / الباقة</span>
            <span className="font-bold tabular-nums">{snap.trainingFeeEgp} ج.م</span>
          </div>

          {snap.discountAmountEgp > 0 && (
            <div className="flex items-center justify-between text-emerald-700 font-bold">
              <span>
                خصم مطبّق
                {snap.promoCode
                  ? ` (${snap.promoCode})`
                  : snap.discountReasonAr
                    ? ` (${snap.discountReasonAr})`
                    : ""}
              </span>
              <span className="tabular-nums">- {snap.discountAmountEgp} ج.م</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-[#0F4C5C]/15 font-black text-sm text-[#0F4C5C]">
            <span>الإجمالي الصافي المحفوظ</span>
            <span className="tabular-nums">{snap.netTotalEgp} ج.م</span>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-ink-muted">
          يمكنك طباعة كارت حقيبة السباح بحجم البطاقة القياسي لاستخدامه عند البوابة بدون هاتف.
        </div>
      )}

      <button
        type="button"
        onClick={onPrintBagCard}
        className="w-full py-2.5 px-4 rounded-xl bg-[#0F4C5C] hover:bg-[#1D6E7D] text-white text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Icon name="print" size={16} />
        <span>طباعة / تحميل كارت الحقيبة (8.5×5.4 سم)</span>
      </button>
    </div>
  );
}
