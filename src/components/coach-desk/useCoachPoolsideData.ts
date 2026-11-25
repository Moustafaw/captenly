"use client";

import { useMemo } from "react";
import {
  calculateEnrollmentBreakdown,
  getFacilityPoolDeskConfig,
  resolveCoachScanPermission,
  toPricingSnapshot,
} from "@/lib/poolDeskPricing";
import type {
  Coach,
  Facility,
  FacilityLinkedEntity,
  SessionLedger,
} from "@/types/captenly";

export function useCoachPoolsideData(params: {
  facilities: Facility[];
  facilityLinks: FacilityLinkedEntity[];
  sessionLedgers: SessionLedger[];
  linkedCoachId: string;
  activeCoach: Coach | null;
  coachFullNameAr: string;
}) {
  const {
    facilities,
    facilityLinks,
    sessionLedgers,
    linkedCoachId,
    activeCoach,
    coachFullNameAr,
  } = params;

  const coachMemberCode = activeCoach?.SingleCoachId || "";

  const myLinks = useMemo(() => {
    const map = new Map<string, FacilityLinkedEntity>();
    const codeUpper = coachMemberCode.trim().toUpperCase();
    const matches = (l: FacilityLinkedEntity) => {
      if (l.linkedCoachId && l.linkedCoachId === linkedCoachId) return true;
      if (codeUpper && l.linkedMemberCode?.toUpperCase() === codeUpper) return true;
      if (coachFullNameAr && l.displayNameAr === coachFullNameAr) return true;
      return false;
    };
    facilityLinks.filter(matches).forEach((l) => map.set(l.id, l));
    facilities.forEach((f) => {
      getFacilityPoolDeskConfig(f)
        .linkedEntities.filter(matches)
        .forEach((l) => {
          if (!map.has(l.id)) {
            map.set(l.id, { ...l, facilityNameAr: l.facilityNameAr || f.nameAr });
          }
        });
    });
    return Array.from(map.values());
  }, [facilities, facilityLinks, linkedCoachId, coachMemberCode, coachFullNameAr]);

  const myApprovedLinks = useMemo(
    () => myLinks.filter((l) => l.status === "approved"),
    [myLinks]
  );

  const myApprovedLinkIds = useMemo(
    () => new Set(myApprovedLinks.map((l) => l.id)),
    [myApprovedLinks]
  );

  const coachLedgers = useMemo(
    () =>
      sessionLedgers.filter(
        (l) =>
          l.coachId === linkedCoachId ||
          l.coachNameAr === (activeCoach?.fullNameAr || coachFullNameAr) ||
          Boolean(l.linkedEntityId && myApprovedLinkIds.has(l.linkedEntityId))
      ),
    [sessionLedgers, linkedCoachId, activeCoach?.fullNameAr, coachFullNameAr, myApprovedLinkIds]
  );

  const coachSwimmers = useMemo(() => {
    const map = new Map<string, string>();
    coachLedgers.forEach((l) => {
      if (l.athleteId && l.athleteNameAr) {
        map.set(l.athleteId, l.athleteNameAr);
      }
    });
    return Array.from(map.entries()).map(([id, nameAr]) => ({ id, nameAr }));
  }, [coachLedgers]);

  const delegatedLinkIds = useMemo(
    () =>
      myApprovedLinks.filter((l) => l.canScanGroupQr).map((l) => l.id),
    [myApprovedLinks]
  );

  const getLedgerScanPermission = (ledger: SessionLedger) => {
    const fac = facilities.find((f) => f.id === ledger.facilityId);
    const matchedEntity = ledger.linkedEntityId
      ? myLinks.find((l) => l.id === ledger.linkedEntityId)
      : myApprovedLinks.find((l) => l.facilityId === ledger.facilityId);

    const resolved = resolveCoachScanPermission({
      facility: fac,
      coachId: linkedCoachId,
      coachMemberCode,
      linkedEntity: matchedEntity || null,
    });

    // If tied to an approved host club entity, respect facility canScanGroupQr gate lock
    if (matchedEntity || ledger.linkedEntityId) {
      return {
        canScan: resolved.canScanGroupQr,
        isHostGoverned: true,
        hostNameAr: fac?.nameAr || ledger.facilityNameAr,
      };
    }

    // Direct standalone coach lesson outside any host governance lock
    return {
      canScan: true,
      isHostGoverned: false,
      hostNameAr: fac?.nameAr || ledger.facilityNameAr,
    };
  };

  const getFacilityEnrollPricing = (
    facilityId: string,
    totalSessions: number,
    trainingFeeEgp: number
  ) => {
    const fac = facilities.find((f) => f.id === facilityId);
    const cfg = getFacilityPoolDeskConfig(fac);
    const hostLink = myApprovedLinks.find((l) => l.facilityId === facilityId);
    const effectiveWaterUnit =
      hostLink?.customWaterFeePerSessionEgp !== undefined
        ? hostLink.customWaterFeePerSessionEgp
        : cfg.waterFeePerSessionEgp;

    const calc = calculateEnrollmentBreakdown({
      totalSessions,
      waterFeePerSessionEgp: effectiveWaterUnit,
      trainingFeeEgp,
      agreementType: hostLink?.agreementType || "per_swimmer_water",
      discountMode: "none",
    });

    return {
      hostLink,
      calc,
      pricingSnapshot: toPricingSnapshot(calc),
    };
  };

  return {
    myLinks,
    myApprovedLinks,
    myApprovedLinkIds,
    delegatedLinkIds,
    coachLedgers,
    coachSwimmers,
    getLedgerScanPermission,
    getFacilityEnrollPricing,
  };
}
