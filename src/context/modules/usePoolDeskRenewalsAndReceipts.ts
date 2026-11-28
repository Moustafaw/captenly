"use client";

import type {
  NotificationItem,
  SessionLedger,
} from "@/types/captenly";
import { upsertLedgerInOfflineShiftSnapshot } from "@/lib/offlineShiftDb";
import { syncToSupabase, type SyncResult } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";

function mergeServerLedgerPreservingPin(
  localLedger: SessionLedger,
  serverData?: Record<string, unknown>
): SessionLedger {
  const remote = serverData?.ledger as SessionLedger | undefined;
  if (!remote || typeof remote !== "object") return localLedger;
  return {
    ...remote,
    pinCode:
      remote.pinCode === "****" && localLedger.pinCode && localLedger.pinCode !== "****"
        ? localLedger.pinCode
        : remote.pinCode,
  };
}

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
  const parseRenewalInput = (
    ledgerIdOrPayload:
      | string
      | {
          ledgerId: string;
          totalSessions?: 8 | 12 | 24;
          packageTitleAr?: string;
          amountEgp?: number;
          pricingSnapshot?: SessionLedger["pricingSnapshot"];
        },
    totalSessionsArg?: 8 | 12 | 24,
    amountEgpArg?: number
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
    return { ledgerId, totalSessions, customTitle, amountEgp, customSnapshot };
  };

  const buildEnrollPayloadFromOldLedger = (
    oldLedger: SessionLedger,
    parsed: ReturnType<typeof parseRenewalInput>
  ) => {
    const lastReceiptAmount = oldLedger.receipts[0]?.amountEgp || 0;
    return {
      memberCode: oldLedger.memberCode || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
      athleteNameAr: oldLedger.athleteNameAr,
      facilityId: oldLedger.facilityId,
      coachId: oldLedger.coachId,
      linkedEntityId: oldLedger.linkedEntityId,
      linkedEntityNameAr: oldLedger.linkedEntityNameAr,
      agreementTypeAtEnroll: oldLedger.agreementTypeAtEnroll,
      pricingSnapshot: parsed.customSnapshot || oldLedger.pricingSnapshot,
      trackType: oldLedger.trackType || ("school" as const),
      trackLabelAr: oldLedger.trackLabelAr,
      packageTitleAr: parsed.customTitle || oldLedger.packageTitleAr,
      totalSessions: parsed.totalSessions || oldLedger.totalSessions,
      amountEgp: parsed.amountEgp !== undefined ? parsed.amountEgp : lastReceiptAmount,
      isMinor: oldLedger.isMinor,
      parentNameAr: oldLedger.parentNameAr,
    };
  };

  const renewSwimmerSubscriptionAsync: NonNullable<
    CaptenlyContextType["renewSwimmerSubscriptionAsync"]
  > = async (ledgerIdOrPayload, totalSessionsArg, amountEgpArg) => {
    const parsed = parseRenewalInput(ledgerIdOrPayload, totalSessionsArg, amountEgpArg);
    const oldLedger = sessionLedgers.find((l) => l.id === parsed.ledgerId);
    if (!oldLedger) return { ok: false, messageAr: "الاشتراك المطلوب تجديده غير موجود." };

    const closedOldLedger: SessionLedger = { ...oldLedger, status: "completed", isCodeExpired: true };

    if (!effectiveOffline) {
      const closeSync = await syncToSupabase("/api/supabase/session-ledgers", {
        ledger: closedOldLedger,
      });
      if (!closeSync.ok) {
        pushNotification({
          titleAr: "تعذر إغلاق الاشتراك السابق سحابياً",
          messageAr:
            closeSync.messageAr || "فشلت مزامنة إنهاء الاشتراك القديم مع السيرفر — لم يتم التجديد.",
          type: "system",
          actionHref: "/dashboard/ledger",
        });
        return {
          ok: false,
          messageAr: closeSync.messageAr || "تعذر إغلاق الاشتراك السابق على السيرفر.",
          syncResult: closeSync,
        };
      }
    }

    setSessionLedgers((prev) =>
      prev.map((l) => (l.id === parsed.ledgerId ? closedOldLedger : l))
    );
    const enrollRes = enrollSwimmerByMemberCode(buildEnrollPayloadFromOldLedger(oldLedger, parsed));
    if (!enrollRes.ok || !enrollRes.ledger) {
      return enrollRes;
    }

    if (!effectiveOffline) {
      const enrollSync = await syncToSupabase("/api/supabase/session-ledgers", {
        ledger: enrollRes.ledger,
      });
      if (!enrollSync.ok) {
        if (
          enrollSync.category === "auth" ||
          enrollSync.category === "forbidden" ||
          enrollSync.category === "validation"
        ) {
          setSessionLedgers((prev) =>
            prev
              .filter((l) => l.id !== enrollRes.ledger?.id)
              .map((l) => (l.id === parsed.ledgerId ? oldLedger : l))
          );
        }
        pushNotification({
          titleAr: "تعذر حفظ الاشتراك المتجدد على السيرفر",
          messageAr: enrollSync.messageAr || "رفض السيرفر تسجيل الاشتراك الجديد.",
          type: "system",
          actionHref: "/dashboard/ledger",
        });
        return {
          ok: false,
          messageAr: enrollSync.messageAr || "تعذر حفظ الاشتراك الجديد على السيرفر.",
          syncResult: enrollSync,
        };
      }

      const syncedNew = mergeServerLedgerPreservingPin(enrollRes.ledger, enrollSync.data);
      setSessionLedgers((prev) =>
        prev.map((l) => (l.id === syncedNew.id ? syncedNew : l))
      );
      void upsertLedgerInOfflineShiftSnapshot(closedOldLedger.facilityId, closedOldLedger);
      void upsertLedgerInOfflineShiftSnapshot(syncedNew.facilityId, syncedNew);
      return {
        ok: true,
        ledger: syncedNew,
        messageAr: enrollRes.messageAr,
        syncResult: enrollSync,
      };
    }

    void upsertLedgerInOfflineShiftSnapshot(closedOldLedger.facilityId, closedOldLedger);
    void upsertLedgerInOfflineShiftSnapshot(enrollRes.ledger.facilityId, enrollRes.ledger);
    return {
      ok: true,
      ledger: enrollRes.ledger,
      messageAr: `${enrollRes.messageAr} (محفوظ أوفلاين للمزامنة لاحقاً)`,
    };
  };

  const renewSwimmerSubscription: CaptenlyContextType["renewSwimmerSubscription"] = (
    ledgerIdOrPayload,
    totalSessionsArg,
    amountEgpArg
  ) => {
    const parsed = parseRenewalInput(ledgerIdOrPayload, totalSessionsArg, amountEgpArg);
    const oldLedger = sessionLedgers.find((l) => l.id === parsed.ledgerId);
    if (!oldLedger) return { ok: false, messageAr: "الاشتراك المطلوب تجديده غير موجود." };

    const closedOldLedger: SessionLedger = { ...oldLedger, status: "completed", isCodeExpired: true };
    setSessionLedgers((prev) =>
      prev.map((l) => (l.id === parsed.ledgerId ? closedOldLedger : l))
    );
    void upsertLedgerInOfflineShiftSnapshot(closedOldLedger.facilityId, closedOldLedger);

    if (!effectiveOffline) {
      void syncToSupabase("/api/supabase/session-ledgers", { ledger: closedOldLedger }).then(
        (res) => {
          if (!res.ok) {
            if (res.category === "auth" || res.category === "forbidden") {
              setSessionLedgers((prev) =>
                prev.map((l) => (l.id === parsed.ledgerId ? oldLedger : l))
              );
            }
            pushNotification({
              titleAr: "تعذر مزامنة إغلاق الاشتراك السابق",
              messageAr: res.messageAr || "فشل تحديث حالة الاشتراك القديم على السيرفر.",
              type: "system",
              actionHref: "/dashboard/ledger",
            });
          }
        }
      );
    }

    return enrollSwimmerByMemberCode(buildEnrollPayloadFromOldLedger(oldLedger, parsed));
  };

  const uploadInstaPayReceiptAsync: NonNullable<
    CaptenlyContextType["uploadInstaPayReceiptAsync"]
  > = async (ledgerId, payload) => {
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) {
      return { ok: false, messageAr: "دفتر الحصص غير موجود." };
    }

    const newReceiptId = `rcp-${Date.now()}`;
    const updated: SessionLedger = {
      ...targetLedger,
      receipts: [
        {
          id: newReceiptId,
          referenceNumber: payload.referenceNumber,
          channel: payload.channel,
          amountEgp: payload.amountEgp,
          uploadedDateAr: effectiveOffline
            ? "محفوظ أوفلاين — بانتظار المزامنة والمراجعة"
            : "بانتظار مراجعة وتأكيد الحسابات",
          confirmedByProvider: false,
          packageTitleAr: payload.packageTitleAr,
        },
        ...targetLedger.receipts,
      ],
    };

    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? updated : l)));

    if (effectiveOffline) {
      await upsertLedgerInOfflineShiftSnapshot(updated.facilityId, updated);
      return {
        ok: true,
        ledger: updated,
        messageAr: "تم حفظ الإيصال محلياً (أوفلاين) وسيتم رفعه عند عودة الاتصال.",
      };
    }

    const res: SyncResult = await syncToSupabase("/api/supabase/session-ledgers", {
      ledger: updated,
    });

    if (!res.ok) {
      setSessionLedgers((prev) =>
        prev.map((l) =>
          l.id === ledgerId
            ? { ...l, receipts: l.receipts.filter((r) => r.id !== newReceiptId) }
            : l
        )
      );
      pushNotification({
        titleAr: "تعذر رفع إيصال الدفع للسيرفر",
        messageAr: res.messageAr || "فشل حفظ مرجع التحويل على السيرفر — يرجى المحاولة مجدداً.",
        type: "system",
        actionHref: "/dashboard/ledger",
      });
      return {
        ok: false,
        messageAr: res.messageAr || "تعذر رفع الإيصال على السيرفر.",
        syncResult: res,
      };
    }

    const merged = mergeServerLedgerPreservingPin(updated, res.data);
    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? merged : l)));
    void upsertLedgerInOfflineShiftSnapshot(merged.facilityId, merged);
    return {
      ok: true,
      ledger: merged,
      messageAr: "تم إرفاق إيصال الدفع ومزامنته مع السيرفر بنجاح ✓",
      syncResult: res,
    };
  };

  const uploadInstaPayReceipt: CaptenlyContextType["uploadInstaPayReceipt"] = (
    ledgerId,
    payload
  ) => {
    void uploadInstaPayReceiptAsync(ledgerId, payload);
  };

  const confirmReceiptByProviderAsync: NonNullable<
    CaptenlyContextType["confirmReceiptByProviderAsync"]
  > = async (ledgerId, receiptId) => {
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) {
      return { ok: false, messageAr: "دفتر الحصص غير موجود." };
    }
    const targetReceipt = targetLedger.receipts.find((r) => r.id === receiptId);
    if (!targetReceipt) {
      return { ok: false, messageAr: "الإيصال المطلوب تأكيده غير موجود." };
    }
    if (effectiveOffline) {
      return {
        ok: false,
        messageAr: "تأكيد ومطابقة الإيصال المالي يتطلب اتصالاً بالإنترنت لتوثيقه سحابياً.",
      };
    }

    const updated: SessionLedger = {
      ...targetLedger,
      receipts: targetLedger.receipts.map((r) =>
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

    const res = await syncToSupabase("/api/supabase/session-ledgers", { ledger: updated });
    if (!res.ok) {
      pushNotification({
        titleAr: "تعذر تأكيد الإيصال المالي",
        messageAr: res.messageAr || "رفض السيرفر اعتماد مطابقة الإيصال — تحقق من الصلاحيات.",
        type: "system",
        actionHref: "/dashboard/ledger",
      });
      return {
        ok: false,
        messageAr: res.messageAr || "تعذر تأكيد مطابقة الإيصال على السيرفر.",
        syncResult: res,
      };
    }

    const merged = mergeServerLedgerPreservingPin(updated, res.data);
    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? merged : l)));
    void upsertLedgerInOfflineShiftSnapshot(merged.facilityId, merged);

    pushNotification({
      titleAr: "تم تأكيد مطابقة الإيصال المالي",
      messageAr: "اعتمد فريق الحسابات إيصال الدفع بنجاح وتحديث سجل المدفوعات سحابياً.",
      type: "school_card",
      actionHref: "/dashboard/ledger",
    });
    return {
      ok: true,
      messageAr: "تم تأكيد مطابقة الإيصال المالي وتحديث سجل الحسابات ✓",
      syncResult: res,
    };
  };

  const confirmReceiptByProvider: CaptenlyContextType["confirmReceiptByProvider"] = (
    ledgerId,
    receiptId
  ) => {
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) {
      return { ok: false, messageAr: "دفتر الحصص غير موجود." };
    }
    const targetReceipt = targetLedger.receipts.find((r) => r.id === receiptId);
    if (!targetReceipt) {
      return { ok: false, messageAr: "الإيصال المطلوب تأكيده غير موجود." };
    }
    if (effectiveOffline) {
      return {
        ok: false,
        messageAr: "تأكيد ومطابقة الإيصال المالي يتطلب اتصالاً بالإنترنت لتوثيقه سحابياً.",
      };
    }

    const updated: SessionLedger = {
      ...targetLedger,
      receipts: targetLedger.receipts.map((r) =>
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

    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? updated : l)));

    void syncToSupabase("/api/supabase/session-ledgers", { ledger: updated }).then((res) => {
      if (!res.ok) {
        setSessionLedgers((prev) =>
          prev.map((l) =>
            l.id === ledgerId
              ? {
                  ...l,
                  receipts: l.receipts.map((r) => (r.id === receiptId ? targetReceipt : r)),
                }
              : l
          )
        );
        pushNotification({
          titleAr: "فشل تأكيد الإيصال المالي سحابياً",
          messageAr: res.messageAr || "رفض السيرفر تأكيد مطابقة الإيصال وتم التراجع عن التعديل.",
          type: "system",
          actionHref: "/dashboard/ledger",
        });
        return;
      }

      const merged = mergeServerLedgerPreservingPin(updated, res.data);
      setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? merged : l)));
      void upsertLedgerInOfflineShiftSnapshot(merged.facilityId, merged);
      pushNotification({
        titleAr: "تم تأكيد مطابقة الإيصال المالي",
        messageAr: "اعتمد فريق الحسابات إيصال الدفع بنجاح وتحديث سجل المدفوعات سحابياً.",
        type: "school_card",
        actionHref: "/dashboard/ledger",
      });
    });

    return { ok: true, messageAr: "جاري تأكيد ومزامنة الإيصال المالي مع السيرفر..." };
  };

  return {
    renewSwimmerSubscription,
    renewSwimmerSubscriptionAsync,
    uploadInstaPayReceipt,
    uploadInstaPayReceiptAsync,
    confirmReceiptByProvider,
    confirmReceiptByProviderAsync,
  };
}
