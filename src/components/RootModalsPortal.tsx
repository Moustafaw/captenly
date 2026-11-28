"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useCaptenly } from "@/context/CaptenlyContext";

const DynamicLocationModal = dynamic(
  () => import("@/components/LocationModal").then((m) => m.LocationModal),
  { ssr: false }
);

const DynamicFilterModal = dynamic(
  () => import("@/components/FilterModal").then((m) => m.FilterModal),
  { ssr: false }
);

const DynamicAuthGateModal = dynamic(
  () => import("@/components/auth/AuthGateModal").then((m) => m.AuthGateModal),
  { ssr: false }
);

const DynamicFloatingCompareDrawer = dynamic(
  () => import("@/components/FloatingCompareDrawer").then((m) => m.FloatingCompareDrawer),
  { ssr: false }
);

const DynamicGoogleSessionBridge = dynamic(
  () => import("@/components/auth/GoogleSessionBridge").then((m) => m.GoogleSessionBridge),
  { ssr: false }
);

/**
 * Defers heavy root overlays (modals, compare drawer, OAuth session bridge)
 * out of the initial layout bundle so public pages only load chunks when needed.
 */
export function RootModalsPortal() {
  const pathname = usePathname() || "/";
  const {
    isAuthenticated,
    locationModalOpen,
    filterModalOpen,
    authGateModalOpen,
    compareFacilityIds,
  } = useCaptenly();

  const [idleBridgeReady, setIdleBridgeReady] = useState(false);
  const eagerBridge = pathname.startsWith("/auth") || isAuthenticated;

  useEffect(() => {
    if (eagerBridge || idleBridgeReady) return;
    if (typeof window === "undefined") return;

    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if ("requestIdleCallback" in window) {
      idleId = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(() => setIdleBridgeReady(true), { timeout: 3500 });
    } else {
      timerId = setTimeout(() => setIdleBridgeReady(true), 2500);
    }

    return () => {
      if (idleId !== null && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [eagerBridge, idleBridgeReady]);

  return (
    <>
      {eagerBridge || idleBridgeReady ? <DynamicGoogleSessionBridge /> : null}
      {compareFacilityIds.length > 0 ? <DynamicFloatingCompareDrawer /> : null}
      {locationModalOpen ? <DynamicLocationModal /> : null}
      {filterModalOpen ? <DynamicFilterModal /> : null}
      {authGateModalOpen ? <DynamicAuthGateModal /> : null}
    </>
  );
}
