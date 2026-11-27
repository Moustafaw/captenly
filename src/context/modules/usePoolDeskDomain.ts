"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Coach,
  Facility,
  FacilityLinkedEntity,
  FacilityStaffMember,
  MemberRegistryEntry,
  MinorAthleteProfile,
  NotificationItem,
  OfflineCheckinQueueItem,
  PersonaAccount,
  SessionLedger,
  SyncStatusSummary,
} from "@/types/captenly";
import { INITIAL_SESSION_LEDGERS } from "@/data/seedData";
import {
  mergeSessionLedgers,
  readAllOfflineShiftSnapshots,
  readOfflineShiftSnapshot,
  upsertLedgerInOfflineShiftSnapshot,
} from "@/lib/offlineShiftDb";
import { syncToSupabase } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";
import { createPoolDeskLinksAndConfigActions } from "./usePoolDeskLinksAndConfig";
import { createPoolDeskCheckinActions } from "./usePoolDeskCheckins";

export interface PoolDeskDomainDeps {
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  allPersonas: PersonaAccount[];
  memberRegistry: MemberRegistryEntry[];
  setMemberRegistry: React.Dispatch<React.SetStateAction<MemberRegistryEntry[]>>;
  minorAthletes: MinorAthleteProfile[];
  activeStaffAssignment: FacilityStaffMember | null;
  resolvedActiveStaffFacilityId?: string;
  pushNotification: (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => void;
}

export function usePoolDeskDomain({
  facilities,
  setFacilities,
  coaches,
  updateFacilityAndSync,
  isAuthenticated,
  currentPersona,
  resolvedActiveStaffFacilityId,
  depsRef,
}: {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  coaches: Coach[];
  updateFacilityAndSync: (facilityId: string, updater: (f: Facility) => Facility) => void;
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  resolvedActiveStaffFacilityId?: string;
  depsRef: React.MutableRefObject<PoolDeskDomainDeps>;
}) {
  const isOfflineSimulated = false;
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(false);
  const [sessionLedgers, setSessionLedgers] = useState<SessionLedger[]>(INITIAL_SESSION_LEDGERS);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckinQueueItem[]>([]);
  const [facilityLinks, setFacilityLinks] = useState<FacilityLinkedEntity[]>([]);
  const [lastSyncedAtIso, setLastSyncedAtIso] = useState<string | undefined>(undefined);
  const effectiveOffline = isBrowserOffline;

  const isSyncingRef = useRef(false);
  const hasServerSyncedRef = useRef(false);
  const sessionLedgersRef = useRef<SessionLedger[]>(sessionLedgers);
  sessionLedgersRef.current = sessionLedgers;
  const offlineQueueRef = useRef<OfflineCheckinQueueItem[]>(offlineQueue);
  offlineQueueRef.current = offlineQueue;
  const effectiveOfflineRef = useRef<boolean>(effectiveOffline);
  effectiveOfflineRef.current = effectiveOffline;
  const wasOfflineRef = useRef<boolean>(effectiveOffline);

  // Real PWA Service Worker registration (deferred to browser idle) + online/offline network listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsBrowserOffline(!navigator.onLine);
    const handleOnline = () => setIsBrowserOffline(false);
    const handleOffline = () => setIsBrowserOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const registerSw = () => {
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    };

    if ("requestIdleCallback" in window) {
      idleHandle = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(registerSw, { timeout: 3500 });
    } else {
      timeoutHandle = setTimeout(registerSw, 2500);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (idleHandle !== null && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(
          idleHandle
        );
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, []);

  const mergeRemoteLedgers = (incoming: SessionLedger[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setSessionLedgers((prev) => {
      const byId = new Map(prev.map((l) => [l.id, l]));
      for (const remote of incoming) {
        const local = byId.get(remote.id);
        if (!local) {
          byId.set(remote.id, remote);
        } else {
          const localProgress = local.completedSessions + local.receipts.length;
          const remoteProgress = remote.completedSessions + remote.receipts.length;
          const resolved =
            localProgress > remoteProgress
              ? local
              : {
                  ...remote,
                  pinCode:
                    remote.pinCode === "****" && local.pinCode && local.pinCode !== "****"
                      ? local.pinCode
                      : remote.pinCode,
                };
          byId.set(remote.id, resolved);
        }
      }
      return Array.from(byId.values());
    });

    // Keep any existing IndexedDB shift snapshot aligned with canonical server ledgers
    void (async () => {
      const checkedFacilities = new Map<string, boolean>();
      for (const remote of incoming) {
        if (!remote?.facilityId) continue;
        let hasSnap = checkedFacilities.get(remote.facilityId);
        if (hasSnap === undefined) {
          hasSnap = Boolean(await readOfflineShiftSnapshot(remote.facilityId));
          checkedFacilities.set(remote.facilityId, hasSnap);
        }
        if (hasSnap) {
          await upsertLedgerInOfflineShiftSnapshot(remote.facilityId, remote);
        }
      }
    })();
  };

  const lookupRemoteLedgersOrProfile: CaptenlyContextType["lookupRemoteLedgersOrProfile"] = async (
    query
  ) => {
    const params = new URLSearchParams();
    if (query.memberCode) params.set("memberCode", query.memberCode.trim().toUpperCase());
    if (query.ledgerCode) params.set("ledgerCode", query.ledgerCode.trim().toUpperCase());
    if (query.coachId) params.set("coachId", query.coachId.trim());
    if (query.facilityId) params.set("facilityId", query.facilityId.trim());
    if (!params.toString()) return { ledgers: [], profile: null };

    try {
      const res = await fetch(`/api/supabase/session-ledgers?${params.toString()}`);
      if (!res.ok) return { ledgers: [], profile: null };
      const data = await res.json();
      const ledgers = Array.isArray(data?.ledgers) ? (data.ledgers as SessionLedger[]) : [];
      if (ledgers.length > 0) mergeRemoteLedgers(ledgers);

      const profile = data?.profile || null;
      if (profile?.memberCode && profile?.fullNameAr) {
        depsRef.current.setMemberRegistry((prev) => {
          if (prev.some((m) => m.memberCode.toUpperCase() === profile.memberCode.toUpperCase())) {
            return prev;
          }
          return [
            {
              memberCode: profile.memberCode,
              athleteId: `member-${profile.memberCode}`,
              fullNameAr: profile.fullNameAr,
              phone: profile.phone || "",
              city: profile.city || "مصر",
              role: profile.role === "parent" ? "parent" : "adult_athlete",
            },
            ...prev,
          ];
        });
      }
      return { ledgers, profile };
    } catch {
      return { ledgers: [], profile: null };
    }
  };

  const syncLedgersFromServer = async () => {
    const {
      isAuthenticated: authed,
      currentPersona: persona,
      resolvedActiveStaffFacilityId: staffFacId,
    } = depsRef.current;
    if (!authed || effectiveOfflineRef.current) return;
    hasServerSyncedRef.current = true;
    await lookupRemoteLedgersOrProfile({
      memberCode: persona.memberCode || undefined,
      coachId: persona.linkedCoachId || (persona.role === "coach" ? persona.id : undefined),
      facilityId: persona.linkedFacilityId || staffFacId || undefined,
    });
  };

  // GAP-006: Hydrate sessionLedgers from IndexedDB on mount when localStorage sessionLedgers is empty
  // (never overwrites newer server state when online).
  useEffect(() => {
    let cancelled = false;
    void readAllOfflineShiftSnapshots().then((snapshots) => {
      if (cancelled || snapshots.length === 0) return;
      const idbLedgers = snapshots.flatMap((s) => (Array.isArray(s.ledgers) ? s.ledgers : []));
      if (idbLedgers.length === 0) return;

      setSessionLedgers((prev) => {
        if (prev.length === 0) {
          return mergeSessionLedgers([], idbLedgers, "higher_progress");
        }
        if (hasServerSyncedRef.current && !effectiveOfflineRef.current) {
          // Only add ledgers that aren't present on server yet (e.g. unsynced offline enrollments)
          const existingIds = new Set(prev.map((l) => l.id));
          const missing = idbLedgers.filter((l) => !existingIds.has(l.id));
          return missing.length > 0 ? [...prev, ...missing] : prev;
        }
        return mergeSessionLedgers(prev, idbLedgers, "higher_progress");
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalize any queue items interrupted mid-sync before a reload
  useEffect(() => {
    if (!isSyncingRef.current && offlineQueue.some((q) => q.syncStatus === "syncing")) {
      setOfflineQueue((prev) =>
        prev.map((q) => (q.syncStatus === "syncing" ? { ...q, syncStatus: "pending" } : q))
      );
    }
  }, [offlineQueue]);

  // GAP-006: Keep IndexedDB shift snapshot synchronized whenever offline check-ins/enrollments occur
  useEffect(() => {
    const unsyncedLedgerIds = new Set(
      offlineQueue.filter((q) => !q.synced).map((q) => q.ledgerId)
    );
    if (unsyncedLedgerIds.size === 0) return;
    for (const ledgerId of unsyncedLedgerIds) {
      const ledger = sessionLedgers.find((l) => l.id === ledgerId);
      if (ledger?.facilityId) {
        void upsertLedgerInOfflineShiftSnapshot(ledger.facilityId, ledger);
      }
    }
  }, [offlineQueue, sessionLedgers]);

  const linksActions = createPoolDeskLinksAndConfigActions({
    facilities,
    setFacilities,
    coaches,
    facilityLinks,
    setFacilityLinks,
    updateFacilityAndSync,
    effectiveOffline,
    getAuthContext: () => ({
      isAuthenticated: depsRef.current.isAuthenticated,
      currentPersona: depsRef.current.currentPersona,
      resolvedActiveStaffFacilityId: depsRef.current.resolvedActiveStaffFacilityId,
    }),
  });

  const checkinActions = createPoolDeskCheckinActions({
    facilities,
    setFacilities,
    coaches,
    facilityLinks,
    sessionLedgers,
    setSessionLedgers,
    setOfflineQueue,
    effectiveOffline,
    updateFacilityPoolDeskConfig: linksActions.updateFacilityPoolDeskConfig,
    getDeps: () => depsRef.current,
  });

  // Auto-sync ledgers and facility links on login or window focus

  useEffect(() => {
    if (!isAuthenticated || effectiveOffline) return;
    syncLedgersFromServer();
    linksActions.refreshFacilityLinks();
    const onFocus = () => {
      syncLedgersFromServer();
      linksActions.refreshFacilityLinks();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    currentPersona.id,
    currentPersona.memberCode,
    currentPersona.linkedFacilityId,
    currentPersona.linkedCoachId,
    resolvedActiveStaffFacilityId,
    effectiveOffline,
  ]);

  const buildCloudCandidateLedger = (
    ledger: SessionLedger,
    item: OfflineCheckinQueueItem
  ): SessionLedger => {
    const eventId = item.clientEventId || item.id;
    return {
      ...ledger,
      startedDateAr: ledger.startedDateAr.includes("محفوظ أوفلاين")
        ? ledger.startedDateAr
            .replace("اليوم — محفوظ أوفلاين (سيتم المزامنة تلقائياً)", "اليوم — تمت المزامنة سحابياً ✓")
            .replace("اليوم — محفوظ أوفلاين (سيتم الرفع عند عودة النت)", "اليوم — تمت المزامنة سحابياً ✓")
        : ledger.startedDateAr,
      checkins: ledger.checkins.map((c) => {
        const matchesItem = item.kind !== "enrollment" && c.sessionNumber === item.sessionNumber;
        const nextCheckin =
          matchesItem && !c.clientEventId ? { ...c, clientEventId: eventId } : c;
        if (nextCheckin.wasOffline && nextCheckin.dateAr.includes("محفوظ أوفلاين")) {
          return {
            ...nextCheckin,
            dateAr: nextCheckin.dateAr.replace(
              "محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً",
              "تمت المزامنة سحابياً بنجاح ✓"
            ),
          };
        }
        return nextCheckin;
      }),
    };
  };

  const replayOfflineQueue = async (forceRetryFailed: boolean) => {
    if (isSyncingRef.current) {
      return { attempted: 0, syncedCount: 0, failedCount: 0 };
    }
    if (effectiveOfflineRef.current) {
      return {
        attempted: 0,
        syncedCount: 0,
        failedCount: 0,
        stoppedReason: "offline" as const,
        lastErrorAr: "الجهاز غير متصل بالإنترنت — ستبدأ المزامنة عند استقرار الاتصال.",
      };
    }

    if (forceRetryFailed) {
      setOfflineQueue((prev) =>
        prev.map((q) =>
          !q.synced
            ? {
                ...q,
                syncStatus: "pending",
                retryCount: 0,
                lastErrorCode: undefined,
                lastErrorAr: undefined,
              }
            : q
        )
      );
    }

    const eligible = offlineQueueRef.current.filter(
      (q) => !q.synced && (forceRetryFailed || (q.retryCount ?? 0) < 5)
    );
    if (eligible.length === 0) {
      return { attempted: 0, syncedCount: 0, failedCount: 0 };
    }

    // Replay oldest queued events first to preserve session check-in ordering
    const orderedItems = [...eligible].reverse();
    isSyncingRef.current = true;
    let syncedCount = 0;
    let failedCount = 0;
    let stoppedReason: "offline" | "auth" | "forbidden" | "conflict" | undefined;
    let lastErrorAr: string | undefined;
    let notifiedAuthStop = false;

    try {
      for (const item of orderedItems) {
        if (effectiveOfflineRef.current) {
          stoppedReason = "offline";
          lastErrorAr = "انقطع الاتصال بالإنترنت أثناء المزامنة.";
          break;
        }

        const eventId = item.clientEventId || item.id;
        setOfflineQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, clientEventId: eventId, syncStatus: "syncing" } : q
          )
        );

        const targetLedger = sessionLedgersRef.current.find((l) => l.id === item.ledgerId);
        if (!targetLedger) {
          const msg = "تعذر العثور على دفتر الحصص المرتبط بالعملية المحفوظة.";
          lastErrorAr = msg;
          failedCount += 1;
          setOfflineQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    synced: false,
                    syncStatus: "failed",
                    retryCount: Math.min(5, (q.retryCount ?? 0) + 1),
                    lastErrorCode: "ledger_not_found",
                    lastErrorAr: msg,
                  }
                : q
            )
          );
          continue;
        }

        const candidateLedger = buildCloudCandidateLedger(targetLedger, item);
        const res = await syncToSupabase("/api/supabase/session-ledgers", {
          ledger: candidateLedger,
          clientEventId: eventId,
        });

        const persistedOk = res.ok && res.data?.persisted === true;
        if (persistedOk) {
          const remoteLedger = res.data?.ledger as SessionLedger | undefined;
          const resolvedLedger: SessionLedger =
            remoteLedger && typeof remoteLedger === "object"
              ? {
                  ...remoteLedger,
                  pinCode:
                    remoteLedger.pinCode === "****" &&
                    candidateLedger.pinCode &&
                    candidateLedger.pinCode !== "****"
                      ? candidateLedger.pinCode
                      : remoteLedger.pinCode,
                }
              : candidateLedger;

          setSessionLedgers((prev) =>
            prev.map((l) => (l.id === resolvedLedger.id ? resolvedLedger : l))
          );
          setOfflineQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    clientEventId: eventId,
                    synced: true,
                    syncStatus: "synced",
                    lastErrorCode: undefined,
                    lastErrorAr: undefined,
                  }
                : q
            )
          );
          void upsertLedgerInOfflineShiftSnapshot(resolvedLedger.facilityId, resolvedLedger);
          syncedCount += 1;
          setLastSyncedAtIso(new Date().toISOString());
          continue;
        }

        if (res.category === "auth" || res.category === "forbidden") {
          const errMsg =
            res.messageAr ||
            (res.category === "auth"
              ? "انتهت جلسة تسجيل الدخول — يرجى إعادة تسجيل الدخول لإكمال المزامنة."
              : "لا تملك صلاحية مزامنة هذه الحصة — تحقق من صلاحيات الحساب.");
          stoppedReason = res.category;
          lastErrorAr = errMsg;
          failedCount += 1;
          setOfflineQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    clientEventId: eventId,
                    synced: false,
                    syncStatus: "failed",
                    lastErrorCode: res.errorCode || String(res.status),
                    lastErrorAr: errMsg,
                  }
                : q
            )
          );
          depsRef.current.pushNotification({
            titleAr:
              res.category === "auth"
                ? "مزامنة أوفلاين متوقفة: يلزم إعادة تسجيل الدخول"
                : "مزامنة أوفلاين متوقفة: نقص في الصلاحيات",
            messageAr: errMsg,
            type: "system",
            actionLabelAr: res.category === "auth" ? "تسجيل الدخول" : "مراجعة الصلاحيات",
            actionHref: res.category === "auth" ? "/auth" : "/dashboard/ledger",
          });
          notifiedAuthStop = true;
          break;
        }

        if (res.category === "conflict") {
          await syncLedgersFromServer();
          const isIdempotent =
            res.errorCode === "idempotent_replay" || res.data?.idempotent === true;
          if (isIdempotent) {
            setOfflineQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      clientEventId: eventId,
                      synced: true,
                      syncStatus: "synced",
                      lastErrorCode: undefined,
                      lastErrorAr: undefined,
                    }
                  : q
              )
            );
            syncedCount += 1;
            setLastSyncedAtIso(new Date().toISOString());
          } else {
            const errMsg =
              res.messageAr ||
              "تعارض مع نسخة السيرفر أو تكرار حضور خلال 3 ساعات — تم تحديث البيانات من السيرفر.";
            stoppedReason = stoppedReason || "conflict";
            lastErrorAr = errMsg;
            failedCount += 1;
            setOfflineQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      clientEventId: eventId,
                      synced: false,
                      syncStatus: "failed",
                      lastErrorCode: res.errorCode || "conflict_409",
                      lastErrorAr: errMsg,
                    }
                  : q
              )
            );
          }
          continue;
        }

        // Validation / Server 5xx / Network timeout / Offline
        const errMsg =
          res.messageAr || "تعذر رفع العملية للسيرفر — تم الإبقاء عليها لإعادة المحاولة.";
        lastErrorAr = errMsg;
        failedCount += 1;
        setOfflineQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  clientEventId: eventId,
                  synced: false,
                  syncStatus: "failed",
                  retryCount: Math.min(5, (q.retryCount ?? 0) + 1),
                  lastErrorCode: res.errorCode || `http_${res.status}`,
                  lastErrorAr: errMsg,
                }
              : q
          )
        );
        if (res.category === "offline") {
          stoppedReason = "offline";
          break;
        }
      }
    } finally {
      isSyncingRef.current = false;
    }

    if (syncedCount > 0 && failedCount === 0 && !stoppedReason) {
      depsRef.current.pushNotification({
        titleAr: `مزامنة ${syncedCount} حصة أوفلاين بنجاح`,
        messageAr: "تم تأكيد حفظ بصمات الحضور على السيرفر دون فقدان أي حصة.",
        type: "session_reminder",
        actionLabelAr: "عرض دفتر الحصص",
        actionHref: "/dashboard/ledger",
      });
    } else if (syncedCount > 0 && failedCount > 0 && !notifiedAuthStop) {
      depsRef.current.pushNotification({
        titleAr: `مزامنة جزئية: نجحت ${syncedCount} وفشلت ${failedCount}`,
        messageAr: lastErrorAr || "بعض العمليات لم يتم تأكيدها من السيرفر وبقيت في قائمة الانتظار.",
        type: "system",
        actionLabelAr: "مراجعة دفتر الحصص",
        actionHref: "/dashboard/ledger",
      });
    } else if (syncedCount === 0 && failedCount > 0 && !notifiedAuthStop) {
      depsRef.current.pushNotification({
        titleAr: `تعذر مزامنة ${failedCount} عملية أوفلاين`,
        messageAr: lastErrorAr || "لم يتم تأكيد الحفظ على السيرفر — بقيت العمليات محفوظة محلياً.",
        type: "system",
        actionLabelAr: "عرض دفتر الحصص",
        actionHref: "/dashboard/ledger",
      });
    }

    return {
      attempted: orderedItems.length,
      syncedCount,
      failedCount,
      stoppedReason,
      lastErrorAr,
    };
  };

  const syncOfflineQueueAsync: NonNullable<
    CaptenlyContextType["syncOfflineQueueAsync"]
  > = async () => replayOfflineQueue(false);

  const retryFailedOfflineQueue: NonNullable<
    CaptenlyContextType["retryFailedOfflineQueue"]
  > = async () => replayOfflineQueue(true);

  const syncOfflineQueue = () => {
    const eligibleCount = offlineQueueRef.current.filter(
      (q) => !q.synced && (q.retryCount ?? 0) < 5
    ).length;
    if (eligibleCount > 0 && !effectiveOfflineRef.current && !isSyncingRef.current) {
      void syncOfflineQueueAsync();
    }
    return eligibleCount;
  };

  const syncStatusSummary: SyncStatusSummary = useMemo(() => {
    let pendingCount = 0;
    let syncingCount = 0;
    let failedCount = 0;
    let lastErrorAr: string | undefined;
    for (const q of offlineQueue) {
      if (q.synced || q.syncStatus === "synced") continue;
      if (q.syncStatus === "syncing") syncingCount += 1;
      else if (q.syncStatus === "failed") {
        failedCount += 1;
        if (!lastErrorAr && q.lastErrorAr) lastErrorAr = q.lastErrorAr;
      } else {
        pendingCount += 1;
      }
    }
    return {
      pendingCount,
      syncingCount,
      failedCount,
      lastErrorAr,
      lastSyncedAtIso,
    };
  }, [offlineQueue, lastSyncedAtIso]);

  useEffect(() => {
    const transitionedOnline = wasOfflineRef.current && !effectiveOffline;
    wasOfflineRef.current = effectiveOffline;
    if (effectiveOffline || !isAuthenticated) return;
    const hasPending = offlineQueue.some(
      (q) => !q.synced && q.syncStatus !== "failed" && (q.retryCount ?? 0) < 5
    );
    const hasRetryableOnReconnect =
      transitionedOnline && offlineQueue.some((q) => !q.synced && (q.retryCount ?? 0) < 5);
    if (hasPending || hasRetryableOnReconnect) {
      void syncOfflineQueueAsync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOffline, isAuthenticated, offlineQueue.length]);

  return {
    isOfflineSimulated,
    isBrowserOffline,
    effectiveOffline,
    toggleOfflineSimulation: () => {},
    sessionLedgers,
    setSessionLedgers,
    offlineQueue,
    setOfflineQueue,
    syncStatusSummary,
    facilityLinks,
    setFacilityLinks,
    syncOfflineQueue,
    syncOfflineQueueAsync,
    retryFailedOfflineQueue,
    lookupRemoteLedgersOrProfile,
    syncLedgersFromServer,
    ...linksActions,
    ...checkinActions,
  };
}
