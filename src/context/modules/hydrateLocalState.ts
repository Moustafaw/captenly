"use client";

import type {
  Coach,
  DemandRadarEntry,
  DemandRadarSubmission,
  EditorialArticle,
  Facility,
  FacilityLinkedEntity,
  MemberRegistryEntry,
  MinorAthleteProfile,
  NotificationItem,
  OfflineCheckinQueueItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionLedger,
  SkillEvaluation5Point,
  SmartFiltersState,
  UserLocation,
  VerifiedLeadItem,
  WorkspaceContextMode,
} from "@/types/captenly";
import { GUEST_PERSONA } from "@/data/seedData";
import {
  DEFAULT_EGYPT_LOCATION,
  DEFAULT_SMART_FILTERS,
  DEFAULT_USER_SETTINGS,
  LEGACY_FAKE_PERSONA_IDS,
  LEGACY_STORAGE_KEY_V5,
  readCleanPersonasFromSaved,
  STORAGE_KEY,
} from "./storageHelpers";
import type { AccountActivitySnapshot, UserSettingsState } from "./types";

export interface HydrationTargets {
  setAllPersonas: (v: PersonaAccount[]) => void;
  setMemberRegistry: (v: MemberRegistryEntry[]) => void;
  setFacilities: (v: Facility[]) => void;
  setCoaches: (v: Coach[]) => void;
  setAccountSnapshots: (v: Record<string, AccountActivitySnapshot>) => void;
  setMinorAthletes: (v: MinorAthleteProfile[]) => void;
  setPbRecords: (v: PersonalBestRecord[]) => void;
  setSkillEvaluationsByAthlete: (v: Record<string, SkillEvaluation5Point>) => void;
  setSessionLedgers: (v: SessionLedger[]) => void;
  setVerifiedLeads: (v: VerifiedLeadItem[]) => void;
  setSavedFavoriteIds: (v: string[]) => void;
  setCompareFacilityIds: (v: string[]) => void;
  setNotifications: (v: NotificationItem[]) => void;
  setUserSettings: (v: UserSettingsState) => void;
  setUserLocation: (v: UserLocation) => void;
  setActiveStaffAssignmentId: (v: string | null) => void;
  setActiveWorkspaceContextState: (v: WorkspaceContextMode) => void;
  setCurrentPersona: (v: PersonaAccount) => void;
  setDemandRadar: (v: DemandRadarEntry[]) => void;
  setDemandSubmissions: (v: DemandRadarSubmission[]) => void;
  setOfflineQueue: (v: OfflineCheckinQueueItem[]) => void;
  setFacilityLinks: (v: FacilityLinkedEntity[]) => void;
  setArticles: (v: EditorialArticle[]) => void;
  setNewsletterEmails: (v: string[]) => void;
  setSmartFilters: (v: SmartFiltersState) => void;
}

