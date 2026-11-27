"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GUEST_PERSONA,
  INITIAL_ARTICLES,
  INITIAL_COACHES,
  INITIAL_DEMAND_RADAR,
  INITIAL_FACILITIES,
  INITIAL_MEMBER_REGISTRY,
  INITIAL_MINOR_ATHLETES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PB_RECORDS,
  INITIAL_SESSION_LEDGERS,
  INITIAL_VERIFIED_LEADS,
  PERSONA_ACCOUNTS,
} from "@/data/seedData";
import { hydrateCaptenlyFromLocalStorage } from "./modules/hydrateLocalState";
import {
  DEFAULT_EGYPT_LOCATION,
  DEFAULT_SMART_FILTERS,
  STORAGE_KEY,
  writePersistedStateToStorage,
} from "./modules/storageHelpers";
import type { CaptenlyContextType, CaptenlyProviderProps } from "./modules/types";
import { useSupplyDomain, type SupplyDomainDeps } from "./modules/useSupplyDomain";
import { useDiscoveryDomain, type DiscoveryDomainDeps } from "./modules/useDiscoveryDomain";
import { useTelemetryDomain, type TelemetryDomainDeps } from "./modules/useTelemetryDomain";
import { useAuthDomain, type AuthDomainDeps } from "./modules/useAuthDomain";
import {
  useRoleClaimsAndStaff,
  type RoleClaimsAndStaffDeps,
} from "./modules/useRoleClaimsAndStaff";
import { usePoolDeskDomain, type PoolDeskDomainDeps } from "./modules/usePoolDeskDomain";

const CaptenlyContext = createContext<CaptenlyContextType | undefined>(undefined);

