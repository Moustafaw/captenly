"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Coach,
  CoachSessionOffer,
  DemandRadarEntry,
  DemandRadarSubmission,
  EditorialArticle,
  Facility,
  FacilityCoachRosterEntry,
  FacilitySchoolProgram,
  FacilityStaffMember,
  FacilityStaffRole,
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
  UserSocialLinks,
  VerifiedLeadItem,
} from "@/types/captenly";
import { EGYPT_CITY_PRESETS, calculateDistanceKm } from "@/lib/maps";
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
  INITIAL_SKILL_EVALUATION,
  INITIAL_VERIFIED_LEADS,
  PERSONA_ACCOUNTS,
  PROHIBITED_MEDICAL_KEYWORDS,
} from "@/data/seedData";

const DEFAULT_SMART_FILTERS: SmartFiltersState = {
  searchQuery: "",
  sportCategory: "all",
  city: "الكل",
  maxDistanceKm: 30,
  maxPriceEgp: 2500,
  heatedOnly: false,
  ladiesOnly: false,
  freeTrialOnly: false,
  ozoneOnly: false,
  lifeguardOnly: false,
  warmChangingOnly: false,
  aedOnly: false,
  laneDensity: "all",
  sortBy: "nearest",
};

interface CaptenlyContextType {
  // Active Persona / Auth State
  currentPersona: PersonaAccount;
  isAuthenticated: boolean;
  authGateModalOpen: boolean;
  authGateFeatureNameAr: string;
  openAuthGateModal: (featureNameAr?: string) => void;
  closeAuthGateModal: () => void;
  switchPersona: (personaId: string) => void;
  updateCurrentPersonaAvatar: (avatarDataUrl: string) => void;
  updateCurrentPersonaProfile: (patch: {
    fullNameAr?: string;
    phone?: string;
    city?: string;
    bioAr?: string;
    socialLinks?: UserSocialLinks;
    hasParentSupervision?: boolean;
  }) => void;
  allPersonas: PersonaAccount[];
  isOfflineSimulated: boolean;
  isBrowserOffline: boolean;
  effectiveOffline: boolean;
  toggleOfflineSimulation: () => void;

  // Member Codes Registry & Auth Registration
  memberRegistry: MemberRegistryEntry[];
  registerMemberUser: (payload: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    sportPreference: "swimming" | "fitness" | "both";
    hasParentSupervision: boolean;
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
  }) => { ok: boolean; persona: PersonaAccount; memberCode: string };
  loginOrCreateWithGoogle: (payload: {
    name: string;
    email: string;
    image?: string | null;
    isSimulatedPreview?: boolean;
  }) => { ok: boolean; isNewUser: boolean; persona: PersonaAccount; memberCode: string };
  restoreOrLoginWithGoogle: (payload: {
    name: string;
    email: string;
    image?: string | null;
    isSimulatedPreview?: boolean;
  }) => Promise<{ ok: boolean; isNewUser: boolean; persona: PersonaAccount; memberCode: string }>;
  restoreProfileByLogin: (query: string) => Promise<{
    ok: boolean;
    persona?: PersonaAccount;
    messageAr?: string;
  }>;
  completeGoogleOnboarding: (payload: {
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
    phone?: string;
    city?: string;
    hasParentSupervision?: boolean;
  }) => { ok: boolean; persona: PersonaAccount };
  signOutToGuest: () => void;

  // Location & Proximity (Dynamic Geolocation & Coverage Fallback)
  userLocation: UserLocation;
  setUserCity: (city: string, gov?: string) => void;
  setUserCoordinates: (coords: {
    lat: number;
    lng: number;
    city: string;
    governorate?: string;
  }) => void;
  resetLocationToAllEgypt: () => void;
  requestAutoGeolocation: () => Promise<void>;
  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;

  // Smart Filters & Modal
  smartFilters: SmartFiltersState;
  updateSmartFilters: (patch: Partial<SmartFiltersState>) => void;
  resetSmartFilters: () => void;
  filterModalOpen: boolean;
  setFilterModalOpen: (open: boolean) => void;

  // Favorites & Bookmarks
  savedFavoriteIds: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // Notifications
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => void;
  unreadNotificationsCount: number;

  // Editorial Articles & Newsletter
  articles: EditorialArticle[];
  saveEditorialArticle: (payload: {
    id?: string;
    titleAr: string;
    categoryAr: string;
    readTimeMinutes?: number;
    readingMinutes?: number;
    excerptAr: string;
    keyTakeawaysAr?: string[];
    bodyParagraphsAr?: string[];
    contentMarkdownAr?: string;
    imageUrl?: string;
    authorNameAr?: string;
    authorRoleAr?: string;
    authorType?: "coach" | "facility" | "editorial";
    authorEntityId?: string;
    authorSlug?: string;
  }) => { ok: boolean; article?: EditorialArticle; messageAr: string };
  deleteEditorialArticle: (articleId: string) => void;
  subscribeNewsletter: (email: string) => { ok: boolean; messageAr: string };

  // Facility Staff Role Switching & Academy Coach Roster
  myStaffAssignments: FacilityStaffMember[];
  activeStaffAssignment: FacilityStaffMember | null;
  switchToStaffMode: (staffAssignmentId: string | null) => void;
  addFacilityStaffMember: (
    facilityId: string,
    payload: {
      fullNameAr: string;
      role: FacilityStaffRole;
      roleTitleAr?: string;
      phone?: string;
      memberCodeOrQuery?: string;
    }
  ) => { ok: boolean; staff?: FacilityStaffMember; messageAr: string };
  removeFacilityStaffMember: (facilityId: string, staffId: string) => void;
  addFacilityCoachRosterEntry: (
    facilityId: string,
    payload: {
      fullNameAr: string;
      roleTitleAr: string;
      specialtyAr: string;
      certificatesAr: string[];
      scheduleAr?: string;
      coachIdOrCode?: string;
    }
  ) => { ok: boolean; entry?: FacilityCoachRosterEntry; messageAr: string };
  removeFacilityCoachRosterEntry: (facilityId: string, entryId: string) => void;

  // User Settings & Law 151
  userSettings: {
    familyLaw151Consent: boolean;
    notifyWhatsappSessions: boolean;
    notifyWhatsappRenewals: boolean;
    notifyEmailMarketing: boolean;
    privacyProfilePublic: boolean;
  };
  updateUserSettings: (newSettings: Partial<{
    familyLaw151Consent: boolean;
    notifyWhatsappSessions: boolean;
    notifyWhatsappRenewals: boolean;
    notifyEmailMarketing: boolean;
    privacyProfilePublic: boolean;
  }>) => void;

  // Demand Radar Waitlist Subscription
  subscribeDemandRadar: (entry: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    targetSport: "swimming" | "fitness" | "other";
    notes?: string;
  }) => { ok: boolean; messageAr: string };
  demandSubmissions: DemandRadarSubmission[];

  // Entities
  facilities: Facility[];
  coaches: Coach[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluation: SkillEvaluation5Point;
  sessionLedgers: SessionLedger[];
  verifiedLeads: VerifiedLeadItem[];
  demandRadar: DemandRadarEntry[];
  offlineQueue: OfflineCheckinQueueItem[];
  syncOfflineQueue: () => number;

  // Comparison State (up to 4 facilities - MVP-04)
  compareFacilityIds: string[];
  toggleCompareFacility: (facilityId: string) => { ok: boolean; messageAr?: string };
  clearComparison: () => void;

  // Actions across the 3 Engines
  confirmFacilityPrices60d: (facilityId: string, updatedBasePriceEgp?: number) => void;
  simulateTimeTravelDays: (facilityId: string, daysAgo: number) => void;
  createStructuredWhatsappLead: (payload: {
    targetType: "facility" | "coach";
    targetId: string;
    targetNameAr: string;
    whatsappNumber?: string;
    inquirerNameAr: string;
    inquirerPhone: string;
    athleteAge: number;
    requestedSpecialtyAr: string;
    preferredScheduleAr: string;
  }) => { referralCode: string; whatsappUrl: string; isDuplicate30d: boolean };

  // Session Ledger, Enrollment & InstaPay Actions (MVP-09..10)
  enrollSwimmerByMemberCode: (payload: {
    memberCode: string;
    athleteNameAr?: string;
    facilityId: string;
    coachId?: string;
    trackType?: "school" | "buds" | "prep" | "team" | "ladies";
    trackLabelAr?: string;
    packageTitleAr: string;
    totalSessions: 8 | 12 | 24;
    amountEgp: number;
    isMinor?: boolean;
    parentNameAr?: string;
  }) => { ok: boolean; ledger?: SessionLedger; messageAr: string };

  checkInSession: (
    ledgerId: string,
    enteredPinOrQr: string,
    method: "pin_4digit" | "qr_scan" | "offline_sync",
    coachNoteAr?: string
  ) => { ok: boolean; messageAr: string };

  checkInBySubscriptionCode: (
    codeInput: string,
    facilityId?: string,
    coachNoteAr?: string
  ) => { ok: boolean; expired?: boolean; ledger?: SessionLedger; messageAr: string };

  renewSwimmerSubscription: (
    ledgerIdOrPayload:
      | string
      | {
          ledgerId: string;
          totalSessions?: 8 | 12 | 24;
          packageTitleAr?: string;
          amountEgp?: number;
        },
    totalSessions?: 8 | 12 | 24,
    amountEgp?: number
  ) => { ok: boolean; ledger?: SessionLedger; messageAr: string };

  uploadInstaPayReceipt: (
    ledgerId: string,
    payload: {
      referenceNumber: string;
      channel: "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)";
      amountEgp: number;
      packageTitleAr: string;
    }
  ) => void;

  lookupRemoteLedgersOrProfile: (query: {
    memberCode?: string;
    ledgerCode?: string;
    coachId?: string;
    facilityId?: string;
  }) => Promise<{
    ledgers: SessionLedger[];
    profile: {
      memberCode: string;
      fullNameAr: string;
      phone: string;
      city: string;
      role: string;
      avatarUrl?: string;
    } | null;
  }>;
  syncLedgersFromServer: () => Promise<void>;

  addNewPBRecord: (record: Omit<PersonalBestRecord, "id" | "recordedDateAr">) => void;
  recordCoachSkillAndPB: (payload: {
    athleteId?: string;
    swimmerNameAr: string;
    eventTitleAr: string;
    currentValue: number;
    unitAr?: string;
    coachNameAr: string;
    facilityNameAr?: string;
    skills?: SkillEvaluation5Point;
  }) => void;
  addMinorAthlete: (child: {
    fullNameAr: string;
    age: number;
    gender: "male" | "female";
    primarySport: "swimming" | "fitness";
  }) => void;

  // Coach Registration, Verification & Law 3/1985 Filter
  registerAndVerifyCoach: (payload: {
    fullNameAr: string;
    titleAr: string;
    phone: string;
    city: string;
    governorate: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    yearsExperience: number;
    bioAr: string;
    avatarUrl?: string;
    whatsappNumber?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    socialLinks?: UserSocialLinks;
    instapayHandle?: string;
    privatePackage8Egp: number;
    privatePackage12Egp: number;
    specialtiesAr: string[];
    syndicateCardRef: string;
    edlfCertRef?: string;
    facilityId?: string;
  }) => { ok: boolean; coach?: Coach; detectedKeyword?: string; messageAr: string };

  addCoachSessionOffer: (coachId: string, offer: Omit<CoachSessionOffer, "id">) => { ok: boolean; messageAr: string };
  updateCoachSessionOffer: (coachId: string, offerId: string, patch: Partial<Omit<CoachSessionOffer, "id">>) => { ok: boolean; messageAr: string };
  removeCoachSessionOffer: (coachId: string, offerId: string) => void;
  addFacilitySchoolProgram: (facilityId: string, program: Omit<FacilitySchoolProgram, "id">) => { ok: boolean; messageAr: string };
  updateFacilitySchoolProgram: (facilityId: string, programId: string, patch: Partial<Omit<FacilitySchoolProgram, "id">>) => { ok: boolean; messageAr: string };
  removeFacilitySchoolProgram: (facilityId: string, programId: string) => void;
  mergeExternalPlacesFacilities: (externalPlaces: Facility[]) => void;
  placesHydrating: boolean;

  validateAndSaveCoachBio: (
    coachId: string,
    newBioAr: string
  ) => { ok: boolean; detectedKeyword?: string; messageAr: string };
  gracefulDisaffiliateCoach: (coachId: string, facilityId: string) => void;
  requestMutualAffiliation: (
    coachId: string,
    facilityId: string,
    scheduleAr: string,
    roleAr: string
  ) => void;
  approveAffiliationMutual: (coachId: string, facilityId: string) => void;

  // Facility Claim, Package Publishing & Admin Concierge
  publishSchoolPackage: (payload: {
    facilityId: string;
    nameAr: string;
    sessionsCount: number;
    sessionsPerWeek: number;
    durationMinutes: number;
    baseMonthlyEgp: number;
    assessmentFeeEgp?: number;
    membershipCardFeeEgp?: number;
  }) => { ok: boolean; messageAr: string };

  claimFacilityAndVerify: (
    facilityId: string,
    payload: {
      managerName: string;
      roleTitleAr: string;
      phone: string;
      whatsappNumber?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      instapayHandle?: string;
      updatedBasePriceEgp?: number;
      commercialRegRef?: string;
    }
  ) => { ok: boolean; facility?: Facility; messageAr: string };

  seedNewFacilityConcierge: (newFac: {
    nameAr: string;
    city: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    baseMonthlyPrice: number;
    whatsappNumber?: string;
    isHeatedWinter: boolean;
    hasLadiesSlots: boolean;
  }) => Facility;

  claimFacilityListing: (facilityId: string, managerName: string, phone: string) => void;
  resetDemoData: () => void;
}

const CaptenlyContext = createContext<CaptenlyContextType | undefined>(undefined);

const STORAGE_KEY = "captenly_platform_state_v6";
const LEGACY_STORAGE_KEY_V5 = "captenly_platform_state_v5";
const LEGACY_FAKE_PERSONA_IDS = new Set([
  "persona-athlete-independent",
  "persona-parent",
  "persona-facility",
  "persona-coach",
]);

