"use client";

import type {
  NotificationItem,
  SessionLedger,
} from "@/types/captenly";
import { postSupabaseSync } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";

export function createPoolDeskRenewalsAndReceipts({
  sessionLedgers,
  setSessionLedgers,
  effectiveOffline,
  enrollSwimmerByMemberCode,
  pushNotification,
}: {
  sessionLedgers: SessionLedger[];
  setSessionLedgers: React.Dispatch<React.SetStateAction<SessionLedger[]>>;
  effectiveOffline: boolean;
  enrollSwimmerByMemberCode: CaptenlyContextType["enrollSwimmerByMemberCode"];
  pushNotification: (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => void;
}) {
  const renewSwimmerSubscription: CaptenlyContextType["renewSwimmerSubscription"] = (
    ledgerIdOrPayload,
    totalSessionsArg,
    amountEgpArg
  ) => {
    const ledgerId =
      typeof ledgerIdOrPayload === "string" ? ledgerIdOrPayload : ledgerIdOrPayload.ledgerId;
    const totalSessions =
      typeof ledgerIdOrPayload === "string"
        ? totalSessionsArg
        : ledgerIdOrPayload.totalSessions || totalSessionsArg;
    const customTitle =
      typeof ledgerIdOrPayload === "string" ? undefined : ledgerIdOrPayload.packageTitleAr;
    const amountEgp =
      typeof ledgerIdOrPayload === "string"
        ? amountEgpArg
        : ledgerIdOrPayload.amountEgp !== undefined
          ? ledgerIdOrPayload.amountEgp
          : amountEgpArg;
    const customSnapshot =
      typeof ledgerIdOrPayload === "string" ? undefined : ledgerIdOrPayload.pricingSnapshot;

    const oldLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!oldLedger) return { ok: false, messageAr: "الاشتراك المطلوب تجديده غير موجود." };

    const closedOldLedger: SessionLedger = { ...oldLedger, status: "completed", isCodeExpired: true };
    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? closedOldLedger : l)));
    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/session-ledgers", { ledger: closedOldLedger });
    }

    const lastReceiptAmount = oldLedger.receipts[0]?.amountEgp || 0;
    return enrollSwimmerByMemberCode({
      memberCode: oldLedger.memberCode || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
      athleteNameAr: oldLedger.athleteNameAr,
      facilityId: oldLedger.facilityId,
      coachId: oldLedger.coachId,
      linkedEntityId: oldLedger.linkedEntityId,
      linkedEntityNameAr: oldLedger.linkedEntityNameAr,
      agreementTypeAtEnroll: oldLedger.agreementTypeAtEnroll,
      pricingSnapshot: customSnapshot || oldLedger.pricingSnapshot,
      trackType: oldLedger.trackType || "school",
      trackLabelAr: oldLedger.trackLabelAr,
      packageTitleAr: customTitle || oldLedger.packageTitleAr,
      totalSessions: totalSessions || oldLedger.totalSessions,
      amountEgp: amountEgp !== undefined ? amountEgp : lastReceiptAmount,
      isMinor: oldLedger.isMinor,
      parentNameAr: oldLedger.parentNameAr,
    });
  };

  const uploadInstaPayReceipt: CaptenlyContextType["uploadInstaPayReceipt"] = (
    ledgerId,
    payload
  ) => {
    setSessionLedgers((prev) =>
      prev.map((l) => {
        if (l.id !== ledgerId) return l;
        const updated: SessionLedger = {
          ...l,
          receipts: [
            {
              id: `rcp-${Date.now()}`,
              referenceNumber: payload.referenceNumber,
              channel: payload.channel,
              amountEgp: payload.amountEgp,
              uploadedDateAr: "بانتظار مراجعة وتأكيد الحسابات",
              confirmedByProvider: false,
              packageTitleAr: payload.packageTitleAr,
            },
            ...l.receipts,
          ],
        };
        if (!effectiveOffline) postSupabaseSync("/api/supabase/session-ledgers", { ledger: updated });
        return updated;
      })
    );
  };

  const confirmReceiptByProvider: CaptenlyContextType["confirmReceiptByProvider"] = (
    ledgerId,
    receiptId
  ) => {
    setSessionLedgers((prev) =>
      prev.map((l) => {
        if (l.id !== ledgerId) return l;
        const updated: SessionLedger = {
          ...l,
          receipts: l.receipts.map((r) =>
            r.id === receiptId
              ? {
                  ...r,
                  confirmedByProvider: true,
                  uploadedDateAr: r.uploadedDateAr.includes("مؤكد")
                    ? r.uploadedDateAr
                    : "تم التأكيد والمطابقة ✓",
                }
              : r
          ),
        };
        if (!effectiveOffline) postSupabaseSync("/api/supabase/session-ledgers", { ledger: updated });
        return updated;
      })
    );
    pushNotification({
      titleAr: "تم تأكيد مطابقة الإيصال المالي",
      messageAr: "اعتمد فريق الحسابات إيصال الدفع بنجاح وتحديث سجل المدفوعات.",
      type: "school_card",
      actionHref: "/dashboard/ledger",
    });
    return { ok: true, messageAr: "تم تأكيد مطابقة الإيصال المالي وتحديث سجل الحسابات ✓" };
  };

  return {
    renewSwimmerSubscription,
    uploadInstaPayReceipt,
    confirmReceiptByProvider,
  };
}