export function CaptenlyProvider({ children, initialPublicSupply }: CaptenlyProviderProps) {
  const [storageHydrated, setStorageHydrated] = useState(false);
  const hadSavedStateRef = useRef(false);
  const skipInitialPersistRef = useRef(true);

  const supplyDepsRef = useRef<SupplyDomainDeps>({} as SupplyDomainDeps);
  const discoveryDepsRef = useRef<DiscoveryDomainDeps>({} as DiscoveryDomainDeps);
  const telemetryDepsRef = useRef<TelemetryDomainDeps>({} as TelemetryDomainDeps);
  const authDepsRef = useRef<AuthDomainDeps>({} as AuthDomainDeps);
  const roleStaffDepsRef = useRef<RoleClaimsAndStaffDeps>({} as RoleClaimsAndStaffDeps);
  const poolDeskDepsRef = useRef<PoolDeskDomainDeps>({} as PoolDeskDomainDeps);

  const supply = useSupplyDomain({ initialPublicSupply, depsRef: supplyDepsRef });
  const discovery = useDiscoveryDomain({
    facilities: supply.facilities,
    setFacilities: supply.setFacilities,
    depsRef: discoveryDepsRef,
  });
  const auth = useAuthDomain({ depsRef: authDepsRef });
  const roleStaff = useRoleClaimsAndStaff({
    isAuthenticated: auth.isAuthenticated,
    currentPersona: auth.currentPersona,
    facilities: supply.facilities,
    depsRef: roleStaffDepsRef,
  });
  const telemetry = useTelemetryDomain({
    currentPersona: auth.currentPersona,
    setSavedFavoriteIds: discovery.setSavedFavoriteIds,
    setCompareFacilityIds: discovery.setCompareFacilityIds,
    setUserLocation: discovery.setUserLocation,
    depsRef: telemetryDepsRef,
  });
  const poolDesk = usePoolDeskDomain({
    facilities: supply.facilities,
    setFacilities: supply.setFacilities,
    coaches: supply.coaches,
    updateFacilityAndSync: supply.updateFacilityAndSync,
    isAuthenticated: auth.isAuthenticated,
    currentPersona: auth.currentPersona,
    resolvedActiveStaffFacilityId: roleStaff.resolvedActiveStaffFacilityId,
    depsRef: poolDeskDepsRef,
  });

  supplyDepsRef.current = {
    isAuthenticated: auth.isAuthenticated,
    isBrowserOffline: poolDesk.isBrowserOffline,
    currentPersona: auth.currentPersona,
    setCurrentPersona: auth.setCurrentPersona,
    setAllPersonas: auth.setAllPersonas,
    setRoleClaims: roleStaff.setRoleClaims,
    pushNotification: telemetry.pushNotification,
    submitRoleClaimApplication: roleStaff.submitRoleClaimApplication,
  };
  discoveryDepsRef.current = {
    isAuthenticated: auth.isAuthenticated,
    openAuthGateModal: auth.openAuthGateModal,
    persistPrefsToRemote: telemetry.persistPrefsToRemote,
    setCurrentPersona: auth.setCurrentPersona,
    setAllPersonas: auth.setAllPersonas,
    syncRegistryCity: (athleteId, city) => {
      auth.setMemberRegistry((list) =>
        list.map((m) => (m.athleteId === athleteId ? { ...m, city } : m))
      );
    },
  };
  telemetryDepsRef.current = {
    isAuthenticated: auth.isAuthenticated,
    currentPersona: auth.currentPersona,
    setCurrentPersona: auth.setCurrentPersona,
    allPersonas: auth.allPersonas,
    memberRegistry: auth.memberRegistry,
    setMemberRegistry: auth.setMemberRegistry,
    sessionLedgers: poolDesk.sessionLedgers,
    setFacilities: supply.setFacilities,
    setSavedFavoriteIds: discovery.setSavedFavoriteIds,
    setCompareFacilityIds: discovery.setCompareFacilityIds,
    setUserLocation: discovery.setUserLocation,
    openAuthGateModal: auth.openAuthGateModal,
  };
  authDepsRef.current = {
    coaches: supply.coaches,
    setCoaches: supply.setCoaches,
    syncCoachToSupabase: supply.syncCoachToSupabase,
    updateFacilityAndSync: supply.updateFacilityAndSync,
    setActiveStaffAssignmentId: roleStaff.setActiveStaffAssignmentId,
    setActiveWorkspaceContextState: roleStaff.setActiveWorkspaceContextState,
    setRoleClaims: roleStaff.setRoleClaims,
    refreshRoleClaims: roleStaff.refreshRoleClaims,
    applyAccountCityToUserLocation: discovery.applyAccountCityToUserLocation,
    setSavedFavoriteIds: discovery.setSavedFavoriteIds,
    setCompareFacilityIds: discovery.setCompareFacilityIds,
    setUserLocation: discovery.setUserLocation,
    savedFavoriteIds: discovery.savedFavoriteIds,
    compareFacilityIds: discovery.compareFacilityIds,
    userLocation: discovery.userLocation,
    minorAthletes: telemetry.minorAthletes,
    setMinorAthletes: telemetry.setMinorAthletes,
    pbRecords: telemetry.pbRecords,
    setPbRecords: telemetry.setPbRecords,
    skillEvaluationsByAthlete: telemetry.skillEvaluationsByAthlete,
    setSkillEvaluationsByAthlete: telemetry.setSkillEvaluationsByAthlete,
    setSkillEvaluation: telemetry.setSkillEvaluation,
    notifications: telemetry.notifications,
    setNotifications: telemetry.setNotifications,
    setVerifiedLeads: telemetry.setVerifiedLeads,
    userSettings: telemetry.userSettings,
    setUserSettings: telemetry.setUserSettings,
    setSessionLedgers: poolDesk.setSessionLedgers,
    persistPrefsToRemote: telemetry.persistPrefsToRemote,
    lookupRemoteLedgersOrProfile: poolDesk.lookupRemoteLedgersOrProfile,
    isBrowserOffline: poolDesk.isBrowserOffline,
  };
  roleStaffDepsRef.current = {
    isAuthenticated: auth.isAuthenticated,
    currentPersona: auth.currentPersona,
    setCurrentPersona: auth.setCurrentPersona,
    allPersonas: auth.allPersonas,
    setAllPersonas: auth.setAllPersonas,
    memberRegistry: auth.memberRegistry,
    facilities: supply.facilities,
    setFacilities: supply.setFacilities,
    setCoaches: supply.setCoaches,
    updateFacilityAndSync: supply.updateFacilityAndSync,
    pushNotification: telemetry.pushNotification,
  };
  poolDeskDepsRef.current = {
    isAuthenticated: auth.isAuthenticated,
    currentPersona: auth.currentPersona,
    allPersonas: auth.allPersonas,
    memberRegistry: auth.memberRegistry,
    setMemberRegistry: auth.setMemberRegistry,
    minorAthletes: telemetry.minorAthletes,
    activeStaffAssignment: roleStaff.activeStaffAssignment,
    resolvedActiveStaffFacilityId: roleStaff.resolvedActiveStaffFacilityId,
    pushNotification: telemetry.pushNotification,
  };

  useEffect(() => {
    hadSavedStateRef.current = hydrateCaptenlyFromLocalStorage({
      setAllPersonas: auth.setAllPersonas,
      setMemberRegistry: auth.setMemberRegistry,
      setFacilities: supply.setFacilities,
      setCoaches: supply.setCoaches,
      setAccountSnapshots: auth.setAccountSnapshots,
      setMinorAthletes: telemetry.setMinorAthletes,
      setPbRecords: telemetry.setPbRecords,
      setSkillEvaluationsByAthlete: telemetry.setSkillEvaluationsByAthlete,
      setSessionLedgers: poolDesk.setSessionLedgers,
      setVerifiedLeads: telemetry.setVerifiedLeads,
      setSavedFavoriteIds: discovery.setSavedFavoriteIds,
      setCompareFacilityIds: discovery.setCompareFacilityIds,
      setNotifications: telemetry.setNotifications,
      setUserSettings: telemetry.setUserSettings,
      setUserLocation: discovery.setUserLocation,
      setActiveStaffAssignmentId: roleStaff.setActiveStaffAssignmentId,
      setActiveWorkspaceContextState: roleStaff.setActiveWorkspaceContextState,
      setCurrentPersona: auth.setCurrentPersona,
      setDemandRadar: telemetry.setDemandRadar,
      setDemandSubmissions: telemetry.setDemandSubmissions,
      setOfflineQueue: poolDesk.setOfflineQueue,
      setFacilityLinks: poolDesk.setFacilityLinks,
      setArticles: supply.setArticles,
      setNewsletterEmails: telemetry.setNewsletterEmails,
      setSmartFilters: discovery.setSmartFilters,
    });
    setStorageHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    auth.upsertSnapshotForCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auth.isAuthenticated,
    auth.currentPersona,
    discovery.savedFavoriteIds,
    discovery.compareFacilityIds,
    telemetry.minorAthletes,
    telemetry.pbRecords,
    telemetry.skillEvaluationsByAthlete,
    telemetry.notifications,
    telemetry.userSettings,
    discovery.userLocation,
  ]);

  useEffect(() => {
    if (!storageHydrated) return;
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }
    const hasGuestUserPrefs =
      discovery.savedFavoriteIds.length > 0 ||
      discovery.compareFacilityIds.length > 0 ||
      discovery.userLocation.isSpecified ||
      discovery.smartFilters.city !== DEFAULT_SMART_FILTERS.city ||
      discovery.smartFilters.searchQuery !== "" ||
      discovery.smartFilters.heatedOnly ||
      discovery.smartFilters.ladiesOnly ||
      discovery.smartFilters.lifeguardOnly ||
      discovery.smartFilters.maxPriceEgp !== DEFAULT_SMART_FILTERS.maxPriceEgp ||
      discovery.smartFilters.maxDistanceKm !== DEFAULT_SMART_FILTERS.maxDistanceKm ||
      telemetry.newsletterEmails.length > 0 ||
      telemetry.demandSubmissions.length > 0;
    if (!hadSavedStateRef.current && !auth.isAuthenticated && !hasGuestUserPrefs) {
      return;
    }
    writePersistedStateToStorage({
      personaId: auth.currentPersona.id,
      allPersonas: auth.allPersonas,
      memberRegistry: auth.memberRegistry,
      facilities: supply.facilities,
      coaches: supply.coaches,
      minorAthletes: telemetry.minorAthletes,
      pbRecords: telemetry.pbRecords,
      skillEvaluationsByAthlete: telemetry.skillEvaluationsByAthlete,
      sessionLedgers: poolDesk.sessionLedgers,
      verifiedLeads: telemetry.verifiedLeads,
      demandRadar: telemetry.demandRadar,
      demandSubmissions: telemetry.demandSubmissions,
      offlineQueue: poolDesk.offlineQueue,
      facilityLinks: poolDesk.facilityLinks,
      savedFavoriteIds: discovery.savedFavoriteIds,
      compareFacilityIds: discovery.compareFacilityIds,
      notifications: telemetry.notifications,
      articles: supply.articles,
      activeStaffAssignmentId: roleStaff.activeStaffAssignmentId,
      activeWorkspaceContext: roleStaff.activeWorkspaceContext,
      accountSnapshots: auth.accountSnapshots,
      userSettings: telemetry.userSettings,
      newsletterEmails: telemetry.newsletterEmails,
      userLocation: discovery.userLocation,
      smartFilters: discovery.smartFilters,
    });
  }, [
    storageHydrated,
    auth.isAuthenticated,
    auth.currentPersona,
    auth.allPersonas,
    auth.memberRegistry,
    auth.accountSnapshots,
    supply.facilities,
    supply.coaches,
    supply.articles,
    telemetry.minorAthletes,
    telemetry.pbRecords,
    telemetry.skillEvaluationsByAthlete,
    telemetry.verifiedLeads,
    telemetry.demandRadar,
    telemetry.demandSubmissions,
    telemetry.notifications,
    telemetry.userSettings,
    telemetry.newsletterEmails,
    poolDesk.sessionLedgers,
    poolDesk.offlineQueue,
    poolDesk.facilityLinks,
    discovery.savedFavoriteIds,
    discovery.compareFacilityIds,
    discovery.userLocation,
    discovery.smartFilters,
    roleStaff.activeStaffAssignmentId,
    roleStaff.activeWorkspaceContext,
  ]);

  const resetDemoData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    auth.setAllPersonas(PERSONA_ACCOUNTS);
    auth.setCurrentPersona(GUEST_PERSONA);
    roleStaff.setActiveWorkspaceContextState("member");
    roleStaff.setRoleClaims([]);
    auth.setMemberRegistry(INITIAL_MEMBER_REGISTRY);
    supply.setFacilities(INITIAL_FACILITIES);
    supply.setCoaches(INITIAL_COACHES);
    telemetry.setMinorAthletes(INITIAL_MINOR_ATHLETES);
    telemetry.setPbRecords(INITIAL_PB_RECORDS);
    poolDesk.setSessionLedgers(INITIAL_SESSION_LEDGERS);
    telemetry.setVerifiedLeads(INITIAL_VERIFIED_LEADS);
    telemetry.setDemandRadar(INITIAL_DEMAND_RADAR);
    discovery.setUserLocation(DEFAULT_EGYPT_LOCATION);
    poolDesk.setOfflineQueue([]);
    discovery.setSavedFavoriteIds([]);
    discovery.setCompareFacilityIds([]);
    telemetry.setNotifications(INITIAL_NOTIFICATIONS);
    supply.setArticles(INITIAL_ARTICLES);
    roleStaff.setActiveStaffAssignmentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CaptenlyContextType>(
    () => ({
      currentPersona: auth.currentPersona,
      isAuthenticated: auth.isAuthenticated,
      activeWorkspaceContext: roleStaff.activeWorkspaceContext,
      switchWorkspaceContext: roleStaff.switchWorkspaceContext,
      roleClaims: roleStaff.roleClaims,
      refreshRoleClaims: roleStaff.refreshRoleClaims,
      submitRoleClaimApplication: roleStaff.submitRoleClaimApplication,
      reviewRoleClaim: roleStaff.reviewRoleClaim,
      registerAndPublishFacility: supply.registerAndPublishFacility,
      authGateModalOpen: auth.authGateModalOpen,
      authGateFeatureNameAr: auth.authGateFeatureNameAr,
      openAuthGateModal: auth.openAuthGateModal,
      closeAuthGateModal: auth.closeAuthGateModal,
      switchPersona: auth.switchPersona,
      updateCurrentPersonaAvatar: auth.updateCurrentPersonaAvatar,
      updateFacilityHeroImage: supply.updateFacilityHeroImage,
      updateCurrentPersonaProfile: auth.updateCurrentPersonaProfile,
      allPersonas: auth.allPersonas,
      isOfflineSimulated: poolDesk.isOfflineSimulated,
      isBrowserOffline: poolDesk.isBrowserOffline,
      effectiveOffline: poolDesk.effectiveOffline,
      toggleOfflineSimulation: poolDesk.toggleOfflineSimulation,
      memberRegistry: auth.memberRegistry,
      registerMemberUser: auth.registerMemberUser,
      registerMemberWithCredentials: auth.registerMemberWithCredentials,
      loginOrCreateWithGoogle: auth.loginOrCreateWithGoogle,
      restoreOrLoginWithGoogle: auth.restoreOrLoginWithGoogle,
      restoreProfileByLogin: auth.restoreProfileByLogin,
      completeGoogleOnboarding: auth.completeGoogleOnboarding,
      signOutToGuest: auth.signOutToGuest,
      deleteCurrentAccount: auth.deleteCurrentAccount,
      userLocation: discovery.userLocation,
      setUserCity: discovery.setUserCity,
      setUserCoordinates: discovery.setUserCoordinates,
      resetLocationToAllEgypt: discovery.resetLocationToAllEgypt,
      requestAutoGeolocation: discovery.requestAutoGeolocation,
      locationModalOpen: discovery.locationModalOpen,
      setLocationModalOpen: discovery.setLocationModalOpen,
      smartFilters: discovery.smartFilters,
      updateSmartFilters: discovery.updateSmartFilters,
      resetSmartFilters: discovery.resetSmartFilters,
      filterModalOpen: discovery.filterModalOpen,
      setFilterModalOpen: discovery.setFilterModalOpen,
      savedFavoriteIds: discovery.savedFavoriteIds,
      toggleFavorite: discovery.toggleFavorite,
      isFavorite: discovery.isFavorite,
      notifications: telemetry.notifications,
      markNotificationAsRead: telemetry.markNotificationAsRead,
      unreadNotificationsCount: telemetry.unreadNotificationsCount,
      articles: supply.articles,
      saveEditorialArticle: supply.saveEditorialArticle,
      deleteEditorialArticle: supply.deleteEditorialArticle,
      subscribeNewsletter: telemetry.subscribeNewsletter,
      userSettings: telemetry.userSettings,
      updateUserSettings: telemetry.updateUserSettings,
      subscribeDemandRadar: telemetry.subscribeDemandRadar,
      demandSubmissions: telemetry.demandSubmissions,
      facilities: supply.facilities,
      coaches: supply.coaches,
      minorAthletes: telemetry.minorAthletes,
      pbRecords: telemetry.pbRecords,
      skillEvaluation: telemetry.skillEvaluation,
      skillEvaluationsByAthlete: telemetry.skillEvaluationsByAthlete,
      getSkillEvaluationForAthlete: telemetry.getSkillEvaluationForAthlete,
      sessionLedgers: poolDesk.sessionLedgers,
      verifiedLeads: telemetry.verifiedLeads,
      demandRadar: telemetry.demandRadar,
      offlineQueue: poolDesk.offlineQueue,
      syncOfflineQueue: poolDesk.syncOfflineQueue,
      compareFacilityIds: discovery.compareFacilityIds,
      toggleCompareFacility: discovery.toggleCompareFacility,
      clearComparison: discovery.clearComparison,
      createStructuredWhatsappLead: telemetry.createStructuredWhatsappLead,
      facilityLinks: poolDesk.facilityLinks,
      refreshFacilityLinks: poolDesk.refreshFacilityLinks,
      updateFacilityPoolDeskConfig: poolDesk.updateFacilityPoolDeskConfig,
      saveFacilityPromoCode: poolDesk.saveFacilityPromoCode,
      toggleFacilityPromoCode: poolDesk.toggleFacilityPromoCode,
      removeFacilityPromoCode: poolDesk.removeFacilityPromoCode,
      addDirectFacilityLinkedEntity: poolDesk.addDirectFacilityLinkedEntity,
      requestCoachHostClubLink: poolDesk.requestCoachHostClubLink,
      reviewFacilityLinkedEntity: poolDesk.reviewFacilityLinkedEntity,
      enrollSwimmerByMemberCode: poolDesk.enrollSwimmerByMemberCode,
      checkInSession: poolDesk.checkInSession,
      checkInBySubscriptionCode: poolDesk.checkInBySubscriptionCode,
      renewSwimmerSubscription: poolDesk.renewSwimmerSubscription,
      uploadInstaPayReceipt: poolDesk.uploadInstaPayReceipt,
      confirmReceiptByProvider: poolDesk.confirmReceiptByProvider,
      lookupRemoteLedgersOrProfile: poolDesk.lookupRemoteLedgersOrProfile,
      syncLedgersFromServer: poolDesk.syncLedgersFromServer,
      addNewPBRecord: telemetry.addNewPBRecord,
      recordCoachSkillAndPB: telemetry.recordCoachSkillAndPB,
      addMinorAthlete: telemetry.addMinorAthlete,
      updateMinorAthlete: telemetry.updateMinorAthlete,
      removeMinorAthlete: telemetry.removeMinorAthlete,
      lookupStaffCandidatesRemote: roleStaff.lookupStaffCandidatesRemote,
      registerAndVerifyCoach: supply.registerAndVerifyCoach,
      addCoachSessionOffer: supply.addCoachSessionOffer,
      updateCoachSessionOffer: supply.updateCoachSessionOffer,
      removeCoachSessionOffer: supply.removeCoachSessionOffer,
      addFacilitySchoolProgram: supply.addFacilitySchoolProgram,
      updateFacilitySchoolProgram: supply.updateFacilitySchoolProgram,
      removeFacilitySchoolProgram: supply.removeFacilitySchoolProgram,
      myStaffAssignments: roleStaff.myStaffAssignments,
      activeStaffAssignment: roleStaff.activeStaffAssignment,
      switchToStaffMode: roleStaff.switchToStaffMode,
      respondToStaffInvitation: roleStaff.respondToStaffInvitation,
      addFacilityStaffMember: roleStaff.addFacilityStaffMember,
      removeFacilityStaffMember: roleStaff.removeFacilityStaffMember,
      addFacilityCoachRosterEntry: supply.addFacilityCoachRosterEntry,
      removeFacilityCoachRosterEntry: supply.removeFacilityCoachRosterEntry,
      mergeExternalPlacesFacilities: supply.mergeExternalPlacesFacilities,
      placesHydrating: discovery.placesHydrating,
      publicSupplyHydrated: supply.publicSupplyHydrated,
      storageHydrated,
      validateAndSaveCoachBio: supply.validateAndSaveCoachBio,
      gracefulDisaffiliateCoach: supply.gracefulDisaffiliateCoach,
      requestMutualAffiliation: supply.requestMutualAffiliation,
      approveAffiliationMutual: supply.approveAffiliationMutual,
      reviewEntityBadge: supply.reviewEntityBadge,
      claimFacilityAndVerify: supply.claimFacilityAndVerify,
      seedNewFacilityConcierge: supply.seedNewFacilityConcierge,
      resetDemoData,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      auth.currentPersona,
      auth.isAuthenticated,
      auth.authGateModalOpen,
      auth.authGateFeatureNameAr,
      auth.allPersonas,
      auth.memberRegistry,
      auth.accountSnapshots,
      roleStaff.activeWorkspaceContext,
      roleStaff.roleClaims,
      roleStaff.activeStaffAssignment,
      roleStaff.myStaffAssignments,
      supply.facilities,
      supply.coaches,
      supply.articles,
      supply.publicSupplyHydrated,
      discovery.userLocation,
      discovery.locationModalOpen,
      discovery.smartFilters,
      discovery.filterModalOpen,
      discovery.savedFavoriteIds,
      discovery.compareFacilityIds,
      discovery.placesHydrating,
      telemetry.notifications,
      telemetry.userSettings,
      telemetry.demandSubmissions,
      telemetry.minorAthletes,
      telemetry.pbRecords,
      telemetry.skillEvaluation,
      telemetry.skillEvaluationsByAthlete,
      telemetry.verifiedLeads,
      telemetry.demandRadar,
      poolDesk.isBrowserOffline,
      poolDesk.sessionLedgers,
      poolDesk.offlineQueue,
      poolDesk.facilityLinks,
      storageHydrated,
    ]
  );

  return <CaptenlyContext.Provider value={value}>{children}</CaptenlyContext.Provider>;
}

export function useCaptenly() {
  const ctx = useContext(CaptenlyContext);
  if (!ctx) {
    throw new Error("useCaptenly must be used within a CaptenlyProvider");
  }
  return ctx;
}
