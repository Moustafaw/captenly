"use client";

import React from "react";
import { Icon } from "@/components/Icon";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { buildCaptenlyQrUrl } from "@/lib/qrPayload";
import type { SessionLedger } from "@/types/captenly";

interface PrintableSwimmerCardModalProps {
  open: boolean;
  onClose: () => void;
  ledger: SessionLedger;
}

export function escapePrintHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generates an executive CR80 (85.6mm × 54mm) printable swimming-bag ID card
 * for swimmers & children without a smartphone poolside, plus WhatsApp pass sharing.
 */
export function PrintableSwimmerCardModal({
  open,
  onClose,
  ledger,
}: PrintableSwimmerCardModalProps) {
  if (!open) return null;

  const subCode = ledger.subscriptionCode || ledger.ledgerCode;
  const qrValue = buildCaptenlyQrUrl("subscription", subCode);
  const remaining = Math.max(0, ledger.totalSessions - ledger.completedSessions);

  const handlePrintPdf = () => {
    if (typeof window === "undefined") return;
    const printWin = window.open("", "_blank", "width=760,height=640");
    if (!printWin) {
      window.print();
      return;
    }

    const qrSvgEl = document.getElementById(`printable-bag-qr-${ledger.id}`)?.querySelector("svg");
    const qrSvgHtml = qrSvgEl ? qrSvgEl.outerHTML : "";
    const safeAthleteName = escapePrintHtml(ledger.athleteNameAr);
    const safeFacilityName = escapePrintHtml(ledger.facilityNameAr);
    const safeCoachOrEntity = escapePrintHtml(ledger.linkedEntityNameAr || ledger.coachNameAr);
    const safeSubCode = escapePrintHtml(subCode);
    const safeTotalSessions = escapePrintHtml(ledger.totalSessions);

    printWin.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <title>كارت شنطة السباحة — ${safeAthleteName} (${safeSubCode})</title>
  <style>
    @page { size: auto; margin: 12mm; }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #F7F9FA;
      color: #0F172A;
      margin: 0;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .cut-guide {
      border: 1.5px dashed #94A3B8;
      padding: 8px;
      border-radius: 14px;
      background: #fff;
    }
    .bag-card {
      width: 85.6mm;
      height: 54mm;
      border-radius: 10px;
      border: 1px solid #CBD5E1;
      overflow: hidden;
      display: flex;
      background: #FFFFFF;
      position: relative;
      box-sizing: border-box;
    }
    .lanyard-slot {
      position: absolute;
      top: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 14mm;
      height: 2.8mm;
      border-radius: 99px;
      background: #E2E8F0;
      border: 1px solid #CBD5E1;
    }
    .spine {
      width: 12mm;
      background: linear-gradient(180deg, #0F4C5C 0%, #1D6E7D 100%);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      writing-mode: vertical-rl;
      font-weight: 800;
      font-size: 9px;
      letter-spacing: 0.5px;
    }
    .body {
      flex: 1;
      padding: 12px 10px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      min-width: 0;
    }
    .club { font-size: 9px; font-weight: 700; color: #1D6E7D; }
    .name { font-size: 13px; font-weight: 800; color: #0F172A; }
    .track { font-size: 9px; color: #475569; }
    .code {
      display: inline-block;
      margin-top: 4px;
      font-family: monospace;
      font-size: 11px;
      font-weight: 800;
      color: #0F4C5C;
      background: #EAF4F8;
      border: 1px solid #BAE6FD;
      border-radius: 6px;
      padding: 2px 6px;
      width: fit-content;
    }
    .foot { font-size: 8px; color: #64748B; margin-top: 3px; }
    .qr-box svg { width: 28mm !important; height: 28mm !important; }
    .note { font-size: 11px; color: #475569; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="note no-print">مقاس البطاقة القياسي (8.5 × 5.4 سم) — قص على الخط المنقط وغلّفه حرارياً لتعليقه في شنطة السباحة</div>
  <div class="cut-guide">
    <div class="bag-card">
      <div class="lanyard-slot"></div>
      <div class="spine">بطاقة كابتنلي</div>
      <div class="body">
        <div class="meta">
          <div class="club">${safeFacilityName}</div>
          <div class="name">${safeAthleteName}</div>
          <div class="track">${safeCoachOrEntity} • ${safeTotalSessions} حصص</div>
          <div class="code">${safeSubCode}</div>
          <div class="foot">بطاقة حضور الحوض — بدون إنترنت</div>
        </div>
        <div class="qr-box">${qrSvgHtml}</div>
      </div>
    </div>
  </div>
</body>
</html>`);
    printWin.document.close();
    window.setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch {
        // Ignore cross-window print cancellation
      }
    }, 180);
  };

  const handleShareWhatsapp = () => {
    const text = [
      `بطاقة حضور كابتنلي (QR)`,
      `السبّاح: ${ledger.athleteNameAr}`,
      `المنشأة: ${ledger.facilityNameAr}`,
      `كود الاشتراك: ${subCode}`,
      `الحصص المتبقية: ${remaining} من ${ledger.totalSessions}`,
      `رابط المسح المباشر: ${qrValue}`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 bg-gradient-to-l from-[#0F4C5C] to-[#1D6E7D] text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <Icon name="badge" className="text-[22px]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">كارت حقيبة السباحة للطباعة (8.5×5.4 سم)</h3>
              <p className="text-[11px] text-white/80">
                حل عملي للأطفال بدون هاتف — يُطبع ويُعلّق في شنطة السباحة للمسح عند البوابة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
            aria-label="إغلاق"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 bg-[#F7F9FA]">
          {/* Realistic CR80 Laminated Card Mockup */}
          <div className="border-2 border-dashed border-[#94A3B8]/60 rounded-2xl p-3 bg-white flex items-center justify-center">
            <div className="relative w-full max-w-[360px] rounded-xl border border-[#CBD5E1] bg-white shadow-md overflow-hidden flex min-h-[195px]">
              {/* Lanyard slot graphic */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-2.5 rounded-full bg-[#E2E8F0] border border-[#CBD5E1]" />

              {/* Side Teal Spine */}
              <div className="w-10 bg-gradient-to-b from-[#0F4C5C] to-[#1D6E7D] text-white flex items-center justify-center shrink-0">
                <span className="[writing-mode:vertical-rl] text-[10px] font-extrabold tracking-wide">
                  بطاقة كابتنلي
                </span>
              </div>

              <div className="flex-1 p-4 pt-6 flex items-center justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#1D6E7D] truncate">
                    {ledger.facilityNameAr}
                  </span>
                  <h4 className="font-extrabold text-sm text-[#0F172A] truncate">
                    {ledger.athleteNameAr}
                  </h4>
                  <span className="text-[10px] text-[#64748B] truncate">
                    {ledger.linkedEntityNameAr || ledger.coachNameAr}
                  </span>
                  <span className="mt-1 inline-block w-fit font-mono text-xs font-black text-[#0F4C5C] bg-[#EAF4F8] border border-[#1D6E7D]/25 px-2.5 py-0.5 rounded-lg">
                    {subCode}
                  </span>
                  <span className="text-[9px] text-[#64748B] mt-1">
                    الرصيد عند الإصدار: {ledger.totalSessions} حصص
                  </span>
                </div>

                <div id={`printable-bag-qr-${ledger.id}`} className="shrink-0">
                  <QrCodeBox value={qrValue} size={96} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#EAF4F8] border border-[#1D6E7D]/15 px-3.5 py-2.5 text-[11px] text-[#0F4C5C] font-bold">
            اطبع البطاقة أو احفظها كملف PDF وضعها داخل كيس بلاستيكي/تغليف حراري على شنطة السباحة ليتمكن مشرف البوابة من مسحها يومياً.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="py-3 px-4 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Icon name="picture_as_pdf" className="text-[18px]" />
              <span>طباعة / تحميل PDF للكارت</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsapp}
              className="py-3 px-4 rounded-xl bg-white hover:bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/25 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="share" className="text-[18px]" />
              <span>مشاركة بيانات الكارت عبر واتساب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
