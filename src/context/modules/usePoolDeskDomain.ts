"use client";

import { useEffect, useState } from "react";
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
} from "@/types/captenly";
import { INITIAL_SESSION_LEDGERS } from "@/data/seedData";
import { postSupabaseSync } from "./storageHelpers";
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
  const effectiveOffline = isBrowserOffline;

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
          byId.set(remote.id, localProgress > remoteProgress ? local : remote);
        }
      }
      return Array.from(byId.values());
    });
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
    if (!authed || effectiveOffline) return;
    await lookupRemoteLedgersOrProfile({
      memberCode: persona.memberCode || undefined,
      coachId: persona.linkedCoachId || (persona.role === "coach" ? persona.id : undefined),
      facilityId: persona.linkedFacilityId || staffFacId || undefined,
    });
  };

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

  const syncOfflineQueue = () => {
    const pendingItems = offlineQueue.filter((q) => !q.synced);
    const pendingCount = pendingItems.length;
    if (pendingCount === 0) return 0;

    const syncedIds = new Set(pendingItems.map((q) => q.ledgerId));
    setOfflineQueue((prev) => prev.map((q) => ({ ...q, synced: true })));
    setSessionLedgers((prev) =>
      prev.map((l) => {
        const updatedLedger: SessionLedger = {
          ...l,
          startedDateAr: l.startedDateAr.includes("محفوظ أوفلاين")
            ? l.startedDateAr.replace(
                "اليوم — محفوظ أوفلاين (سيتم المزامنة تلقائياً)",
                "اليوم — تمت المزامنة سحابياً ✓"
              )
            : l.startedDateAr,
          checkins: l.checkins.map((c) =>
            c.wasOffline && c.dateAr.includes("محفوظ أوفلاين")
              ? {
                  ...c,
                  dateAr: c.dateAr.replace(
                    "محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً",
                    "تمت المزامنة سحابياً بنجاح ✓"
                  ),
                }
              : c
          ),
        };
        if (syncedIds.has(l.id)) {
          postSupabaseSync("/api/supabase/session-ledgers", { ledger: updatedLedger });
        }
        return updatedLedger;
      })
    );

    depsRef.current.pushNotification({
      titleAr: `مزامنة ${pendingCount} حصة أوفلاين بنجاح`,
      messageAr: "تم رفع بصمات الحضور المحفوظة محلياً دون فقدان أي حصة بمجرد استقرار الاتصال.",
      type: "session_reminder",
      actionLabelAr: "عرض دفتر الحصص",
      actionHref: "/dashboard/ledger",
    });

    return pendingCount;
  };

  useEffect(() => {
    if (!effectiveOffline && offlineQueue.some((q) => !q.synced)) {
      syncOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOffline]);

  return {
    isOfflineSimulated,
    isBrowserOffline,
    effectiveOffline,
    toggleOfflineSimulation: () => {},
    sessionLedgers,
    setSessionLedgers,
    offlineQueue,
    setOfflineQueue,
    facilityLinks,
    setFacilityLinks,
    syncOfflineQueue,
    lookupRemoteLedgersOrProfile,
    syncLedgersFromServer,
    ...linksActions,
    ...checkinActions,
  };
}
