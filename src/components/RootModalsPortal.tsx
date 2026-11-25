"use client";

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
  const {
    locationModalOpen,
    filterModalOpen,
    authGateModalOpen,
    compareFacilityIds,
  } = useCaptenly();

  return (
    <>
      <DynamicGoogleSessionBridge />
      {compareFacilityIds.length > 0 ? <DynamicFloatingCompareDrawer /> : null}
      {locationModalOpen ? <DynamicLocationModal /> : null}
      {filterModalOpen ? <DynamicFilterModal /> : null}
      {authGateModalOpen ? <DynamicAuthGateModal /> : null}
    </>
  );
}