export function hydrateCaptenlyFromLocalStorage(t: HydrationTargets): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const cleanedPersonas = readCleanPersonasFromSaved(parsed.allPersonas);
      if (Array.isArray(parsed.allPersonas)) t.setAllPersonas(cleanedPersonas);
      if (Array.isArray(parsed.memberRegistry)) {
        t.setMemberRegistry(
          (parsed.memberRegistry as MemberRegistryEntry[]).filter(
            (m) =>
              m &&
              !LEGACY_FAKE_PERSONA_IDS.has(m.athleteId) &&
              m.memberCode !== "CAP-M-5190" &&
              m.memberCode !== "CAP-M-4821"
          )
        );
      }
      if (Array.isArray(parsed.facilities)) {
        t.setFacilities(
          (parsed.facilities as Facility[]).filter(
            (f) => f && f.sportSector !== "fitness" && f.supplyStatus !== "seeded_unclaimed"
          )
        );
      }
      if (Array.isArray(parsed.coaches)) t.setCoaches(parsed.coaches);
      if (parsed.accountSnapshots && typeof parsed.accountSnapshots === "object") {
        t.setAccountSnapshots(parsed.accountSnapshots);
      }

      const activePersonaFound =
        parsed.personaId && !LEGACY_FAKE_PERSONA_IDS.has(parsed.personaId)
          ? cleanedPersonas.find((p) => p.id === parsed.personaId)
          : undefined;

      if (activePersonaFound) {
        if (parsed.minorAthletes) {
          t.setMinorAthletes(
            (parsed.minorAthletes as MinorAthleteProfile[]).map((m, idx) => ({
              ...m,
              childMemberCode:
                m.childMemberCode ||
                `CAP-JR-${String(
                  (activePersonaFound.memberCode || "").replace(/\D/g, "").slice(-4) || "0000"
                )}-${String(idx + 1).padStart(2, "0")}`,
            }))
          );
        }
        if (parsed.pbRecords) t.setPbRecords(parsed.pbRecords);
        if (parsed.skillEvaluationsByAthlete && typeof parsed.skillEvaluationsByAthlete === "object") {
          t.setSkillEvaluationsByAthlete(parsed.skillEvaluationsByAthlete);
        }
        if (parsed.sessionLedgers) t.setSessionLedgers(parsed.sessionLedgers);
        if (parsed.verifiedLeads) t.setVerifiedLeads(parsed.verifiedLeads);
        if (Array.isArray(parsed.savedFavoriteIds)) t.setSavedFavoriteIds(parsed.savedFavoriteIds);
        if (Array.isArray(parsed.compareFacilityIds)) t.setCompareFacilityIds(parsed.compareFacilityIds);
        if (Array.isArray(parsed.notifications)) t.setNotifications(parsed.notifications);
        if (parsed.userSettings) t.setUserSettings(parsed.userSettings);
        if (parsed.userLocation?.isSpecified) t.setUserLocation(parsed.userLocation);
        if (typeof parsed.activeStaffAssignmentId === "string" || parsed.activeStaffAssignmentId === null) {
          t.setActiveStaffAssignmentId(parsed.activeStaffAssignmentId);
        }
        if (
          parsed.activeWorkspaceContext === "member" ||
          parsed.activeWorkspaceContext === "coach" ||
          parsed.activeWorkspaceContext === "facility" ||
          parsed.activeWorkspaceContext === "staff"
        ) {
          t.setActiveWorkspaceContextState(parsed.activeWorkspaceContext);
        } else {
          t.setActiveWorkspaceContextState(
            activePersonaFound.linkedFacilityId || activePersonaFound.role === "facility_manager"
              ? "facility"
              : activePersonaFound.linkedCoachId || activePersonaFound.role === "coach"
                ? "coach"
                : "member"
          );
        }
        t.setCurrentPersona(activePersonaFound);
      } else {
        t.setCurrentPersona(GUEST_PERSONA);
        t.setActiveStaffAssignmentId(null);
        t.setActiveWorkspaceContextState("member");
        t.setSavedFavoriteIds([]);
        t.setCompareFacilityIds([]);
        t.setMinorAthletes([]);
        t.setPbRecords([]);
        t.setSkillEvaluationsByAthlete({});
        t.setSessionLedgers([]);
        t.setVerifiedLeads([]);
        t.setNotifications([]);
        t.setUserSettings(DEFAULT_USER_SETTINGS);
        t.setUserLocation(parsed.userLocation?.isSpecified ? parsed.userLocation : DEFAULT_EGYPT_LOCATION);
      }

      if (parsed.demandRadar) t.setDemandRadar(parsed.demandRadar);
      if (parsed.demandSubmissions) t.setDemandSubmissions(parsed.demandSubmissions);
      if (parsed.offlineQueue) t.setOfflineQueue(parsed.offlineQueue);
      if (Array.isArray(parsed.facilityLinks)) t.setFacilityLinks(parsed.facilityLinks);
      if (Array.isArray(parsed.articles) && parsed.articles.length > 0) t.setArticles(parsed.articles);
      if (parsed.newsletterEmails) t.setNewsletterEmails(parsed.newsletterEmails);
      if (parsed.smartFilters && typeof parsed.smartFilters === "object") {
        t.setSmartFilters({ ...DEFAULT_SMART_FILTERS, ...parsed.smartFilters });
      }
      return true;
    }

    const legacyV5 = localStorage.getItem(LEGACY_STORAGE_KEY_V5);
    if (legacyV5) {
      const parsed = JSON.parse(legacyV5);
      if (Array.isArray(parsed.allPersonas)) {
        const realAccounts = (parsed.allPersonas as PersonaAccount[]).filter(
          (p) =>
            p &&
            !LEGACY_FAKE_PERSONA_IDS.has(p.id) &&
            p.role !== "guest" &&
            (p.authProvider === "google" || p.id.startsWith("user-") || p.id.startsWith("google-"))
        );
        if (realAccounts.length > 0) {
          t.setAllPersonas([GUEST_PERSONA, ...realAccounts]);
          const activeReal = realAccounts.find((p) => p.id === parsed.personaId);
          if (activeReal) {
            t.setCurrentPersona(activeReal);
            if (parsed.userLocation?.isSpecified) t.setUserLocation(parsed.userLocation);
          }
        }
      }
      if (Array.isArray(parsed.coaches) && parsed.coaches.length > 0) t.setCoaches(parsed.coaches);
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  return false;
}