export function CaptenlyProvider({ children }: { children: React.ReactNode }) {
  const [allPersonas, setAllPersonas] = useState<PersonaAccount[]>(PERSONA_ACCOUNTS);
  const [currentPersona, setCurrentPersona] = useState<PersonaAccount>(GUEST_PERSONA);
  const [authGateModalOpen, setAuthGateModalOpen] = useState<boolean>(false);
  const [authGateFeatureNameAr, setAuthGateFeatureNameAr] = useState<string>("");
  const [memberRegistry, setMemberRegistry] = useState<MemberRegistryEntry[]>(INITIAL_MEMBER_REGISTRY);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(false);

  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [placesHydrating, setPlacesHydrating] = useState<boolean>(true);
  const [coaches, setCoaches] = useState<Coach[]>(INITIAL_COACHES);
  const [minorAthletes, setMinorAthletes] = useState<MinorAthleteProfile[]>(INITIAL_MINOR_ATHLETES);
  const [pbRecords, setPbRecords] = useState<PersonalBestRecord[]>(INITIAL_PB_RECORDS);
  const [skillEvaluation, setSkillEvaluation] = useState<SkillEvaluation5Point>(INITIAL_SKILL_EVALUATION);
  const [sessionLedgers, setSessionLedgers] = useState<SessionLedger[]>(INITIAL_SESSION_LEDGERS);
  const [verifiedLeads, setVerifiedLeads] = useState<VerifiedLeadItem[]>(INITIAL_VERIFIED_LEADS);
  const [demandRadar, setDemandRadar] = useState<DemandRadarEntry[]>(INITIAL_DEMAND_RADAR);
  const [demandSubmissions, setDemandSubmissions] = useState<DemandRadarSubmission[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckinQueueItem[]>([]);
  const [compareFacilityIds, setCompareFacilityIds] = useState<string[]>([]);
  const [newsletterEmails, setNewsletterEmails] = useState<string[]>([]);

  // Location & Modals (Egypt-wide default when user hasn't picked a specific location yet)
  const DEFAULT_EGYPT_LOCATION: UserLocation = {
    city: "كل مصر",
    governorate: "نطاق مفتوح",
    lat: 30.0444,
    lng: 31.2357,
    isAutoDetected: false,
    isSpecified: false,
    distanceKm: 0,
    isOutsideCoverage: false,
  };
  const [userLocation, setUserLocation] = useState<UserLocation>(DEFAULT_EGYPT_LOCATION);
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [smartFilters, setSmartFilters] = useState<SmartFiltersState>(DEFAULT_SMART_FILTERS);

  const [savedFavoriteIds, setSavedFavoriteIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [articles, setArticles] = useState<EditorialArticle[]>(INITIAL_ARTICLES);
  const [activeStaffAssignmentId, setActiveStaffAssignmentId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState({
    familyLaw151Consent: false,
    notifyWhatsappSessions: true,
    notifyWhatsappRenewals: true,
    notifyEmailMarketing: false,
    privacyProfilePublic: false,
  });

  const isAuthenticated =
    currentPersona.role !== "guest" && currentPersona.id !== "persona-guest";
  const openAuthGateModal = (featureNameAr = "استخدام هذه الميزة") => {
    setAuthGateFeatureNameAr(featureNameAr);
    setAuthGateModalOpen(true);
  };
  const closeAuthGateModal = () => setAuthGateModalOpen(false);
  const effectiveOffline = isOfflineSimulated || isBrowserOffline;

  // Hydrate persisted Offline-First state from localStorage (zero fake seeded personas/favorites/notifications)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.allPersonas)) {
          const cleanPersonas = (parsed.allPersonas as PersonaAccount[]).filter(
            (p) => p && !LEGACY_FAKE_PERSONA_IDS.has(p.id)
          );
          setAllPersonas(cleanPersonas.length ? cleanPersonas : PERSONA_ACCOUNTS);
        }
        if (Array.isArray(parsed.memberRegistry)) {
          setMemberRegistry(
            (parsed.memberRegistry as MemberRegistryEntry[]).filter(
              (m) => m && !LEGACY_FAKE_PERSONA_IDS.has(m.athleteId) && m.memberCode !== "CAP-M-5190" && m.memberCode !== "CAP-M-4821"
            )
          );
        }
        if (Array.isArray(parsed.facilities)) {
          setFacilities(
            (parsed.facilities as Facility[]).filter(
              (f) => f && f.sportSector !== "fitness" && !f.id.startsWith("fac-")
            )
          );
        }
        if (parsed.coaches) setCoaches(parsed.coaches);
        if (parsed.minorAthletes) setMinorAthletes(parsed.minorAthletes);
        if (parsed.pbRecords) setPbRecords(parsed.pbRecords);
        if (parsed.sessionLedgers) setSessionLedgers(parsed.sessionLedgers);
        if (parsed.verifiedLeads) setVerifiedLeads(parsed.verifiedLeads);
        if (parsed.demandRadar) setDemandRadar(parsed.demandRadar);
        if (parsed.demandSubmissions) setDemandSubmissions(parsed.demandSubmissions);
        if (parsed.offlineQueue) setOfflineQueue(parsed.offlineQueue);
        if (Array.isArray(parsed.savedFavoriteIds)) setSavedFavoriteIds(parsed.savedFavoriteIds);
        if (Array.isArray(parsed.compareFacilityIds)) setCompareFacilityIds(parsed.compareFacilityIds);
        if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications);
        if (Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          setArticles(parsed.articles);
        }
        if (typeof parsed.activeStaffAssignmentId === "string" || parsed.activeStaffAssignmentId === null) {
          setActiveStaffAssignmentId(parsed.activeStaffAssignmentId);
        }
        if (parsed.userSettings) setUserSettings(parsed.userSettings);
        if (parsed.newsletterEmails) setNewsletterEmails(parsed.newsletterEmails);
        if (parsed.userLocation && parsed.userLocation.isSpecified) setUserLocation(parsed.userLocation);
        if (parsed.personaId && !LEGACY_FAKE_PERSONA_IDS.has(parsed.personaId)) {
          const pool = Array.isArray(parsed.allPersonas) ? parsed.allPersonas : PERSONA_ACCOUNTS;
          const found = pool.find((p: PersonaAccount) => p.id === parsed.personaId);
          setCurrentPersona(found || GUEST_PERSONA);
        } else {
          setCurrentPersona(GUEST_PERSONA);
        }
      } else {
        // One-time clean migration from v5: preserve userLocation & genuinely signed-in accounts only
        const legacyV5 = localStorage.getItem(LEGACY_STORAGE_KEY_V5);
        if (legacyV5) {
          const parsed = JSON.parse(legacyV5);
          if (parsed.userLocation && parsed.userLocation.isSpecified) setUserLocation(parsed.userLocation);
          if (Array.isArray(parsed.allPersonas)) {
            const realAccounts = (parsed.allPersonas as PersonaAccount[]).filter(
              (p) =>
                p &&
                !LEGACY_FAKE_PERSONA_IDS.has(p.id) &&
                p.role !== "guest" &&
                (p.authProvider === "google" || p.id.startsWith("user-") || p.id.startsWith("google-"))
            );
            if (realAccounts.length > 0) {
              setAllPersonas([GUEST_PERSONA, ...realAccounts]);
              const activeReal = realAccounts.find((p) => p.id === parsed.personaId);
              if (activeReal) {
                setCurrentPersona(activeReal);
              }
            }
          }
          if (Array.isArray(parsed.coaches) && parsed.coaches.length > 0) {
            setCoaches(parsed.coaches);
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Hydrate real registered Captenly academies/coaches from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/supabase/public-supply")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        if (Array.isArray(data.facilities) && data.facilities.length > 0) {
          setFacilities((prev) => {
            const byId = new Map(prev.map((f) => [f.id, f]));
            for (const remote of data.facilities as Facility[]) {
              const local = byId.get(remote.id) || (remote.googlePlaceId ? prev.find((p) => p.googlePlaceId === remote.googlePlaceId) : undefined);
              if (!local) {
                byId.set(remote.id, remote);
              } else if (
                local.supplyStatus === "seeded_unclaimed" ||
                (remote.supplyStatus !== "seeded_unclaimed" &&
                  ((remote.schoolPrograms?.length || 0) >= (local.schoolPrograms?.length || 0) ||
                    (remote.coachRoster?.length || 0) >= (local.coachRoster?.length || 0) ||
                    (remote.staffMembers?.length || 0) >= (local.staffMembers?.length || 0)))
              ) {
                byId.set(local.id, { ...local, ...remote, id: remote.id });
              }
            }
            return Array.from(byId.values());
          });
        }
        if (Array.isArray(data.coaches) && data.coaches.length > 0) {
          setCoaches((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            for (const remote of data.coaches as Coach[]) {
              const local = byId.get(remote.id);
              if (!local || ((remote.sessionOffers?.length || 0) >= (local.sessionOffers?.length || 0))) {
                byId.set(remote.id, remote);
              }
            }
            return Array.from(byId.values());
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch live swimming pools from Google Places (Egypt-wide when unspecified, or localized when selected)
  useEffect(() => {
    let cancelled = false;
    setPlacesHydrating(true);
    const params = new URLSearchParams();
    if (userLocation.isSpecified) {
      if (userLocation.city) params.set("city", userLocation.city);
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    } else {
      params.set("scope", "egypt");
    }

    fetch(`/api/places/search?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.places) && data.places.length > 0) {
          mergeExternalPlacesFacilities(data.places as Facility[]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setPlacesHydrating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation.isSpecified, userLocation.city, userLocation.lat, userLocation.lng]);

  // Persist changes back to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          personaId: currentPersona.id,
          allPersonas,
          memberRegistry,
          facilities,
          coaches,
          minorAthletes,
          pbRecords,
          sessionLedgers,
          verifiedLeads,
          demandRadar,
          demandSubmissions,
          offlineQueue,
          savedFavoriteIds,
          compareFacilityIds,
          notifications,
          articles,
          activeStaffAssignmentId,
          userSettings,
          newsletterEmails,
          userLocation,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [
    currentPersona,
    allPersonas,
    memberRegistry,
    facilities,
    coaches,
    minorAthletes,
    pbRecords,
    sessionLedgers,
    verifiedLeads,
    demandRadar,
    demandSubmissions,
    offlineQueue,
    savedFavoriteIds,
    compareFacilityIds,
    notifications,
    articles,
    activeStaffAssignmentId,
    userSettings,
    newsletterEmails,
    userLocation,
  ]);

  // Real PWA Service Worker registration (in production) + online/offline network listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsBrowserOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsBrowserOffline(false);
    };
    const handleOffline = () => {
      setIsBrowserOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Hydrate persisted remote notifications for active memberCode when available
  useEffect(() => {
    const memberCode = currentPersona.memberCode;
    if (!memberCode) return;
    let cancelled = false;
    fetch(`/api/supabase/notifications?memberCode=${encodeURIComponent(memberCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.persisted || !Array.isArray(data.items) || data.items.length === 0) {
          return;
        }
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const existingSignatures = new Set(prev.map((n) => `${n.titleAr}::${n.messageAr}`));
          const mapped: NotificationItem[] = [];
          for (const row of data.items) {
            const sig = `${row.title_ar}::${row.message_ar}`;
            if (existingIds.has(row.id) || existingSignatures.has(sig)) continue;
            mapped.push({
              id: row.id,
              titleAr: row.title_ar,
              messageAr: row.message_ar,
              type: (row.notif_type || "system") as NotificationItem["type"],
              actionLabelAr: row.action_label_ar || undefined,
              actionHref: row.action_href || undefined,
              isRead: Boolean(row.is_read),
              timeAr: "سحابي",
            });
          }
          return mapped.length > 0 ? [...mapped, ...prev] : prev;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentPersona.memberCode]);

  const pushNotification = (notif: Omit<NotificationItem, "id" | "isRead" | "timeAr">) => {
    setNotifications((prev) => [
      {
        ...notif,
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timeAr: "الآن",
        isRead: false,
      },
      ...prev,
    ]);
    if (currentPersona.memberCode) {
      postSupabaseSync("/api/supabase/notifications", {
        memberCode: currentPersona.memberCode,
        titleAr: notif.titleAr,
        messageAr: notif.messageAr,
        type: notif.type,
        actionLabelAr: notif.actionLabelAr,
        actionHref: notif.actionHref,
      });
    }
  };

  const mergeRemoteLedgers = (incoming: SessionLedger[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setSessionLedgers((prev) => {
      const byId = new Map(prev.map((l) => [l.id, l]));
      for (const remote of incoming) {
        const local = byId.get(remote.id);
        if (!local) {
          byId.set(remote.id, remote);
        } else {
          // Keep the version with more progress/checkins, or remote if equal
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
        setMemberRegistry((prev) => {
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
    if (!isAuthenticated || effectiveOffline) return;
    await lookupRemoteLedgersOrProfile({
      memberCode: currentPersona.memberCode || undefined,
      coachId: currentPersona.role === "coach" ? currentPersona.id : undefined,
      facilityId: currentPersona.linkedFacilityId || undefined,
    });
  };

  // Hydrate persisted Session Ledgers across devices when authenticated or window regains focus
  useEffect(() => {
    if (!isAuthenticated || effectiveOffline) return;
    syncLedgersFromServer();
    const onFocus = () => {
      syncLedgersFromServer();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentPersona.id, currentPersona.memberCode, currentPersona.linkedFacilityId, effectiveOffline]);

  const syncOfflineQueue = () => {
    const pendingItems = offlineQueue.filter((q) => !q.synced);
    const pendingCount = pendingItems.length;
    if (pendingCount === 0) return 0;

    const syncedIds = new Set(pendingItems.map((q) => q.ledgerId));
    setOfflineQueue((prev) => prev.map((q) => ({ ...q, synced: true })));
    setSessionLedgers((prev) => {
      const next = prev.map((l) => {
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
      });
      return next;
    });

    pushNotification({
      titleAr: `مزامنة ${pendingCount} حصة أوفلاين بنجاح`,
      messageAr: "تم رفع بصمات الحضور المحفوظة محلياً دون فقدان أي حصة بمجرد استقرار الاتصال.",
      type: "session_reminder",
      actionLabelAr: "عرض دفتر الحصص",
      actionHref: "/dashboard/ledger",
    });

    return pendingCount;
  };

  // Auto-sync offline queue when connection returns and simulation is off
  useEffect(() => {
    if (!effectiveOffline && offlineQueue.some((q) => !q.synced)) {
      syncOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOffline]);

  const getNearestFacilityDistance = (lat: number, lng: number) => {
    if (facilities.length === 0) return 0;
    const minDist = Math.min(
      ...facilities.map((f) => calculateDistanceKm(lat, lng, f.coordinates.lat, f.coordinates.lng))
    );
    return Math.round(minDist * 10) / 10;
  };

  const syncAccountCityFromLocation = (cleanCity: string, cleanGov = "مصر") => {
    if (!cleanCity || cleanCity === "كل مصر" || cleanCity === "الكل") return;
    const normalizedCity = cleanCity.replace(/\s*\(GPS\)/g, "").trim();
    if (!normalizedCity || normalizedCity === "موقعك الحالي") return;

    setCurrentPersona((prev) => {
      if (prev.role === "guest" || prev.id === "persona-guest") return prev;
      if (prev.city === normalizedCity) return prev;
      const next: PersonaAccount = { ...prev, city: normalizedCity };
      setAllPersonas((list) => list.map((p) => (p.id === next.id ? next : p)));
      setMemberRegistry((list) =>
        list.map((m) => (m.athleteId === next.id ? { ...m, city: normalizedCity } : m))
      );
      if (next.memberCode || next.email) {
        postSupabaseSync("/api/supabase/sync-profile", {
          memberCode: next.memberCode || `FAC-${next.id.slice(-6)}`,
          email: next.email,
          fullNameAr: next.fullNameAr,
          role: next.role,
          phone: next.phone,
          city: normalizedCity,
          governorate: cleanGov,
          avatarUrl: next.avatarUrl,
          bioAr: next.bioAr,
          socialLinks: next.socialLinks,
          hasParentSupervision: next.hasParentSupervision,
          needsOnboarding: false,
        });
      }
      return next;
    });
  };

  const applyAccountCityToUserLocation = (accountCity?: string, accountGov = "مصر") => {
    const clean = (accountCity || "").trim();
    if (!clean || clean === "مصر" || clean === "كل مصر" || clean === "الكل") return;
    const preset = EGYPT_CITY_PRESETS.find((p) => p.city === clean || clean.includes(p.city));
    const lat = preset?.lat ?? (clean === "طنطا" ? 30.7865 : clean === "زفتى" ? 30.7124 : 30.0444);
    const lng = preset?.lng ?? (clean === "طنطا" ? 31.0004 : clean === "زفتى" ? 31.2423 : 31.2357);
    const dist = facilities.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;

    setUserLocation({
      city: preset?.city || clean,
      governorate: preset?.governorate || accountGov,
      lat,
      lng,
      isAutoDetected: false,
      isSpecified: true,
      distanceKm: dist,
      isOutsideCoverage: false,
    });
  };

  const setUserCoordinates = ({
    lat,
    lng,
    city,
    governorate = "مصر",
  }: {
    lat: number;
    lng: number;
    city: string;
    governorate?: string;
  }) => {
    const distanceKm = facilities.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;
    setUserLocation({
      city,
      governorate,
      lat,
      lng,
      isAutoDetected: false,
      isSpecified: true,
      distanceKm,
      isOutsideCoverage: false,
    });
    syncAccountCityFromLocation(city, governorate);
  };

  const setUserCity = (city: string, gov = "مصر") => {
    if (!city || city === "كل مصر" || city === "الكل") {
      setUserLocation(DEFAULT_EGYPT_LOCATION);
      return;
    }
    const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
    const lat = preset?.lat ?? (city === "طنطا" ? 30.7865 : city === "زفتى" ? 30.7124 : 30.0444);
    const lng = preset?.lng ?? (city === "طنطا" ? 31.0004 : city === "زفتى" ? 31.2423 : 31.2357);
    const dist = facilities.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;
    const resolvedGov = preset?.governorate || gov;

    setUserLocation({
      city,
      governorate: resolvedGov,
      lat,
      lng,
      isAutoDetected: false,
      isSpecified: true,
      distanceKm: dist,
      isOutsideCoverage: false,
    });
    syncAccountCityFromLocation(city, resolvedGov);
  };

  const resetLocationToAllEgypt = () => {
    setUserLocation(DEFAULT_EGYPT_LOCATION);
  };

  const requestAutoGeolocation = async () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat1 = pos.coords.latitude;
          const lon1 = pos.coords.longitude;
          let nearestPreset = EGYPT_CITY_PRESETS[0];
          let minPresetDist = Number.MAX_SAFE_INTEGER;
          for (const p of EGYPT_CITY_PRESETS) {
            const d = calculateDistanceKm(lat1, lon1, p.lat, p.lng);
            if (d < minPresetDist) {
              minPresetDist = d;
              nearestPreset = p;
            }
          }
          const nearPreset = minPresetDist <= 28;
          const distanceKm = facilities.length > 0 ? getNearestFacilityDistance(lat1, lon1) : 0;

          setUserLocation({
            city: nearPreset ? `${nearestPreset.city} (GPS)` : "موقعك الحالي (GPS)",
            governorate: nearPreset ? nearestPreset.governorate : "مصر",
            lat: lat1,
            lng: lon1,
            isAutoDetected: true,
            isSpecified: true,
            distanceKm,
            isOutsideCoverage: false,
          });
        },
        () => {
          // If user denies GPS or it fails, keep open Egypt-wide discovery instead of forcing any city
          setUserLocation((prev) => (prev.isSpecified ? prev : DEFAULT_EGYPT_LOCATION));
        }
      );
    }
  };

  const updateSmartFilters = (patch: Partial<SmartFiltersState>) => {
    setSmartFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetSmartFilters = () => setSmartFilters(DEFAULT_SMART_FILTERS);

  const toggleFavorite = (id: string) => {
    if (!isAuthenticated) {
      openAuthGateModal("حفظ المنشآت والكباتن في المفضلة");
      return;
    }
    setSavedFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isFavorite = (id: string) => (isAuthenticated ? savedFavoriteIds.includes(id) : false);

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) {
      postSupabaseSync("/api/supabase/notifications", { markReadId: id });
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const updateUserSettings = (newSettings: Partial<typeof userSettings>) => {
    setUserSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const subscribeNewsletter = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      return { ok: false, messageAr: "يرجى إدخال بريد إلكتروني صحيح." };
    }
    if (!newsletterEmails.includes(clean)) {
      setNewsletterEmails((prev) => [clean, ...prev]);
    }
    return {
      ok: true,
      messageAr: "تم اشتراكك في نشرة كابتنلي الأسبوعية بنجاح! سيصلك دليل الخميس القادم.",
    };
  };

  /** Fire-and-forget background sync to Supabase API routes (offline/optimistic UX preserved). */
  const postSupabaseSync = (path: string, body: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  const syncFacilityToSupabase = (fac: Facility) => {
    postSupabaseSync("/api/supabase/public-supply", { facility: fac });
  };

  const syncCoachToSupabase = (coach: Coach) => {
    postSupabaseSync("/api/supabase/public-supply", { coach });
  };

  const subscribeDemandRadar = (entry: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    targetSport: "swimming" | "fitness" | "other";
    notes?: string;
  }) => {
    if (!isAuthenticated) {
      openAuthGateModal("إرسال طلب توافر منشآت في منطقتك");
      return {
        ok: false,
        messageAr: "يرجى تسجيل الدخول أو إنشاء حساب في Captenly أولاً.",
      };
    }
    const submission: DemandRadarSubmission = {
      id: `sub-${Date.now()}`,
      ...entry,
      createdAt: "الآن",
    };
    setDemandSubmissions((prev) => [submission, ...prev]);

    setDemandRadar((prev) => {
      const idx = prev.findIndex((d) => d.city === entry.city);
      if (idx >= 0) {
        return prev.map((d, i) =>
          i === idx ? { ...d, totalSearchesMonth: d.totalSearchesMonth + 1 } : d
        );
      }
      return [
        {
          city: entry.city,
          governorate: entry.governorate,
          totalSearchesMonth: 1,
          topUnmetFilters: [
            {
              filterTitleAr: "أكاديميات ومسابح سباحة معتمدة",
              searchCount: 1,
              percentage: 100,
              opportunityNoteAr: `طلب جديد مسجل لمدينة ${entry.city}`,
            },
          ],
        },
        ...prev,
      ];
    });

    pushNotification({
      titleAr: `طلب توسع في ${entry.city}`,
      messageAr: `تم حفظ تسجيلك بنجاح في رادار الطلب التفاعلي لمدينة ${entry.city}.`,
      type: "system",
    });

    postSupabaseSync("/api/supabase/demand-radar", {
      fullNameAr: entry.fullNameAr,
      phone: entry.phone,
      city: entry.city,
      governorate: entry.governorate,
      targetSport: entry.targetSport === "other" ? "both" : entry.targetSport,
    });

    return {
      ok: true,
      messageAr: `تم تسجيل طلبك لمدينة ${entry.city} بنجاح! سنبلغك فور تفعيل كابتن أو أكاديمية موثقة في نطاقك.`,
    };
  };

  const registerMemberUser = (payload: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    sportPreference: "swimming" | "fitness" | "both";
    hasParentSupervision: boolean;
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
  }) => {
    const random4 = Math.floor(1000 + Math.random() * 8999);
    const isFacilityRole = payload.role === "facility_manager";
    const prefix = payload.role === "coach" ? "CAP-C" : "CAP-M";
    const memberCode = isFacilityRole ? "" : `${prefix}-${random4}`;
    const newId = `user-${Date.now()}`;
    const firstName = payload.fullNameAr.split(" ")[0];

    const newPersona: PersonaAccount = {
      id: newId,
      role: payload.role,
      memberCode,
      hasParentSupervision: payload.role === "parent" ? true : payload.hasParentSupervision,
      shortLabelAr: isFacilityRole
        ? `إدارة (${firstName})`
        : `${firstName} (${memberCode})`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr:
        payload.role === "coach"
          ? `كابتن مسجّل — كود ${memberCode}`
          : isFacilityRole
          ? "مدير منشأة / أكاديمية"
          : payload.role === "parent" || payload.hasParentSupervision
          ? `حساب ولي أمر اختياري — ${memberCode}`
          : `رياضي مستقل — كود ${memberCode}`,
      city: payload.city,
      phone: payload.phone,
      descriptionAr: isFacilityRole
        ? "حساب إدارة منشأة وأكاديمية لإدارة المشتركين والفرق والطاقم والباقات."
        : "حساب مفعّل بكود عضوية فريد جاهز للربط مع الكباتن والأكاديميات الموثقة.",
    };

    setAllPersonas((prev) => [newPersona, ...prev]);
    setCurrentPersona(newPersona);
    setActiveStaffAssignmentId(null);
    applyAccountCityToUserLocation(payload.city, payload.governorate);

    if (payload.role === "adult_athlete" || payload.role === "parent") {
      const regEntry: MemberRegistryEntry = {
        memberCode,
        athleteId: newId,
        fullNameAr: payload.fullNameAr,
        phone: payload.phone,
        city: payload.city,
        role: payload.role,
        isMinor: false,
      };
      setMemberRegistry((prev) => [regEntry, ...prev]);
    }

    pushNotification({
      titleAr: `مرحباً بك في كابتنلي يا ${firstName}!`,
      messageAr: isFacilityRole
        ? "تم تفعيل حساب إدارة المنشأة بنجاح. يمكنك الآن توثيق صفحتك وإدارة المشتركين والموظفين والكباتن."
        : payload.role === "coach"
        ? `تم إنشاء حسابك ككابتن بكود تعريفي (${memberCode}). يمكنك الآن استكمال توثيق شاراتك ونشر عروضك.`
        : `تم توليد كود عضويتك الفريد ${memberCode}. عند الاشتراك مع أي أكاديمية سيتولد لك كود اشتراك متجدد خاص بالباقة.`,
      type: "school_card",
      actionLabelAr: isFacilityRole
        ? "لوحة المنشأة"
        : payload.role === "coach"
        ? "لوحة الكابتن"
        : "عرض حسابي",
      actionHref: isFacilityRole
        ? "/dashboard/facility"
        : payload.role === "coach"
        ? "/dashboard/coach"
        : "/dashboard/athlete",
    });

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode: memberCode || `FAC-${random4}`,
      fullNameAr: payload.fullNameAr,
      role: payload.role,
      phone: payload.phone,
      city: payload.city,
      governorate: payload.governorate,
      authProvider: "captenly",
      hasParentSupervision: newPersona.hasParentSupervision,
      needsOnboarding: false,
    });

    return { ok: true, persona: newPersona, memberCode };
  };

  const generateUniqueMemberCode = (prefix: "CAP-M" | "CAP-C" | "CAP-F") => {
    const existingCodes = new Set([
      ...memberRegistry.map((m) => m.memberCode),
      ...allPersonas.map((p) => p.memberCode || ""),
    ]);
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `${prefix}-${Math.floor(1000 + Math.random() * 8999)}`;
      if (!existingCodes.has(candidate)) return candidate;
    }
    return `${prefix}-${String(Date.now()).slice(-4)}`;
  };

  const loginOrCreateWithGoogle = (payload: {
    name: string;
    email: string;
    image?: string | null;
    isSimulatedPreview?: boolean;
  }) => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name.trim() || cleanEmail.split("@")[0] || "عضو كابتنلي";
    const existing = allPersonas.find((p) => p.email?.toLowerCase() === cleanEmail);

    if (existing) {
      const updated: PersonaAccount = {
        ...existing,
        fullNameAr: existing.fullNameAr || cleanName,
        avatarUrl: existing.avatarUrl || payload.image || undefined,
        email: cleanEmail,
        authProvider: "google",
      };
      setAllPersonas((prev) => prev.map((p) => (p.id === existing.id ? updated : p)));
      setCurrentPersona(updated);
      setActiveStaffAssignmentId(null);
      applyAccountCityToUserLocation(updated.city);
      const fallbackCode =
        updated.role === "facility_manager"
          ? ""
          : existing.memberCode || generateUniqueMemberCode("CAP-M");
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: fallbackCode || `FAC-${updated.id.slice(-6)}`,
        email: cleanEmail,
        fullNameAr: updated.fullNameAr,
        role: updated.role,
        phone: updated.phone,
        city: updated.city,
        avatarUrl: updated.avatarUrl,
        authProvider: "google",
        hasParentSupervision: updated.hasParentSupervision,
        needsOnboarding: Boolean(updated.needsOnboarding),
      });
      return {
        ok: true,
        isNewUser: false,
        persona: updated,
        memberCode: fallbackCode,
      };
    }

    const memberCode = generateUniqueMemberCode("CAP-M");
    const safeSlug = cleanEmail.replace(/[^a-z0-9]/g, "-");
    const newId = `google-${safeSlug}`;
    const firstName = cleanName.split(" ")[0];

    const defaultUserCity = userLocation.isSpecified ? userLocation.city : "مصر";

    const newPersona: PersonaAccount = {
      id: newId,
      role: "adult_athlete",
      memberCode,
      hasParentSupervision: false,
      avatarUrl: payload.image || undefined,
      email: cleanEmail,
      authProvider: "google",
      needsOnboarding: true,
      shortLabelAr: `${firstName} (${memberCode})`,
      fullNameAr: cleanName,
      personaTitleAr: `رياضي مسجّل عبر Google — كود ${memberCode}`,
      city: defaultUserCity,
      phone: "",
      descriptionAr: payload.isSimulatedPreview
        ? `حساب معاينة مسجّل بالبريد (${cleanEmail}) بكود عضوية فوري جاهز لتجربة الرحلة الكاملة.`
        : `حساب موثّق عبر Google (${cleanEmail}) مع كود عضوية رقمي فوري للربط مع الكباتن والأكاديميات.`,
    };

    setAllPersonas((prev) => [newPersona, ...prev.filter((p) => p.id !== newId)]);
    setCurrentPersona(newPersona);

    const regEntry: MemberRegistryEntry = {
      memberCode,
      athleteId: newId,
      fullNameAr: cleanName,
      phone: "",
      city: defaultUserCity,
      role: "adult_athlete",
      isMinor: false,
    };
    setMemberRegistry((prev) => [regEntry, ...prev.filter((m) => m.athleteId !== newId)]);

    pushNotification({
      titleAr: `أهلاً بك عبر Google يا ${firstName}!`,
      messageAr: `تم توليد كود عضويتك الفريد ${memberCode} وسحب بياناتك من Google. يمكنك الآن اختيار نوع حسابك وإضافة رقم الموبايل اختيارياً.`,
      type: "school_card",
      actionLabelAr: "إكمال الإعداد",
      actionHref: "/auth/onboarding",
    });

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode,
      email: cleanEmail,
      fullNameAr: cleanName,
      role: "adult_athlete",
      city: defaultUserCity,
      avatarUrl: payload.image || undefined,
      authProvider: "google",
      hasParentSupervision: false,
      needsOnboarding: true,
    });

    return { ok: true, isNewUser: true, persona: newPersona, memberCode };
  };

  const completeGoogleOnboarding = (payload: {
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
    phone?: string;
    city?: string;
    hasParentSupervision?: boolean;
  }) => {
    const cleanPhone = (payload.phone ?? currentPersona.phone ?? "").trim();
    const fallbackOnboardingCity = userLocation.isSpecified ? userLocation.city : "مصر";
    const cleanCity = (payload.city ?? currentPersona.city ?? fallbackOnboardingCity).trim();
    const firstName = currentPersona.fullNameAr.split(" ")[0];

    const existingSuffix = (currentPersona.memberCode || "").split("-").pop();
    const validDigits = /^\d{4}$/.test(existingSuffix || "")
      ? existingSuffix
      : String(Math.floor(1000 + Math.random() * 8999));

    const isFacilityRole = payload.role === "facility_manager";
    const prefix = payload.role === "coach" ? "CAP-C" : "CAP-M";
    const nextCode = isFacilityRole ? "" : `${prefix}-${validDigits}`;

    const roleTitleMap: Record<PersonaAccount["role"], string> = {
      guest: "زائر كابتنلي",
      adult_athlete: `رياضي مستقل — كود ${nextCode}`,
      parent: `حساب ولي أمر عائلي — ${nextCode}`,
      coach: `كابتن مسجّل — ${nextCode}`,
      facility_manager: "إدارة منشأة / أكاديمية",
      super_admin: "مشرف منصة كابتنلي",
    };

    const updatedPersona: PersonaAccount = {
      ...currentPersona,
      role: payload.role,
      memberCode: nextCode,
      phone: cleanPhone,
      city: cleanCity,
      hasParentSupervision:
        payload.role === "parent" ? true : Boolean(payload.hasParentSupervision),
      needsOnboarding: false,
      shortLabelAr: isFacilityRole ? `إدارة (${firstName})` : `${firstName} (${nextCode})`,
      personaTitleAr: roleTitleMap[payload.role],
    };

    setCurrentPersona(updatedPersona);
    setAllPersonas((prev) =>
      prev.map((p) => (p.id === currentPersona.id ? updatedPersona : p))
    );
    applyAccountCityToUserLocation(cleanCity);

    if (payload.role === "adult_athlete" || payload.role === "parent") {
      setMemberRegistry((prev) => {
        const hasEntry = prev.some((m) => m.athleteId === currentPersona.id);
        if (hasEntry) {
          return prev.map((m) =>
            m.athleteId === currentPersona.id
              ? {
                  ...m,
                  memberCode: nextCode,
                  phone: cleanPhone,
                  city: cleanCity,
                  role: payload.role === "parent" ? "parent" : "adult_athlete",
                }
              : m
          );
        }
        return [
          {
            memberCode: nextCode,
            athleteId: currentPersona.id,
            fullNameAr: currentPersona.fullNameAr,
            phone: cleanPhone,
            city: cleanCity,
            role: payload.role === "parent" ? "parent" : "adult_athlete",
            isMinor: false,
          },
          ...prev,
        ];
      });
    }

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode: nextCode || `FAC-${validDigits}`,
      email: updatedPersona.email,
      fullNameAr: updatedPersona.fullNameAr,
      role: updatedPersona.role,
      phone: updatedPersona.phone,
      city: updatedPersona.city,
      avatarUrl: updatedPersona.avatarUrl,
      authProvider: updatedPersona.authProvider || "google",
      hasParentSupervision: updatedPersona.hasParentSupervision,
      needsOnboarding: false,
      linkedFacilityId: updatedPersona.linkedFacilityId,
      linkedCoachId: updatedPersona.linkedCoachId,
    });

    return { ok: true, persona: updatedPersona };
  };

  const hydratePersonaFromRemoteProfile = (remote: {
    id?: string;
    memberCode?: string;
    dbProfileKey?: string;
    email?: string;
    fullNameAr: string;
    role: PersonaAccount["role"];
    phone?: string;
    city?: string;
    governorate?: string;
    avatarUrl?: string;
    authProvider?: "google" | "phone" | "demo";
    hasParentSupervision?: boolean;
    needsOnboarding?: boolean;
    bioAr?: string;
    socialLinks?: UserSocialLinks;
    linkedFacilityId?: string;
    linkedCoachId?: string;
  }): PersonaAccount => {
    const firstName = remote.fullNameAr.split(" ")[0] || "عضو";
    const isFacilityRole = remote.role === "facility_manager";
    const cleanCode = isFacilityRole ? "" : remote.memberCode || "";
    const resolvedLinkedFac =
      remote.linkedFacilityId ||
      (isFacilityRole && remote.phone
        ? facilities.find(
            (f) =>
              f.supplyStatus !== "seeded_unclaimed" &&
              f.whatsappNumber &&
              remote.phone &&
              f.whatsappNumber.slice(-9) === remote.phone.replace(/\D/g, "").slice(-9)
          )?.id
        : undefined);
    const resolvedLinkedCoach =
      remote.linkedCoachId ||
      (remote.role === "coach"
        ? coaches.find((c) => c.SingleCoachId === cleanCode || c.fullNameAr === remote.fullNameAr)?.id
        : undefined);

    const roleTitles: Record<PersonaAccount["role"], string> = {
      guest: "زائر كابتنلي",
      adult_athlete: `رياضي مسجّل — كود ${cleanCode || "CAP-M"}`,
      parent: `حساب ولي أمر عائلي — ${cleanCode || "CAP-M"}`,
      coach: `كابتن مسجّل — ${cleanCode || "CAP-C"}`,
      facility_manager: "إدارة منشأة / أكاديمية",
      super_admin: "مشرف منصة كابتنلي",
    };

    const existing = allPersonas.find(
      (p) =>
        (remote.email && p.email?.toLowerCase() === remote.email.toLowerCase()) ||
        (cleanCode && p.memberCode?.toUpperCase() === cleanCode.toUpperCase())
    );

    const persona: PersonaAccount = {
      id:
        existing?.id ||
        (remote.authProvider === "google" && remote.email
          ? `google-${remote.email.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
          : `user-${remote.dbProfileKey || remote.id || Date.now()}`),
      role: remote.role || "adult_athlete",
      memberCode: cleanCode,
      hasParentSupervision: Boolean(remote.hasParentSupervision),
      avatarUrl: remote.avatarUrl || existing?.avatarUrl || undefined,
      email: remote.email || existing?.email,
      authProvider: remote.authProvider || existing?.authProvider || "phone",
      needsOnboarding: Boolean(remote.needsOnboarding),
      shortLabelAr: isFacilityRole
        ? `إدارة (${firstName})`
        : cleanCode
        ? `${firstName} (${cleanCode})`
        : firstName,
      fullNameAr: remote.fullNameAr,
      personaTitleAr: roleTitles[remote.role] || roleTitles.adult_athlete,
      city: remote.city || "مصر",
      phone: remote.phone || existing?.phone || "",
      bioAr: remote.bioAr ?? existing?.bioAr,
      socialLinks: remote.socialLinks ?? existing?.socialLinks,
      linkedFacilityId: resolvedLinkedFac || existing?.linkedFacilityId,
      linkedCoachId: resolvedLinkedCoach || existing?.linkedCoachId,
      descriptionAr:
        existing?.descriptionAr ||
        "حساب محفوظ ومزامن عبر كابتنلي لاستعادة كافة البيانات عبر الأجهزة.",
    };

    setAllPersonas((prev) => [persona, ...prev.filter((p) => p.id !== persona.id && (!persona.email || p.email?.toLowerCase() !== persona.email.toLowerCase()))]);
    setCurrentPersona(persona);
    setActiveStaffAssignmentId(null);
    applyAccountCityToUserLocation(persona.city, remote.governorate);

    if ((persona.role === "adult_athlete" || persona.role === "parent") && cleanCode) {
      setMemberRegistry((prev) => {
        if (prev.some((m) => m.memberCode.toUpperCase() === cleanCode.toUpperCase())) return prev;
        return [
          {
            memberCode: cleanCode,
            athleteId: persona.id,
            fullNameAr: persona.fullNameAr,
            phone: persona.phone,
            city: persona.city,
            role: persona.role === "parent" ? "parent" : "adult_athlete",
            isMinor: false,
          },
          ...prev,
        ];
      });
    }

    if (cleanCode || persona.linkedFacilityId || persona.linkedCoachId) {
      lookupRemoteLedgersOrProfile({
        memberCode: cleanCode || undefined,
        coachId: persona.linkedCoachId || (persona.role === "coach" ? persona.id : undefined),
        facilityId: persona.linkedFacilityId || undefined,
      }).catch(() => undefined);
    }

    return persona;
  };

  const restoreOrLoginWithGoogle: CaptenlyContextType["restoreOrLoginWithGoogle"] = async (
    payload
  ) => {
    const cleanEmail = payload.email.trim().toLowerCase();
    try {
      const res = await fetch(`/api/supabase/sync-profile?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.found && data?.profile) {
          const restored = hydratePersonaFromRemoteProfile({
            ...data.profile,
            avatarUrl: data.profile.avatarUrl || payload.image || undefined,
            authProvider: "google",
          });
          return {
            ok: true,
            isNewUser: false,
            persona: restored,
            memberCode: restored.memberCode || "",
          };
        }
      }
    } catch {
      // Offline / unreachable: fall through to local check or new creation
    }

    return loginOrCreateWithGoogle(payload);
  };

  const restoreProfileByLogin: CaptenlyContextType["restoreProfileByLogin"] = async (query) => {
    const clean = query.trim();
    if (!clean) {
      return { ok: false, messageAr: "يرجى إدخال رقم الموبايل أو كود العضوية." };
    }
    const upper = clean.toUpperCase();
    const digits = clean.replace(/\D/g, "");
    const tail10 = digits.length >= 9 ? digits.slice(-10) : "";

    const localMatch = allPersonas.find(
      (p) =>
        p.role !== "guest" &&
        ((p.memberCode && p.memberCode.toUpperCase() === upper) ||
          (p.phone && p.phone.trim() === clean) ||
          (tail10 && p.phone && p.phone.replace(/\D/g, "").endsWith(tail10)))
    );

    if (localMatch) {
      switchPersona(localMatch.id);
      if (localMatch.memberCode || localMatch.linkedFacilityId || localMatch.linkedCoachId) {
        lookupRemoteLedgersOrProfile({
          memberCode: localMatch.memberCode || undefined,
          coachId: localMatch.linkedCoachId || (localMatch.role === "coach" ? localMatch.id : undefined),
          facilityId: localMatch.linkedFacilityId || undefined,
        }).catch(() => undefined);
      }
      return { ok: true, persona: localMatch };
    }

    try {
      const param =
        upper.startsWith("CAP-") || upper.startsWith("FAC-")
          ? `memberCode=${encodeURIComponent(upper)}`
          : `phone=${encodeURIComponent(clean)}`;
      const res = await fetch(`/api/supabase/sync-profile?${param}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.found && data?.profile) {
          const restored = hydratePersonaFromRemoteProfile(data.profile);
          return { ok: true, persona: restored };
        }
      }
    } catch {
      // Network offline fallback
    }

    return {
      ok: false,
      messageAr:
        "لم نعثر على حساب مسجّل بهذا الرقم أو الكود. يمكنك إنشاء حساب جديد خلال 30 ثانية أو الدخول بحساب Google.",
    };
  };

  const signOutToGuest = () => {
    const guest =
      allPersonas.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS[0];
    setCurrentPersona(guest);
    setActiveStaffAssignmentId(null);
  };

  const switchPersona = (personaId: string) => {
    const target = allPersonas.find((p) => p.id === personaId);
    if (target) {
      setCurrentPersona(target);
      setActiveStaffAssignmentId(null);
      if (target.role !== "guest") {
        applyAccountCityToUserLocation(target.city);
      }
    }
  };

  const updateCurrentPersonaAvatar = (avatarDataUrl: string) => {
    setCurrentPersona((prev) => ({ ...prev, avatarUrl: avatarDataUrl }));
    setAllPersonas((prev) =>
      prev.map((p) => (p.id === currentPersona.id ? { ...p, avatarUrl: avatarDataUrl } : p))
    );
    if (currentPersona.linkedCoachId) {
      setCoaches((prev) =>
        prev.map((c) => {
          if (c.id !== currentPersona.linkedCoachId) return c;
          const nextCoach = { ...c, avatarUrl: avatarDataUrl };
          syncCoachToSupabase(nextCoach);
          return nextCoach;
        })
      );
    }
    if (currentPersona.role !== "guest") {
      const profileKey =
        currentPersona.memberCode ||
        `FAC-${currentPersona.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "USER"}`;
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: profileKey,
        email: currentPersona.email,
        fullNameAr: currentPersona.fullNameAr,
        role: currentPersona.role,
        phone: currentPersona.phone,
        city: currentPersona.city,
        avatarUrl: avatarDataUrl,
        authProvider: currentPersona.authProvider || "captenly",
        hasParentSupervision: currentPersona.hasParentSupervision,
        needsOnboarding: Boolean(currentPersona.needsOnboarding),
        linkedFacilityId: currentPersona.linkedFacilityId,
        linkedCoachId: currentPersona.linkedCoachId,
      });
    }
  };

  const updateCurrentPersonaProfile = (patch: {
    fullNameAr?: string;
    phone?: string;
    city?: string;
    bioAr?: string;
    socialLinks?: UserSocialLinks;
    hasParentSupervision?: boolean;
  }) => {
    setCurrentPersona((prev) => {
      const next: PersonaAccount = {
        ...prev,
        ...(patch.fullNameAr !== undefined ? { fullNameAr: patch.fullNameAr } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.bioAr !== undefined ? { bioAr: patch.bioAr } : {}),
        ...(patch.socialLinks !== undefined
          ? { socialLinks: { ...(prev.socialLinks || {}), ...patch.socialLinks } }
          : {}),
        ...(patch.hasParentSupervision !== undefined
          ? { hasParentSupervision: patch.hasParentSupervision }
          : {}),
      };
      setAllPersonas((list) => list.map((p) => (p.id === next.id ? next : p)));

      if (next.linkedCoachId) {
        setCoaches((list) =>
          list.map((c) => {
            if (c.id !== next.linkedCoachId) return c;
            const nextCoach: Coach = {
              ...c,
              ...(patch.bioAr !== undefined ? { bioAr: patch.bioAr } : {}),
              ...(patch.socialLinks !== undefined
                ? {
                    socialLinks: { ...(c.socialLinks || {}), ...patch.socialLinks },
                    facebookUrl: patch.socialLinks.facebook ?? c.facebookUrl,
                    instagramUrl: patch.socialLinks.instagram ?? c.instagramUrl,
                  }
                : {}),
            };
            syncCoachToSupabase(nextCoach);
            return nextCoach;
          })
        );
      }

      if (next.role !== "guest") {
        const profileKey =
          next.memberCode ||
          `FAC-${next.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "USER"}`;
        postSupabaseSync("/api/supabase/sync-profile", {
          memberCode: profileKey,
          email: next.email,
          fullNameAr: next.fullNameAr,
          role: next.role,
          phone: next.phone,
          city: next.city,
          avatarUrl: next.avatarUrl,
          bioAr: next.bioAr,
          socialLinks: next.socialLinks,
          authProvider: next.authProvider || "captenly",
          hasParentSupervision: next.hasParentSupervision,
          needsOnboarding: Boolean(next.needsOnboarding),
          linkedFacilityId: next.linkedFacilityId,
          linkedCoachId: next.linkedCoachId,
        });
      }
      return next;
    });
  };

  const toggleOfflineSimulation = () => {
    setIsOfflineSimulated((prev) => !prev);
  };

  const toggleCompareFacility = (facilityId: string) => {
    if (!isAuthenticated) {
      openAuthGateModal("مقارنة المنشآت والباقات");
      return {
        ok: false,
        messageAr: "يرجى تسجيل الدخول أو إنشاء حساب في Captenly للمقارنة بين المنشآت.",
      };
    }
    if (compareFacilityIds.includes(facilityId)) {
      setCompareFacilityIds((prev) => prev.filter((id) => id !== facilityId));
      return { ok: true };
    }
    if (compareFacilityIds.length >= 4) {
      return {
        ok: false,
        messageAr: "الحد الأقصى للمقارنة الجانبية هو 4 منشآت في شاشة واحدة (MVP-04).",
      };
    }
    setCompareFacilityIds((prev) => [...prev, facilityId]);
    return { ok: true };
  };

  const clearComparison = () => setCompareFacilityIds([]);

  const confirmFacilityPrices60d = (facilityId: string, updatedBasePriceEgp?: number) => {
    setFacilities((prev) =>
      prev.map((fac) => {
        if (fac.id !== facilityId) return fac;
        const updatedPackages =
          updatedBasePriceEgp && fac.pricePackages.length > 0
            ? fac.pricePackages.map((pkg, idx) =>
                idx === 0 ? { ...pkg, baseMonthlyEgp: updatedBasePriceEgp } : pkg
              )
            : fac.pricePackages;
        return {
          ...fac,
          priceLastVerifiedDaysAgo: 0,
          priceLastVerifiedDate: "اليوم — موثق ومؤكد",
          pricePackages: updatedPackages,
        };
      })
    );
  };

  const simulateTimeTravelDays = (facilityId: string, daysAgo: number) => {
    setFacilities((prev) =>
      prev.map((fac) =>
        fac.id === facilityId
          ? {
              ...fac,
              priceLastVerifiedDaysAgo: daysAgo,
              priceLastVerifiedDate:
                daysAgo === 0
                  ? "اليوم (محدث)"
                  : daysAgo <= 60
                  ? `منذ ${daysAgo} يوماً (أخضر نشط)`
                  : daysAgo <= 119
                  ? `منذ ${daysAgo} يوماً (فترة تذكير 61-119)`
                  : `منذ ${daysAgo} يوماً (أكثر من 120 يوم — قديم)`,
            }
          : fac
      )
    );
  };

  const createStructuredWhatsappLead = (payload: {
    targetType: "facility" | "coach";
    targetId: string;
    targetNameAr: string;
    whatsappNumber?: string;
    inquirerNameAr: string;
    inquirerPhone: string;
    athleteAge: number;
    requestedSpecialtyAr: string;
    preferredScheduleAr: string;
  }) => {
    if (!isAuthenticated) {
      openAuthGateModal("التواصل والحجز المباشر مع المنشأة أو الكابتن");
      return { referralCode: "", whatsappUrl: "", isDuplicate30d: false };
    }
    const cleanPhone = payload.inquirerPhone.trim();
    const isDuplicate30d = verifiedLeads.some(
      (l) => l.targetId === payload.targetId && l.inquirerPhone === cleanPhone && cleanPhone !== ""
    );
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `#CAP-${randomNum}`;

    const newLead: VerifiedLeadItem = {
      id: `lead-${Date.now()}`,
      referralCode,
      targetType: payload.targetType,
      targetId: payload.targetId,
      targetNameAr: payload.targetNameAr,
      inquirerNameAr: payload.inquirerNameAr || "متدرب / ولي أمر عبر كابتنلي",
      inquirerPhone: cleanPhone || "010****",
      athleteAge: payload.athleteAge,
      requestedSpecialtyAr: payload.requestedSpecialtyAr,
      preferredScheduleAr: payload.preferredScheduleAr,
      createdAtAr: "الآن",
      repliedWithin2h: true,
      replyMinutes: 15,
      convertedToLedger: false,
    };

    if (!isDuplicate30d) {
      setVerifiedLeads((prev) => [newLead, ...prev]);
      if (payload.targetType === "facility") {
        setFacilities((prev) =>
          prev.map((f) =>
            f.id === payload.targetId
              ? {
                  ...f,
                  monthlyMetrics: {
                    ...f.monthlyMetrics,
                    verifiedWhatsappLeads: f.monthlyMetrics.verifiedWhatsappLeads + 1,
                  },
                }
              : f
          )
        );
      }

      postSupabaseSync("/api/supabase/leads", {
        facilityId: payload.targetId,
        facilityNameAr: payload.targetNameAr,
        memberCode: currentPersona.memberCode || undefined,
        memberNameAr: newLead.inquirerNameAr,
        phone: cleanPhone || undefined,
        packageNameAr: payload.requestedSpecialtyAr,
        notes: `السن: ${payload.athleteAge} | الموعد: ${payload.preferredScheduleAr} | كود الإحالة: ${referralCode}`,
      });
    }

    const messageText = `السلام عليكم، شفت صفحة (${payload.targetNameAr}) على منصة كابتنلي (captenly.com) وقارنت الباقات والمواعيد.\nحابب أستفسر عن الاشتراك في: [${payload.requestedSpecialtyAr}]\nللعمر: [${payload.athleteAge} سنة]\nالموعد المفضل: [${payload.preferredScheduleAr}]\nكود عضويتي: [${currentPersona.memberCode || "زائر"}]\n(كود إحالة كابتنلي: ${referralCode})`;
    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    if (!cleanWa) {
      return { referralCode, whatsappUrl: "", isDuplicate30d };
    }
    const formattedWa = cleanWa.startsWith("20") ? cleanWa : cleanWa.startsWith("0") ? `2${cleanWa}` : `20${cleanWa}`;
    const whatsappUrl = `https://wa.me/${formattedWa}?text=${encodeURIComponent(messageText)}`;

    return { referralCode, whatsappUrl, isDuplicate30d };
  };

  const generateSubscriptionCode = () => {
    const rand4 = Math.floor(1000 + Math.random() * 8999);
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digit = Math.floor(1 + Math.random() * 9);
    return `SUB-${rand4}-${letter}${digit}`;
  };

  // تفعيل باقة ودفتر حصص للسباح بكود اشتراك متجدد لكل اشتراك (SUB-XXXX-XX)
  const enrollSwimmerByMemberCode = (payload: {
    memberCode: string;
    athleteNameAr?: string;
    facilityId: string;
    coachId?: string;
    trackType?: "school" | "buds" | "prep" | "team" | "ladies";
    trackLabelAr?: string;
    packageTitleAr: string;
    totalSessions: 8 | 12 | 24;
    amountEgp: number;
    isMinor?: boolean;
    parentNameAr?: string;
  }) => {
    const rawCode = payload.memberCode.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith("CAP-")
      ? rawCode
      : rawCode
      ? `CAP-M-${rawCode.replace(/[^A-Z0-9]/g, "").slice(-4) || Math.floor(1000 + Math.random() * 8999)}`
      : `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`;

    const regMatch = memberRegistry.find((m) => m.memberCode.toUpperCase() === normalizedCode);
    const personaMatch = allPersonas.find((p) => (p.memberCode || "").toUpperCase() === normalizedCode);
    const targetFacility = facilities.find((f) => f.id === payload.facilityId);
    const targetCoach = coaches.find((c) => c.id === payload.coachId);

    const athleteId = regMatch?.athleteId || personaMatch?.id || `member-${normalizedCode}`;
    const athleteNameAr =
      payload.athleteNameAr?.trim() ||
      regMatch?.fullNameAr ||
      personaMatch?.fullNameAr ||
      `مشترك (${normalizedCode})`;

    const subscriptionCode = generateSubscriptionCode();
    const pinCode = String(Math.floor(1000 + Math.random() * 8999));
    const trackType = payload.trackType || "school";
    const trackLabels: Record<NonNullable<typeof payload.trackType>, string> = {
      school: "مدارس السباحة",
      buds: "البراعم والتأسيس",
      prep: "التجهيزي",
      team: "الفرق والبطولات",
      ladies: "مواعيد السيدات",
    };
    const trackLabelAr = payload.trackLabelAr || trackLabels[trackType];

    const newLedger: SessionLedger = {
      id: `ledger-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ledgerCode: subscriptionCode,
      subscriptionCode,
      memberCode: normalizedCode,
      athleteId,
      athleteNameAr,
      isMinor: Boolean(payload.isMinor ?? regMatch?.isMinor),
      parentNameAr: payload.parentNameAr || regMatch?.parentNameAr,
      coachId: targetCoach?.id || targetFacility?.id || currentPersona.id,
      coachNameAr:
        targetCoach?.fullNameAr ||
        (targetFacility ? `إدارة ${targetFacility.nameAr}` : currentPersona.fullNameAr),
      facilityId: targetFacility?.id || payload.facilityId || `fac-custom-${currentPersona.id}`,
      facilityNameAr: targetFacility?.nameAr || `أكاديمية سباحة — ${currentPersona.city}`,
      sportSector: "swimming",
      trackType,
      trackLabelAr,
      packageTitleAr: payload.packageTitleAr,
      totalSessions: payload.totalSessions,
      completedSessions: 0,
      pinCode,
      status: "active",
      isCodeExpired: false,
      startedDateAr: effectiveOffline
        ? "اليوم — محفوظ أوفلاين (سيتم الرفع عند عودة النت)"
        : "اليوم — اشتراك نشط",
      checkins: [],
      receipts: [
        {
          id: `rcp-${Date.now()}`,
          referenceNumber: subscriptionCode,
          channel: "إنستاباي (InstaPay)",
          amountEgp: payload.amountEgp,
          uploadedDateAr: "مؤكد عند الاشتراك",
          confirmedByProvider: true,
          packageTitleAr: payload.packageTitleAr,
        },
      ],
    };

    setSessionLedgers((prev) => [newLedger, ...prev]);

    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/session-ledgers", { ledger: newLedger });
    } else {
      setOfflineQueue((prev) => [
        {
          id: `oq-enroll-${Date.now()}`,
          kind: "enrollment",
          ledgerId: newLedger.id,
          athleteNameAr,
          sessionNumber: 0,
          method: "offline_sync",
          coachNoteAr: `تفعيل اشتراك جديد (${subscriptionCode}) أوفلاين`,
          queuedAtIso: new Date().toISOString(),
          synced: false,
        },
        ...prev,
      ]);
    }

    if (targetFacility) {
      setFacilities((prev) =>
        prev.map((f) =>
          f.id === targetFacility.id
            ? {
                ...f,
                monthlyMetrics: {
                  ...f.monthlyMetrics,
                  activeSessionLedgers: f.monthlyMetrics.activeSessionLedgers + 1,
                },
              }
            : f
        )
      );
    }

    if (!regMatch) {
      setMemberRegistry((prev) => [
        {
          memberCode: normalizedCode,
          athleteId,
          fullNameAr: athleteNameAr,
          phone: personaMatch?.phone || "",
          city: targetFacility?.city || currentPersona.city || "مصر",
          role: payload.isMinor ? "parent" : "adult_athlete",
          isMinor: payload.isMinor,
          parentNameAr: payload.parentNameAr,
        },
        ...prev,
      ]);
    }

    pushNotification({
      titleAr: `تم إصدار كود اشتراك جديد (${subscriptionCode}) لـ ${athleteNameAr}`,
      messageAr: `الباقة (${payload.totalSessions} حصص — ${trackLabelAr}) مفعّلة الآن بكود اشتراك متجدد ${subscriptionCode} ينتهي تلقائياً بعد إتمام الـ ${payload.totalSessions} حصص.`,
      type: "session_reminder",
      actionLabelAr: "فتح سجل الاشتراكات",
      actionHref: "/dashboard/ledger",
    });

    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/notifications", {
        memberCode: normalizedCode,
        titleAr: `تم تفعيل اشتراكك (${payload.totalSessions} حصص) — كود الاشتراك: ${subscriptionCode}`,
        messageAr: `أهلاً ${athleteNameAr} — تم تفعيل باقتك (${trackLabelAr}) في ${targetFacility?.nameAr || currentPersona.fullNameAr}. كود اشتراكك لهذه الباقة هو ${subscriptionCode} (PIN: ${pinCode}).`,
        type: "session_reminder",
        actionLabelAr: "عرض كود الاشتراك والـ QR",
        actionHref: "/dashboard/ledger",
      });
    }

    return {
      ok: true,
      ledger: newLedger,
      messageAr: `تم تسجيل ${athleteNameAr} (${trackLabelAr}) وتوليد كود اشتراك جديد (${subscriptionCode}) صالح لـ ${payload.totalSessions} حصص فقط!`,
    };
  };

  // Offline PWA Session Ledger Check-in (MVP-09)
  const checkInSession = (
    ledgerId: string,
    enteredPinOrQr: string,
    method: "pin_4digit" | "qr_scan" | "offline_sync",
    coachNoteAr?: string
  ) => {
    const targetLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!targetLedger) {
      return { ok: false, messageAr: "دفتر الحصص غير موجود." };
    }
    const subCode = targetLedger.subscriptionCode || targetLedger.ledgerCode;
    if (
      targetLedger.completedSessions >= targetLedger.totalSessions ||
      targetLedger.status === "completed" ||
      targetLedger.isCodeExpired
    ) {
      return {
        ok: false,
        messageAr: `انتهت صلاحية كود الاشتراك (${subCode}) لاستنفاد جميع الحصص (${targetLedger.totalSessions}/${targetLedger.totalSessions})! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }

    const cleanInput = enteredPinOrQr.trim().toUpperCase();
    if (
      method === "pin_4digit" &&
      cleanInput !== targetLedger.pinCode &&
      cleanInput !== subCode.toUpperCase() &&
      cleanInput !== targetLedger.ledgerCode.toUpperCase()
    ) {
      return {
        ok: false,
        messageAr: `كود الاشتراك أو الـ PIN غير صحيح! كود الاشتراك الحالي هو: ${subCode} (أو PIN: ${targetLedger.pinCode})`,
      };
    }

    const nextNum = targetLedger.completedSessions + 1;
    const remaining = targetLedger.totalSessions - nextNum;
    const isNowExpired = nextNum >= targetLedger.totalSessions;
    const isOff = effectiveOffline || method === "offline_sync";

    const updatedLedger: SessionLedger = {
      ...targetLedger,
      completedSessions: nextNum,
      status: isNowExpired ? "completed" : remaining <= 2 ? "renewal_due" : "active",
      isCodeExpired: isNowExpired,
      checkins: [
        ...targetLedger.checkins,
        {
          sessionNumber: nextNum,
          dateAr: isOff
            ? "الآن (محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً)"
            : "الآن — ختم موثق أونلاين",
          method: isOff ? "offline_sync" : method,
          verifiedByAr: currentPersona.shortLabelAr,
          coachNoteAr: coachNoteAr || "حضور مؤكد وتمرين ممتاز",
          wasOffline: isOff,
        },
      ],
    };

    setSessionLedgers((prev) => prev.map((l) => (l.id === ledgerId ? updatedLedger : l)));

    if (!isOff) {
      postSupabaseSync("/api/supabase/session-ledgers", { ledger: updatedLedger });
      if (targetLedger.memberCode) {
        postSupabaseSync("/api/supabase/notifications", {
          memberCode: targetLedger.memberCode,
          titleAr: isNowExpired
            ? `اكتملت باقتك (${nextNum}/${targetLedger.totalSessions}) وانتهت صلاحية الكود ${subCode}`
            : `تم تسجيل حضور الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) ✓`,
          messageAr: isNowExpired
            ? `أتممت جميع حصص باقتك في ${targetLedger.facilityNameAr}. انتهت صلاحية كود الاشتراك ${subCode}، وعند التجديد سيتولد لك كود جديد.`
            : `سجّل ${currentPersona.fullNameAr} حضورك في ${targetLedger.facilityNameAr}. المتبقي: ${remaining} حصة.`,
          type: "session_reminder",
          actionLabelAr: "عرض سجل حصصي",
          actionHref: "/dashboard/ledger",
        });
      }
    }

    if (isOff) {
      setOfflineQueue((prev) => [
        {
          id: `oq-${Date.now()}`,
          kind: "checkin",
          ledgerId,
          athleteNameAr: targetLedger.athleteNameAr,
          sessionNumber: nextNum,
          method: "offline_sync",
          coachNoteAr: coachNoteAr || "حضور مؤكد بالمسبح",
          queuedAtIso: new Date().toISOString(),
          synced: false,
        },
        ...prev,
      ]);
    }

    const expiryOrRenewalMsg = isNowExpired
      ? ` — اكتملت الـ ${targetLedger.totalSessions} حصص وانتهت صلاحية كود الاشتراك (${subCode}) تلقائياً!`
      : remaining <= 2
      ? ` — تنبيه: متبقي ${remaining} حصة فقط في هذا الكود.`
      : "";

    return {
      ok: true,
      messageAr: `تم خصم الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) للمشترك ${targetLedger.athleteNameAr} ${
        isOff ? "(محفوظ أوفلاين وسيتم رفعه تلقائياً فور عودة الإنترنت)" : "بنجاح"
      }${expiryOrRenewalMsg}`,
    };
  };

  const checkInBySubscriptionCode = (
    codeInput: string,
    facilityId?: string,
    coachNoteAr?: string
  ) => {
    const raw = codeInput.trim();
    if (!raw) {
      return { ok: false, messageAr: "يرجى إدخال كود الاشتراك (مثل SUB-XXXX-XX) أو رقم الـ PIN." };
    }

    let cleaned = raw.toUpperCase();
    if (cleaned.startsWith("CAP-QR:") || cleaned.startsWith("CAP-SUB:")) {
      const parts = cleaned.split(":");
      cleaned = (parts[1] || "").trim().toUpperCase();
    }

    const pool = facilityId
      ? sessionLedgers.filter((l) => l.facilityId === facilityId)
      : sessionLedgers;
    const searchPool = pool.length > 0 ? pool : sessionLedgers;

    const exactMatch =
      searchPool.find(
        (l) =>
          (l.subscriptionCode || "").toUpperCase() === cleaned ||
          l.ledgerCode.toUpperCase() === cleaned
      ) ||
      searchPool.find((l) => l.pinCode === cleaned && l.status !== "completed") ||
      searchPool.find(
        (l) => (l.memberCode || "").toUpperCase() === cleaned && l.status !== "completed"
      ) ||
      searchPool.find((l) => (l.memberCode || "").toUpperCase() === cleaned);

    if (!exactMatch) {
      return {
        ok: false,
        messageAr: `لم يتم العثور على اشتراك بالكود «${raw}». تأكد من كتابة كود الاشتراك الظاهر بجانب اسم المشترك.`,
      };
    }

    const subCode = exactMatch.subscriptionCode || exactMatch.ledgerCode;
    if (
      exactMatch.completedSessions >= exactMatch.totalSessions ||
      exactMatch.status === "completed" ||
      exactMatch.isCodeExpired
    ) {
      return {
        ok: false,
        expired: true,
        ledger: exactMatch,
        messageAr: `كود الاشتراك (${subCode}) الخاص بـ «${exactMatch.athleteNameAr}» منتهي الصلاحية لإتمام الـ ${exactMatch.totalSessions} حصص بالكامل! يرجى تجديد الاشتراك لتوليد كود جديد.`,
      };
    }

    const res = checkInSession(exactMatch.id, exactMatch.pinCode, "qr_scan", coachNoteAr);
    return {
      ok: res.ok,
      ledger: exactMatch,
      messageAr: res.messageAr,
    };
  };

  const renewSwimmerSubscription = (
    ledgerIdOrPayload:
      | string
      | {
          ledgerId: string;
          totalSessions?: 8 | 12 | 24;
          packageTitleAr?: string;
          amountEgp?: number;
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

    const oldLedger = sessionLedgers.find((l) => l.id === ledgerId);
    if (!oldLedger) {
      return { ok: false, messageAr: "الاشتراك المطلوب تجديده غير موجود." };
    }

    // Mark old ledger code as expired/completed
    setSessionLedgers((prev) =>
      prev.map((l) =>
        l.id === ledgerId ? { ...l, status: "completed", isCodeExpired: true } : l
      )
    );

    const lastReceiptAmount = oldLedger.receipts[0]?.amountEgp || 0;
    return enrollSwimmerByMemberCode({
      memberCode: oldLedger.memberCode || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
      athleteNameAr: oldLedger.athleteNameAr,
      facilityId: oldLedger.facilityId,
      coachId: oldLedger.coachId,
      trackType: oldLedger.trackType || "school",
      trackLabelAr: oldLedger.trackLabelAr,
      packageTitleAr: customTitle || oldLedger.packageTitleAr,
      totalSessions: totalSessions || oldLedger.totalSessions,
      amountEgp: amountEgp !== undefined ? amountEgp : lastReceiptAmount,
      isMinor: oldLedger.isMinor,
      parentNameAr: oldLedger.parentNameAr,
    });
  };

  const uploadInstaPayReceipt = (
    ledgerId: string,
    payload: {
      referenceNumber: string;
      channel: "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)";
      amountEgp: number;
      packageTitleAr: string;
    }
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
              uploadedDateAr: "الآن — مرفق ومؤرشف",
              confirmedByProvider: true,
              packageTitleAr: payload.packageTitleAr,
            },
            ...l.receipts,
          ],
        };
        if (!effectiveOffline) {
          postSupabaseSync("/api/supabase/session-ledgers", { ledger: updated });
        }
        return updated;
      })
    );
  };

  const addNewPBRecord = (record: Omit<PersonalBestRecord, "id" | "recordedDateAr">) => {
    const newRec: PersonalBestRecord = {
      ...record,
      id: `pb-${Date.now()}`,
      recordedDateAr: "اليوم — مسجل بالحساب",
    };
    setPbRecords((prev) => [newRec, ...prev]);
  };

  const recordCoachSkillAndPB = (payload: {
    athleteId?: string;
    swimmerNameAr: string;
    eventTitleAr: string;
    currentValue: number;
    unitAr?: string;
    coachNameAr: string;
    facilityNameAr?: string;
    skills?: SkillEvaluation5Point;
  }) => {
    const targetAthleteId = payload.athleteId || currentPersona.id;
    const previousSame = pbRecords.find(
      (r) =>
        r.eventTitleAr === payload.eventTitleAr &&
        (r.athleteId === targetAthleteId || r.athleteNameAr === payload.swimmerNameAr)
    );

    const newRec: PersonalBestRecord = {
      id: `pb-${Date.now()}`,
      athleteId: targetAthleteId,
      athleteNameAr: payload.swimmerNameAr,
      sportType: "swimming",
      eventTitleAr: payload.eventTitleAr,
      currentValue: payload.currentValue,
      previousValue: previousSame ? previousSame.currentValue : payload.currentValue,
      unitAr: payload.unitAr || "ثانية",
      recordedDateAr: "اليوم — توقيت موثق",
      verificationSource: "coach_reviewed",
      verificationLabelAr: "توقيت موثق من الكابتن",
      coachNameAr: payload.coachNameAr,
      facilityNameAr: payload.facilityNameAr || currentPersona.city,
    };
    setPbRecords((prev) => [newRec, ...prev]);

    if (payload.skills) {
      setSkillEvaluation(payload.skills);
    }

    pushNotification({
      titleAr: `تقييم ورقم قياسي جديد (${payload.eventTitleAr})`,
      messageAr: `سجّل كابتن ${payload.coachNameAr} للسباح ${payload.swimmerNameAr} زمناً قدره ${payload.currentValue} ${payload.unitAr || "ثانية"}.`,
      type: "passport_badge",
      actionLabelAr: "عرض تحليل الأداء",
      actionHref: "/dashboard/athlete",
    });
  };

  const addMinorAthlete = (child: {
    fullNameAr: string;
    age: number;
    gender: "male" | "female";
    primarySport: "swimming" | "fitness";
  }) => {
    const newChild: MinorAthleteProfile = {
      id: `athlete-${Date.now()}`,
      fullNameAr: child.fullNameAr,
      age: child.age,
      birthYear: 2026 - child.age,
      gender: child.gender,
      primarySport: child.primarySport,
      currentStarLevel: 1,
      starTitleAr: "النجمة الأولى — تأسيس وأمان مائي",
      isPrivateByDefault: true,
      parentConsentVerified: true,
      activeCoachNameAr: "بانتظار ربط كابتن بكود العضوية",
      activeFacilityNameAr: "حساب عائلي اختياري",
    };
    setMinorAthletes((prev) => [...prev, newChild]);
    setCurrentPersona((prev) => ({ ...prev, hasParentSupervision: true }));
  };

  // تسجيل وتوثيق كابتن حقيقي بنفسه للحصول على الشارات الخضراء
  const registerAndVerifyCoach = (payload: {
    fullNameAr: string;
    titleAr: string;
    phone: string;
    city: string;
    governorate: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    yearsExperience: number;
    bioAr: string;
    avatarUrl?: string;
    whatsappNumber?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    socialLinks?: UserSocialLinks;
    instapayHandle?: string;
    privatePackage8Egp: number;
    privatePackage12Egp: number;
    specialtiesAr: string[];
    syndicateCardRef: string;
    edlfCertRef?: string;
    facilityId?: string;
  }) => {
    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    const cleanFb = (payload.facebookUrl || payload.socialLinks?.facebook || "").trim();
    const cleanIg = (payload.instagramUrl || payload.socialLinks?.instagram || "").trim();
    if (!cleanWa && !cleanFb && !cleanIg) {
      return {
        ok: false,
        messageAr: "يرجى إدخال وسيلة تواصل واحدة على الأقل (رقم واتساب أو رابط فيسبوك أو إنستاجرام).",
      };
    }

    const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => payload.bioAr.includes(kw));
    if (detected) {
      return {
        ok: false,
        detectedKeyword: detected,
        messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
      };
    }

    const idNum = Math.floor(1000 + Math.random() * 8999);
    const coachId = `coach-${Date.now()}`;
    const slug = `coach-${idNum}-${payload.fullNameAr.trim().replace(/\s+/g, "-")}`;
    const fac = facilities.find((f) => f.id === payload.facilityId);
    const formattedWa = cleanWa
      ? cleanWa.startsWith("20")
        ? cleanWa
        : cleanWa.startsWith("0")
        ? `2${cleanWa}`
        : `20${cleanWa}`
      : undefined;

    const newCoach: Coach = {
      id: coachId,
      slug,
      SingleCoachId: `CAP-ID-${idNum}`,
      fullNameAr: payload.fullNameAr,
      titleAr: payload.titleAr,
      sportSector: payload.sportSector,
      governorate: payload.governorate,
      city: payload.city,
      district: payload.district,
      yearsExperience: payload.yearsExperience,
      bioAr: payload.bioAr,
      avatarUrl: payload.avatarUrl || "/screens/3dff88737bec.jpg",
      whatsappNumber: formattedWa,
      facebookUrl: cleanFb || undefined,
      instagramUrl: cleanIg || undefined,
      socialLinks: {
        ...(payload.socialLinks || {}),
        ...(cleanFb ? { facebook: cleanFb } : {}),
        ...(cleanIg ? { instagram: cleanIg } : {}),
      },
      instapayHandle: payload.instapayHandle || `${payload.phone}@instapay`,
      privatePackage8Egp: payload.privatePackage8Egp,
      privatePackage12Egp: payload.privatePackage12Egp,
      sessionOffers: [
        {
          id: `offer-${Date.now()}-1`,
          titleAr: "باقة التأسيس والانطلاق (8 حصص)",
          sessionsCount: 8,
          priceEgp: payload.privatePackage8Egp,
          durationMinutes: 60,
          notesAr: "تدريب فردي أو مجموعة صغيرة مع تقييم مبدئي.",
        },
        {
          id: `offer-${Date.now()}-2`,
          titleAr: "الباقة المكثفة لتطوير الأداء (12 حصة)",
          sessionsCount: 12,
          priceEgp: payload.privatePackage12Egp,
          durationMinutes: 60,
          notesAr: "متابعة الأرقام القياسية وتصحيح التكنيك.",
        },
      ],
      subscriptionTier: "free_founding",
      commissionRate: 0,
      qrCodeToken: `CAP-QR-C${idNum}`,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — موثق بالمنصة",
      rating: 5.0,
      verifiedReviewsCount: 1,
      activeAthletesCount: 0,
      isVerifiedCoach: true,
      badges: [
        {
          code: "BADGE_01_IDENTITY",
          titleAr: "الشارة 01: هوية وتليفون موثق",
          authorityAr: "تحقق رقم الموبايل والبطاقة القومية",
          verifiedDate: "اليوم",
          status: "active",
          documentRef: payload.phone,
          descriptionAr: "تأكيد الهوية الحقيقية للكابتن برقم الهاتف الشخصي والمستند الرسمي.",
        },
        {
          code: "BADGE_04_ESF_FEDERATION",
          titleAr: "الشارة 04: اعتماد مهني / نقابة رياضية",
          authorityAr: "نقابة المهن الرياضية / الاتحاد المختص",
          verifiedDate: "اليوم",
          status: "active",
          documentRef: payload.syndicateCardRef,
          descriptionAr: `رقم القيد / الشهادة المعتمدة: ${payload.syndicateCardRef}`,
        },
        ...(payload.edlfCertRef
          ? [
              {
                code: "BADGE_05_EDLF_LIFEGUARD" as const,
                titleAr: "الشارة 05: إنقاذ وإسعاف أولي معتمد",
                authorityAr: "الاتحاد المصري للغوص والإنقاذ",
                verifiedDate: "اليوم",
                status: "active" as const,
                documentRef: payload.edlfCertRef,
                descriptionAr: `شهادة إنقاذ سارية رقم ${payload.edlfCertRef}`,
              },
            ]
          : []),
      ],
      specialties: (payload.specialtiesAr.length ? payload.specialtiesAr : ["تأسيس أطفال"]).map(
        (name) => ({ nameAr: name, credibilityTier: "official_credential" })
      ),
      affiliations: fac
        ? [
            {
              facilityId: fac.id,
              facilityNameAr: fac.nameAr,
              city: fac.city,
              scheduleAr: "حسب الجدول المعلن",
              roleAr: "مدرب معتمد",
              status: "active_mutual",
            },
          ]
        : [],
    };

    setCoaches((prev) => [newCoach, ...prev]);
    syncCoachToSupabase(newCoach);

    if (fac) {
      updateFacilityAndSync(fac.id, (f) => ({
        ...f,
        affiliatedCoachIds: [...f.affiliatedCoachIds, coachId],
      }));
    }

    const coachPersona: PersonaAccount = {
      id: currentPersona.role !== "guest" ? currentPersona.id : `persona-${coachId}`,
      role: "coach",
      memberCode: `CAP-ID-${idNum}`,
      email: currentPersona.email,
      authProvider: currentPersona.authProvider || "phone",
      needsOnboarding: false,
      hasParentSupervision: false,
      avatarUrl: payload.avatarUrl || currentPersona.avatarUrl || "/screens/3dff88737bec.jpg",
      shortLabelAr: `${payload.fullNameAr} (موثق ✓)`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr: `كابتن موثق — كود ${newCoach.SingleCoachId}`,
      city: payload.city,
      phone: payload.phone,
      linkedCoachId: coachId,
      linkedFacilityId: fac?.id,
      descriptionAr: "حساب كابتن موثق بالشارات الخضراء ومفعّل لإدارة دفاتر الحصص وكروت المدارس.",
    };
    setAllPersonas((prev) => [coachPersona, ...prev.filter((p) => p.id !== coachPersona.id)]);
    setCurrentPersona(coachPersona);
    applyAccountCityToUserLocation(payload.city, payload.governorate);

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode: coachPersona.memberCode || newCoach.SingleCoachId,
      email: coachPersona.email,
      fullNameAr: coachPersona.fullNameAr,
      role: "coach",
      phone: coachPersona.phone,
      city: coachPersona.city,
      governorate: payload.governorate,
      avatarUrl: coachPersona.avatarUrl,
      authProvider: coachPersona.authProvider || "captenly",
      hasParentSupervision: false,
      needsOnboarding: false,
      linkedCoachId: coachId,
      linkedFacilityId: fac?.id,
    });

    pushNotification({
      titleAr: "مبروك! تم توثيق حسابك وإصدار الشارات الخضراء",
      messageAr: `أصبح ملفك (${payload.fullNameAr}) ظاهراً للسباحين والأهالي الآن برقم كابتن ${newCoach.SingleCoachId}.`,
      type: "passport_badge",
      actionLabelAr: "عرض لوحة الكابتن",
      actionHref: "/dashboard/coach",
    });

    return {
      ok: true,
      coach: newCoach,
      messageAr: `تم اعتماد ملفك وإصدار الشارات الخضراء بنجاح! رقم ملفك هو ${newCoach.SingleCoachId}.`,
    };
  };

  const validateAndSaveCoachBio = (coachId: string, newBioAr: string) => {
    const targetCoach = coaches.find((c) => c.id === coachId);
    const hasMedicalLicenseBadge = targetCoach?.badges.some(
      (b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active"
    );

    if (!hasMedicalLicenseBadge) {
      const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => newBioAr.includes(kw));
      if (detected) {
        return {
          ok: false,
          detectedKeyword: detected,
          messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): غير مسموح باستخدام مصطلح «${detected}» لغير الأطباء المرخصين بالشارة السادسة.`,
        };
      }
    }

    updateCoachAndSync(coachId, (c) => ({ ...c, bioAr: newBioAr }));
    return {
      ok: true,
      messageAr: "تم حفظ السيرة المهنية بعد اجتياز فحص المعايير بنجاح!",
    };
  };

  const gracefulDisaffiliateCoach = (coachId: string, facilityId: string) => {
    setCoaches((prev) =>
      prev.map((c) => {
        if (c.id !== coachId) return c;
        return {
          ...c,
          affiliations: c.affiliations.map((aff) =>
            aff.facilityId === facilityId ? { ...aff, status: "gracefully_disaffiliated" } : aff
          ),
        };
      })
    );
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId
          ? { ...f, affiliatedCoachIds: f.affiliatedCoachIds.filter((id) => id !== coachId) }
          : f
      )
    );
  };

  const requestMutualAffiliation = (
    coachId: string,
    facilityId: string,
    scheduleAr: string,
    roleAr: string
  ) => {
    const targetFacility = facilities.find((f) => f.id === facilityId);
    if (!targetFacility) return;
    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId
          ? {
              ...c,
              affiliations: [
                ...c.affiliations,
                {
                  facilityId,
                  facilityNameAr: targetFacility.nameAr,
                  city: targetFacility.city,
                  scheduleAr,
                  roleAr,
                  status: "pending",
                },
              ],
            }
          : c
      )
    );
  };

  const approveAffiliationMutual = (coachId: string, facilityId: string) => {
    setCoaches((prev) =>
      prev.map((c) => ({
        ...c,
        affiliations:
          c.id === coachId
            ? c.affiliations.map((a) =>
                a.facilityId === facilityId ? { ...a, status: "active_mutual" } : a
              )
            : c.affiliations,
      }))
    );
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId && !f.affiliatedCoachIds.includes(coachId)
          ? { ...f, affiliatedCoachIds: [...f.affiliatedCoachIds, coachId] }
          : f
      )
    );
  };

  const updateCoachAndSync = (coachId: string, updater: (c: Coach) => Coach) => {
    const existing = coaches.find((c) => c.id === coachId);
    if (!existing) return;
    const next = updater(existing);
    setCoaches((prev) => prev.map((c) => (c.id === coachId ? next : c)));
    syncCoachToSupabase(next);
  };

  const updateFacilityAndSync = (facilityId: string, updater: (f: Facility) => Facility) => {
    const existing = facilities.find((f) => f.id === facilityId);
    if (!existing) return;
    const next = updater(existing);
    setFacilities((prev) => prev.map((f) => (f.id === facilityId ? next : f)));
    syncFacilityToSupabase(next);
  };

  const addCoachSessionOffer = (coachId: string, offer: Omit<CoachSessionOffer, "id">) => {
    const newOffer: CoachSessionOffer = { ...offer, id: `offer-${Date.now()}` };
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: [newOffer, ...(c.sessionOffers || [])],
    }));
    return { ok: true, messageAr: `تم نشر عرض التدريب «${offer.titleAr}» بنجاح!` };
  };

  const updateCoachSessionOffer = (
    coachId: string,
    offerId: string,
    patch: Partial<Omit<CoachSessionOffer, "id">>
  ) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: (c.sessionOffers || []).map((o) =>
        o.id === offerId ? { ...o, ...patch } : o
      ),
    }));
    return { ok: true, messageAr: "تم تحديث بطاقة الحصة التدريبية بنجاح." };
  };

  const removeCoachSessionOffer = (coachId: string, offerId: string) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: (c.sessionOffers || []).filter((o) => o.id !== offerId),
    }));
  };

  const addFacilitySchoolProgram = (
    facilityId: string,
    program: Omit<FacilitySchoolProgram, "id">
  ) => {
    const newProgram: FacilitySchoolProgram = { ...program, id: `prog-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      schoolPrograms: [newProgram, ...(f.schoolPrograms || [])],
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — محدث من الإدارة",
    }));
    return { ok: true, messageAr: `تم نشر بطاقة «${program.titleAr}» بنجاح!` };
  };

  const updateFacilitySchoolProgram = (
    facilityId: string,
    programId: string,
    patch: Partial<Omit<FacilitySchoolProgram, "id">>
  ) => {
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      schoolPrograms: (f.schoolPrograms || []).map((p) =>
        p.id === programId ? { ...p, ...patch } : p
      ),
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — محدث من الإدارة",
    }));
    return { ok: true, messageAr: "تم تحديث تفاصيل البطاقة بنجاح." };
  };

  const removeFacilitySchoolProgram = (facilityId: string, programId: string) => {
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      schoolPrograms: (f.schoolPrograms || []).filter((p) => p.id !== programId),
    }));
  };

  const mergeExternalPlacesFacilities = (externalPlaces: Facility[]) => {
    if (!externalPlaces.length) return;
    setFacilities((prev) => {
      const existingPlaceIds = new Set(prev.map((f) => f.googlePlaceId).filter(Boolean));
      const existingIds = new Set(prev.map((f) => f.id));
      const fresh = externalPlaces.filter(
        (ext) =>
          !existingIds.has(ext.id) &&
          (!ext.googlePlaceId || !existingPlaceIds.has(ext.googlePlaceId))
      );
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh];
    });
  };

  // نشر كارت باقة أو مدرسة تعليمية جديدة للمنشأة
  const publishSchoolPackage = (payload: {
    facilityId: string;
    nameAr: string;
    sessionsCount: number;
    sessionsPerWeek: number;
    durationMinutes: number;
    baseMonthlyEgp: number;
    assessmentFeeEgp?: number;
    membershipCardFeeEgp?: number;
  }) => {
    const target = facilities.find((f) => f.id === payload.facilityId);
    if (!target) {
      return { ok: false, messageAr: "يرجى اختيار منشأة صالحة لنشر الباقة عليها." };
    }

    const newPkg = {
      id: `pkg-${Date.now()}`,
      nameAr: payload.nameAr,
      sessionsCount: payload.sessionsCount,
      sessionsPerWeek: payload.sessionsPerWeek,
      durationMinutes: payload.durationMinutes,
      baseMonthlyEgp: payload.baseMonthlyEgp,
      assessmentFeeEgp: payload.assessmentFeeEgp || 0,
      membershipCardFeeEgp: payload.membershipCardFeeEgp || 0,
      mandatoryKitFeeEgp: 0,
      companionFeeEgp: 0,
    };

    setFacilities((prev) =>
      prev.map((f) =>
        f.id === payload.facilityId
          ? {
              ...f,
              pricePackages: [newPkg, ...f.pricePackages],
              priceLastVerifiedDaysAgo: 0,
              priceLastVerifiedDate: "اليوم — محدث من الإدارة",
            }
          : f
      )
    );

    pushNotification({
      titleAr: `تم نشر باقة جديدة في ${target.nameAr}`,
      messageAr: `الباقة «${payload.nameAr}» (${payload.baseMonthlyEgp} ج.م) ظاهرة الآن للرياضيين وأولياء الأمور.`,
      type: "school_card",
      actionLabelAr: "عرض صفحة المنشأة",
      actionHref: `/academy/${target.slug}`,
    });

    return {
      ok: true,
      messageAr: `تم نشر كارت الباقة «${payload.nameAr}» وظهوره في نتائج البحث فوراً!`,
    };
  };

  // مطالبة إدارة المكان أو النادي بالصفحة وتوثيقها مجاناً
  const claimFacilityAndVerify = (
    facilityId: string,
    payload: {
      managerName: string;
      roleTitleAr: string;
      phone: string;
      whatsappNumber?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      instapayHandle?: string;
      updatedBasePriceEgp?: number;
      commercialRegRef?: string;
    }
  ) => {
    const existing = facilities.find((f) => f.id === facilityId);
    if (!existing) {
      return { ok: false, messageAr: "المنشأة غير موجودة." };
    }

    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    const cleanFb = (payload.facebookUrl || "").trim();
    const cleanIg = (payload.instagramUrl || "").trim();

    if (!cleanWa && !cleanFb && !cleanIg) {
      return {
        ok: false,
        messageAr: "يرجى إدخال وسيلة تواصل واحدة على الأقل (واتساب أو فيسبوك أو إنستاجرام).",
      };
    }

    const formattedWa = cleanWa
      ? cleanWa.startsWith("20")
        ? cleanWa
        : cleanWa.startsWith("0")
        ? `2${cleanWa}`
        : `20${cleanWa}`
      : undefined;

    const verifiedFac: Facility = {
      ...existing,
      supplyStatus: "verified_active",
      verifiedClaimDateAr: "اليوم — منشأة مفعّلة وموثقة",
      sourcePublicNoteAr: `مُدارة ومحدّثة رسمياً بواسطة ${payload.managerName} (${payload.roleTitleAr})`,
      whatsappNumber: formattedWa ?? existing.whatsappNumber,
      facebookUrl: cleanFb || existing.facebookUrl,
      instagramUrl: cleanIg || existing.instagramUrl,
      instapayHandle: payload.instapayHandle || existing.instapayHandle,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — أسعار مؤكدة من الإدارة",
      completenessScore: 95,
      pricePackages:
        payload.updatedBasePriceEgp && existing.pricePackages.length > 0
          ? existing.pricePackages.map((p, i) =>
              i === 0 ? { ...p, baseMonthlyEgp: payload.updatedBasePriceEgp! } : p
            )
          : existing.pricePackages,
      badges: [
        {
          code: "BADGE_01_IDENTITY",
          titleAr: "الشارة 01: تحقق هوية المسؤول الرسمي",
          authorityAr: "توثيق رقم هاتف الإدارة",
          verifiedDate: "اليوم",
          status: "active",
          descriptionAr: `تم التحقق من إدارة ${payload.managerName} (${payload.roleTitleAr}).`,
        },
        {
          code: "BADGE_02_FACILITY",
          titleAr: "الشارة 02: منشأة موثقة ومعتمدة",
          authorityAr: "فريق توثيق كابتنلي",
          verifiedDate: "اليوم",
          status: "active",
          documentRef: payload.commercialRegRef || "VERIFIED-CLAIM",
          descriptionAr: "البيانات والأسعار والمواعيد محدثة ومؤكدة من إدارة المنشأة مباشرة.",
        },
      ],
    };

    setFacilities((prev) => prev.map((f) => (f.id === facilityId ? verifiedFac : f)));
    syncFacilityToSupabase(verifiedFac);

    const mgrPersona: PersonaAccount = {
      id: currentPersona.role !== "guest" ? currentPersona.id : `persona-mgr-${facilityId}`,
      role: "facility_manager",
      memberCode: "",
      email: currentPersona.email,
      avatarUrl: currentPersona.avatarUrl,
      authProvider: currentPersona.authProvider || "phone",
      needsOnboarding: false,
      hasParentSupervision: false,
      shortLabelAr: `إدارة ${existing.nameAr.slice(0, 18)}`,
      fullNameAr: payload.managerName,
      personaTitleAr: `${payload.roleTitleAr} — ${existing.nameAr}`,
      city: existing.city,
      phone: payload.phone,
      linkedFacilityId: existing.id,
      descriptionAr: "حساب إدارة منشأة موثقة مع صلاحية تفعيل دفاتر الحصص للسباحين.",
    };
    setAllPersonas((prev) => [mgrPersona, ...prev.filter((p) => p.id !== mgrPersona.id)]);
    setCurrentPersona(mgrPersona);
    applyAccountCityToUserLocation(existing.city, existing.governorate);

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode: `FAC-${mgrPersona.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || Date.now().toString().slice(-6)}`,
      email: mgrPersona.email,
      fullNameAr: mgrPersona.fullNameAr,
      role: "facility_manager",
      phone: mgrPersona.phone,
      city: mgrPersona.city,
      governorate: existing.governorate,
      avatarUrl: mgrPersona.avatarUrl,
      authProvider: mgrPersona.authProvider || "captenly",
      hasParentSupervision: false,
      needsOnboarding: false,
      linkedFacilityId: existing.id,
    });

    pushNotification({
      titleAr: `تم توثيق وإدارة ${existing.nameAr} مجاناً!`,
      messageAr: "تحولت الصفحة إلى موثقة ويمكنك الآن تفعيل دفاتر الحصص والـ QR للمشتركين مباشرة.",
      type: "passport_badge",
      actionLabelAr: "فتح لوحة المنشأة",
      actionHref: "/dashboard/facility",
    });

    return {
      ok: true,
      facility: verifiedFac,
      messageAr: `تم استلام إدارة «${existing.nameAr}» وتفعيل التوثيق الأخضر مجاناً!`,
    };
  };

  const seedNewFacilityConcierge = (newFac: {
    nameAr: string;
    city: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    baseMonthlyPrice: number;
    whatsappNumber?: string;
    isHeatedWinter: boolean;
    hasLadiesSlots: boolean;
  }) => {
    const id = `fac-concierge-${Date.now()}`;
    const slug = `${id}-${newFac.city}`;
    const cleanWa = (newFac.whatsappNumber || "").replace(/\D/g, "");
    const created: Facility = {
      id,
      slug,
      nameAr: newFac.nameAr,
      nameEn: "Verified Partner Facility",
      facilityType:
        newFac.sportSector === "fitness"
          ? "gym_fitness"
          : newFac.sportSector === "both"
          ? "multi_sport"
          : "swimming_academy",
      sportSector: newFac.sportSector,
      governorate: "الغربية",
      city: newFac.city,
      district: newFac.district,
      addressAr: `${newFac.district}، ${newFac.city}`,
      coordinates: { lat: 30.9706, lng: 31.1656 },
      whatsappNumber: cleanWa
        ? cleanWa.startsWith("2")
          ? cleanWa
          : `2${cleanWa}`
        : undefined,
      instapayHandle: "",
      vodafoneCashNumber: "",
      supplyStatus: "seeded_unclaimed",
      subscriptionTier: "free_founding",
      isSponsored: false,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — مضافة عبر الدليل",
      avgReplyMinutes: 30,
      completenessScore: 80,
      rating: 4.8,
      reviewsCount: 1,
      heroImage:
        newFac.sportSector === "fitness"
          ? "/screens/b24a11bb17b1.jpg"
          : "/screens/20b781f698f9.jpg",
      scheduleSummaryAr: "يومياً 9 ص – 10 م | مواعيد صباحية ومسائية",
      sourcePublicNoteAr: "لا تتوفر حالياً بيانات أو باقات محدثة مقدمة مباشرة من المنشأة.",
      badges: [],
      poolSpecs:
        newFac.sportSector !== "fitness"
          ? {
              poolType: "نصف أوليمبي 25م",
              depthRange: "1.1م – 1.9م",
              isHeatedWinter: newFac.isHeatedWinter,
              isCoveredIndoor: newFac.isHeatedWinter,
              maxSwimmersPerLane: 6,
              hasLadiesOnlySlots: newFac.hasLadiesSlots,
              hasEdlfLifeguard: true,
            }
          : undefined,
      gymSpecs:
        newFac.sportSector !== "swimming"
          ? {
              areaSqm: 450,
              isAirConditioned: true,
              hasLadiesOnlySlots: newFac.hasLadiesSlots,
              ladiesScheduleAr: "مواعيد سيدات مستقلة متاحة",
              hasFemaleTrainers: newFac.hasLadiesSlots,
              equipmentHighlights: ["تجهيزات رياضية متكاملة"],
            }
          : undefined,
      specialtiesAr:
        newFac.sportSector === "fitness"
          ? ["تضخيم وقوة بدنية", "إنقاص وزن وحرق دهون"]
          : ["تأسيس أطفال", "سباحة الكبار والمبتدئين"],
      pricePackages: [
        {
          id: `pkg-${Date.now()}`,
          nameAr: "الباقة الشهرية الأساسية (8 حصص)",
          sessionsCount: 8,
          sessionsPerWeek: 2,
          durationMinutes: 60,
          baseMonthlyEgp: newFac.baseMonthlyPrice,
          assessmentFeeEgp: 0,
          membershipCardFeeEgp: 0,
          mandatoryKitFeeEgp: 0,
          companionFeeEgp: 0,
        },
      ],
      affiliatedCoachIds: [],
      monthlyMetrics: {
        profileViews: 10,
        comparisonAppearances: 2,
        verifiedWhatsappLeads: 0,
        activeSessionLedgers: 0,
      },
    };

    setFacilities((prev) => [created, ...prev]);
    syncFacilityToSupabase(created);
    return created;
  };

  const claimFacilityListing = (facilityId: string, managerName: string, phone: string) => {
    claimFacilityAndVerify(facilityId, {
      managerName,
      roleTitleAr: "مدير المنشأة",
      phone,
      whatsappNumber: phone,
    });
  };

  // --- موظفو المنشأة والصلاحيات + تبديل الحساب ---
  const myStaffAssignments: FacilityStaffMember[] = facilities.flatMap((fac) =>
    (fac.staffMembers || []).filter((st) => {
      if (!isAuthenticated) return false;
      if (st.linkedPersonaId && st.linkedPersonaId === currentPersona.id) return true;
      if (
        st.linkedMemberCode &&
        currentPersona.memberCode &&
        st.linkedMemberCode.trim().toUpperCase() === currentPersona.memberCode.trim().toUpperCase()
      ) {
        return true;
      }
      if (
        st.hasAccount &&
        st.fullNameAr.trim() === currentPersona.fullNameAr.trim()
      ) {
        return true;
      }
      return false;
    })
  );

  const activeStaffAssignment: FacilityStaffMember | null =
    myStaffAssignments.find((s) => s.id === activeStaffAssignmentId) || null;

  const switchToStaffMode = (staffAssignmentId: string | null) => {
    setActiveStaffAssignmentId(staffAssignmentId);
    if (staffAssignmentId) {
      const target = myStaffAssignments.find((s) => s.id === staffAssignmentId);
      if (target) {
        pushNotification({
          titleAr: `تبديل الحساب: ${target.roleTitleAr}`,
          messageAr: `أنت الآن تعمل بصلاحية «${target.roleTitleAr}» داخل ${target.facilityNameAr}.`,
          type: "passport_badge",
          actionLabelAr: "فتح لوحة المنشأة",
          actionHref: "/dashboard/facility",
        });
      }
    }
  };

  const addFacilityStaffMember = (
    facilityId: string,
    payload: {
      fullNameAr: string;
      role: FacilityStaffRole;
      roleTitleAr?: string;
      phone?: string;
      memberCodeOrQuery?: string;
    }
  ) => {
    const cleanName = payload.fullNameAr.trim();
    if (!cleanName) {
      return { ok: false, messageAr: "يرجى إدخال اسم الموظف رباعياً أو ثلاثياً." };
    }
    const fac = facilities.find((f) => f.id === facilityId);
    if (!fac) {
      return { ok: false, messageAr: "لم يتم العثور على المنشأة." };
    }

    const defaultRoleTitles: Record<FacilityStaffRole, string> = {
      subscriptions_manager: "مسؤول الاشتراكات والحضور",
      accounts_manager: "مدير الحسابات والماليات",
      general_staff: "إداري بالمنشأة",
    };

    const query = (payload.memberCodeOrQuery || "").trim();
    const matchedPersona = allPersonas.find(
      (p) =>
        p.id !== "persona-guest" &&
        ((query &&
          ((p.memberCode && p.memberCode.toUpperCase() === query.toUpperCase()) ||
            p.fullNameAr.includes(query) ||
            (p.email && p.email.toLowerCase() === query.toLowerCase()))) ||
          p.fullNameAr.trim() === cleanName)
    );
    const matchedRegistry = memberRegistry.find(
      (m) =>
        (query &&
          (m.memberCode.toUpperCase() === query.toUpperCase() ||
            m.fullNameAr.includes(query) ||
            (m.email && m.email.toLowerCase() === query.toLowerCase()))) ||
        m.fullNameAr.trim() === cleanName
    );

    const hasAccount = Boolean(matchedPersona || matchedRegistry || query.toUpperCase().startsWith("CAP-"));
    const linkedMemberCode =
      matchedPersona?.memberCode ||
      matchedRegistry?.memberCode ||
      (query.toUpperCase().startsWith("CAP-") ? query.toUpperCase() : undefined);

    const newStaff: FacilityStaffMember = {
      id: `staff-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: fac.id,
      facilityNameAr: fac.nameAr,
      fullNameAr: matchedPersona?.fullNameAr || matchedRegistry?.fullNameAr || cleanName,
      role: payload.role,
      roleTitleAr: payload.roleTitleAr?.trim() || defaultRoleTitles[payload.role],
      phone: payload.phone?.trim() || matchedPersona?.phone || matchedRegistry?.phone,
      linkedMemberCode,
      linkedPersonaId: matchedPersona?.id,
      hasAccount,
      assignedDateAr: "اليوم — صلاحية نشطة",
    };

    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: [newStaff, ...(f.staffMembers || [])],
    }));

    pushNotification({
      titleAr: `تم تعيين ${newStaff.fullNameAr} (${newStaff.roleTitleAr})`,
      messageAr: hasAccount
        ? `تم ربط حساب الموظف (${linkedMemberCode || "حساب مسجل"}) ومنحه صلاحية تبديل الحساب لإدارة مهام «${newStaff.roleTitleAr}» في ${fac.nameAr}.`
        : `تم تسجيل ${newStaff.fullNameAr} ضمن طاقم ${fac.nameAr} بدون اشتراط حساب شخصي.`,
      type: "passport_badge",
    });

    return {
      ok: true,
      staff: newStaff,
      messageAr: hasAccount
        ? `تم إضافة «${newStaff.fullNameAr}» وربط صلاحية (${newStaff.roleTitleAr}) بحسابه بنجاح.`
        : `تم تسجيل «${newStaff.fullNameAr}» (${newStaff.roleTitleAr}) ضمن موظفي المنشأة بنجاح.`,
    };
  };

  const removeFacilityStaffMember = (facilityId: string, staffId: string) => {
    if (activeStaffAssignmentId === staffId) {
      setActiveStaffAssignmentId(null);
    }
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: (f.staffMembers || []).filter((s) => s.id !== staffId),
    }));
  };

  // --- كباتن الأكاديمية والشهادات (مع الربط التلقائي والإشعار) ---
  const addFacilityCoachRosterEntry = (
    facilityId: string,
    payload: {
      fullNameAr: string;
      roleTitleAr: string;
      specialtyAr: string;
      certificatesAr: string[];
      scheduleAr?: string;
      coachIdOrCode?: string;
    }
  ) => {
    const cleanName = payload.fullNameAr.trim();
    if (!cleanName) {
      return { ok: false, messageAr: "يرجى إدخال اسم الكابتن." };
    }
    const fac = facilities.find((f) => f.id === facilityId);
    if (!fac) {
      return { ok: false, messageAr: "لم يتم العثور على المنشأة." };
    }

    const codeQuery = (payload.coachIdOrCode || "").trim();
    const matchedCoach = coaches.find(
      (c) =>
        (codeQuery &&
          (c.id === codeQuery ||
            c.SingleCoachId.toUpperCase() === codeQuery.toUpperCase() ||
            c.fullNameAr.includes(codeQuery))) ||
        c.fullNameAr.trim() === cleanName
    );

    const cleanCerts = payload.certificatesAr.map((c) => c.trim()).filter(Boolean);
    const newEntry: FacilityCoachRosterEntry = {
      id: `roster-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: fac.id,
      fullNameAr: matchedCoach ? matchedCoach.fullNameAr : cleanName,
      roleTitleAr: payload.roleTitleAr.trim() || "مدرب سباحة بالأكاديمية",
      specialtyAr: payload.specialtyAr.trim() || "تأسيس وتدريب سباحة",
      certificatesAr:
        cleanCerts.length > 0
          ? cleanCerts
          : ["شهادة تدريب معتمدة — مسجلة بواسطة إدارة الأكاديمية"],
      scheduleAr: payload.scheduleAr?.trim() || "حسب جدول الأكاديمية المعتمد",
      linkedCoachId: matchedCoach?.id,
      linkedCoachSlug: matchedCoach?.slug,
      linkedSingleCoachId: matchedCoach?.SingleCoachId,
      avatarUrl: matchedCoach?.avatarUrl,
      addedDateAr: "اليوم — معتمد بالأكاديمية",
    };

    updateFacilityAndSync(facilityId, (f) => {
      const nextAffiliated =
        matchedCoach && !f.affiliatedCoachIds.includes(matchedCoach.id)
          ? [...f.affiliatedCoachIds, matchedCoach.id]
          : f.affiliatedCoachIds;
      return {
        ...f,
        affiliatedCoachIds: nextAffiliated,
        coachRoster: [newEntry, ...(f.coachRoster || [])],
      };
    });

    if (matchedCoach) {
      updateCoachAndSync(matchedCoach.id, (c) => {
        const alreadyAffiliated = c.affiliations.some((a) => a.facilityId === fac.id);
        if (alreadyAffiliated) return c;
        return {
          ...c,
          affiliations: [
            ...c.affiliations,
            {
              facilityId: fac.id,
              facilityNameAr: fac.nameAr,
              city: fac.city,
              scheduleAr: newEntry.scheduleAr || "حسب الجدول المعلن",
              roleAr: newEntry.roleTitleAr,
              status: "active_mutual",
            },
          ],
        };
      });

      pushNotification({
        titleAr: `إشعار للكابتن: تم تسجيل اسمك في «${fac.nameAr}»`,
        messageAr: `قامت إدارة «${fac.nameAr}» بتسجيل اسمك وشهاداتك ضمن الكباتن الموثقين بالمنشأة (${newEntry.roleTitleAr}).`,
        type: "affiliation_update",
        actionLabelAr: "عرض صفحة المنشأة",
        actionHref: `/f/${fac.slug}`,
      });
    }

    return {
      ok: true,
      entry: newEntry,
      messageAr: matchedCoach
        ? `تم تسجيل «${newEntry.fullNameAr}» وربط ملفه الشخصي وإرسال إشعار فوري لحسابه، وأصبح ظاهراً في قسم الكباتن الموثقين بالمنشأة.`
        : `تم تسجيل «${newEntry.fullNameAr}» مع شهاداته وأصبح ظاهراً تلقائياً في قسم الكباتن الموثقين بصفحة المنشأة.`,
    };
  };

  const removeFacilityCoachRosterEntry = (facilityId: string, entryId: string) => {
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      coachRoster: (f.coachRoster || []).filter((e) => e.id !== entryId),
    }));
  };

  // --- إدارة المقالات الرياضية (إنشاء / تعديل / حذف بدون صورة افتراضية إجبارية) ---
  const saveEditorialArticle = (payload: {
    id?: string;
    titleAr: string;
    categoryAr: string;
    readTimeMinutes?: number;
    readingMinutes?: number;
    excerptAr: string;
    keyTakeawaysAr?: string[];
    bodyParagraphsAr?: string[];
    contentMarkdownAr?: string;
    imageUrl?: string;
    authorNameAr?: string;
    authorRoleAr?: string;
    authorType?: "coach" | "facility" | "editorial";
    authorEntityId?: string;
    authorSlug?: string;
  }) => {
    const cleanTitle = payload.titleAr.trim();
    const rawParas =
      payload.bodyParagraphsAr && payload.bodyParagraphsAr.length > 0
        ? payload.bodyParagraphsAr
        : (payload.contentMarkdownAr || "").split("\n");
    const cleanParagraphs = rawParas.map((p) => p.trim()).filter(Boolean);
    if (!cleanTitle || cleanParagraphs.length === 0) {
      return {
        ok: false,
        messageAr: "يرجى إدخال عنوان المقال ومحتوى النص الأساسي على الأقل.",
      };
    }

    const cleanTakeaways = (payload.keyTakeawaysAr || []).map((t) => t.trim()).filter(Boolean);
    const cleanExcerpt =
      payload.excerptAr.trim() ||
      cleanParagraphs[0].slice(0, 160) + (cleanParagraphs[0].length > 160 ? "..." : "");
    // إذا لم يرفع الكاتب صورة، لا نضع أي صورة افتراضية على الإطلاق
    const cleanImage = payload.imageUrl ? payload.imageUrl.trim() : "";
    const computedMinutes =
      payload.readTimeMinutes ||
      payload.readingMinutes ||
      Math.max(2, Math.ceil(cleanParagraphs.join(" ").split(/\s+/).length / 130));
    const markdownBody = payload.contentMarkdownAr?.trim() || cleanParagraphs.join("\n\n");

    if (payload.id) {
      let updatedArticle: EditorialArticle | undefined;
      setArticles((prev) =>
        prev.map((art): EditorialArticle => {
          if (art.id !== payload.id) return art;
          const nextArt: EditorialArticle = {
            ...art,
            titleAr: cleanTitle,
            categoryAr: payload.categoryAr.trim() || art.categoryAr,
            readingMinutes: computedMinutes,
            readTimeMinutes: computedMinutes,
            excerptAr: cleanExcerpt,
            contentMarkdownAr: markdownBody,
            keyTakeawaysAr:
              cleanTakeaways.length > 0 ? cleanTakeaways : [cleanExcerpt],
            bodyParagraphsAr: cleanParagraphs,
            imageUrl: cleanImage || undefined,
          };
          updatedArticle = nextArt;
          return nextArt;
        })
      );
      return {
        ok: true,
        article: updatedArticle,
        messageAr: "تم حفظ التعديلات وتحديث المقال بنجاح.",
      };
    }

    const slugBase = cleanTitle
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 45);
    const newId = `art-${Date.now()}`;
    const newArticle: EditorialArticle = {
      id: newId,
      slug: `${slugBase || "article"}-${Math.floor(100 + Math.random() * 899)}`,
      titleAr: cleanTitle,
      categoryAr: payload.categoryAr.trim() || "تدريب وتكنيك السباحة",
      readingMinutes: computedMinutes,
      readTimeMinutes: computedMinutes,
      publishedDateAr: "اليوم — منشور موثق",
      authorNameAr: payload.authorNameAr || currentPersona.fullNameAr,
      authorRoleAr: payload.authorRoleAr || currentPersona.personaTitleAr,
      authorPersonaId: currentPersona.id,
      authorType:
        payload.authorType ||
        (currentPersona.role === "coach"
          ? "coach"
          : currentPersona.role === "facility_manager"
          ? "facility"
          : "editorial"),
      authorEntityId:
        payload.authorEntityId ||
        currentPersona.linkedCoachId ||
        currentPersona.linkedFacilityId,
      authorSlug: payload.authorSlug,
      excerptAr: cleanExcerpt,
      imageUrl: cleanImage || undefined,
      contentMarkdownAr: markdownBody,
      keyTakeawaysAr:
        cleanTakeaways.length > 0 ? cleanTakeaways : [cleanExcerpt],
      bodyParagraphsAr: cleanParagraphs,
      recommendedFacilitySlugs: [],
      recommendedCoachSlugs: [],
    };

    setArticles((prev) => [newArticle, ...prev]);

    pushNotification({
      titleAr: "تم نشر مقالك الرياضي بنجاح!",
      messageAr: `أصبح مقال «${newArticle.titleAr}» متاحاً الآن للقراء في مجلة كابتنلي وفي صفحتك العامة.`,
      type: "passport_badge",
      actionLabelAr: "قراءة المقال",
      actionHref: `/magazine/${newArticle.slug}`,
    });

    return {
      ok: true,
      article: newArticle,
      messageAr: "تم نشر المقال بنجاح في مجلة كابتنلي وفي بروفايلك!",
    };
  };

  const deleteEditorialArticle = (articleId: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAllPersonas(PERSONA_ACCOUNTS);
    setCurrentPersona(GUEST_PERSONA);
    setMemberRegistry(INITIAL_MEMBER_REGISTRY);
    setFacilities(INITIAL_FACILITIES);
    setCoaches(INITIAL_COACHES);
    setMinorAthletes(INITIAL_MINOR_ATHLETES);
    setPbRecords(INITIAL_PB_RECORDS);
    setSessionLedgers(INITIAL_SESSION_LEDGERS);
    setVerifiedLeads(INITIAL_VERIFIED_LEADS);
    setDemandRadar(INITIAL_DEMAND_RADAR);
    setUserLocation(DEFAULT_EGYPT_LOCATION);
    setOfflineQueue([]);
    setSavedFavoriteIds([]);
    setCompareFacilityIds([]);
    setNotifications(INITIAL_NOTIFICATIONS);
    setArticles(INITIAL_ARTICLES);
    setActiveStaffAssignmentId(null);
  };

  return (
    <CaptenlyContext.Provider
      value={{
        currentPersona,
        isAuthenticated,
        authGateModalOpen,
        authGateFeatureNameAr,
        openAuthGateModal,
        closeAuthGateModal,
        switchPersona,
        updateCurrentPersonaAvatar,
        updateCurrentPersonaProfile,
        allPersonas,
        isOfflineSimulated,
        isBrowserOffline,
        effectiveOffline,
        toggleOfflineSimulation,
        memberRegistry,
        registerMemberUser,
        loginOrCreateWithGoogle,
        restoreOrLoginWithGoogle,
        restoreProfileByLogin,
        completeGoogleOnboarding,
        signOutToGuest,
        userLocation,
        setUserCity,
        setUserCoordinates,
        resetLocationToAllEgypt,
        requestAutoGeolocation,
        locationModalOpen,
        setLocationModalOpen,
        smartFilters,
        updateSmartFilters,
        resetSmartFilters,
        filterModalOpen,
        setFilterModalOpen,
        savedFavoriteIds,
        toggleFavorite,
        isFavorite,
        notifications,
        markNotificationAsRead,
        unreadNotificationsCount,
        articles,
        saveEditorialArticle,
        deleteEditorialArticle,
        subscribeNewsletter,
        userSettings,
        updateUserSettings,
        subscribeDemandRadar,
        demandSubmissions,
        facilities,
        coaches,
        minorAthletes,
        pbRecords,
        skillEvaluation,
        sessionLedgers,
        verifiedLeads,
        demandRadar,
        offlineQueue,
        syncOfflineQueue,
        compareFacilityIds,
        toggleCompareFacility,
        clearComparison,
        confirmFacilityPrices60d,
        simulateTimeTravelDays,
        createStructuredWhatsappLead,
        enrollSwimmerByMemberCode,
        checkInSession,
        checkInBySubscriptionCode,
        renewSwimmerSubscription,
        uploadInstaPayReceipt,
        lookupRemoteLedgersOrProfile,
        syncLedgersFromServer,
        addNewPBRecord,
        recordCoachSkillAndPB,
        addMinorAthlete,
        registerAndVerifyCoach,
        addCoachSessionOffer,
        updateCoachSessionOffer,
        removeCoachSessionOffer,
        addFacilitySchoolProgram,
        updateFacilitySchoolProgram,
        removeFacilitySchoolProgram,
        myStaffAssignments,
        activeStaffAssignment,
        switchToStaffMode,
        addFacilityStaffMember,
        removeFacilityStaffMember,
        addFacilityCoachRosterEntry,
        removeFacilityCoachRosterEntry,
        mergeExternalPlacesFacilities,
        placesHydrating,
        validateAndSaveCoachBio,
        gracefulDisaffiliateCoach,
        requestMutualAffiliation,
        approveAffiliationMutual,
        publishSchoolPackage,
        claimFacilityAndVerify,
        seedNewFacilityConcierge,
        claimFacilityListing,
        resetDemoData,
      }}
    >
      {children}
    </CaptenlyContext.Provider>
  );
}

export function useCaptenly() {
  const ctx = useContext(CaptenlyContext);
  if (!ctx) {
    throw new Error("useCaptenly must be used within a CaptenlyProvider");
  }
  return ctx;
}
