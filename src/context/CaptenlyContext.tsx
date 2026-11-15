"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import {
  AccountIntent,
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
  MemberRoleClaim,
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
  VerificationBadge,
  VerifiedLeadItem,
  WorkspaceContextMode,
} from "@/types/captenly";
import { EGYPT_CITY_PRESETS, calculateDistanceKm } from "@/lib/maps";
import { buildSelfRegisteredCoach, getDeterministicCoachId } from "@/lib/coachProvisioning";
import {
  getFacilityStartingPriceEgp,
  resolveGovernorateFromCity,
  schoolProgramToPricePackage,
} from "@/lib/facilityPricing";
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

const DEFAULT_USER_SETTINGS = {
  familyLaw151Consent: false,
  notifyWhatsappSessions: true,
  notifyWhatsappRenewals: true,
  notifyEmailMarketing: false,
  privacyProfilePublic: false,
};

interface CaptenlyContextType {
  // Active Persona / Auth State & Hybrid Workspace Context
  currentPersona: PersonaAccount;
  isAuthenticated: boolean;
  activeWorkspaceContext: WorkspaceContextMode;
  switchWorkspaceContext: (mode: WorkspaceContextMode, staffAssignmentId?: string | null) => void;
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
    accountIntent?: AccountIntent;
  }) => { ok: boolean; detectedKeyword?: string; messageAr?: string };
  allPersonas: PersonaAccount[];
  isOfflineSimulated: boolean;
  isBrowserOffline: boolean;
  effectiveOffline: boolean;
  toggleOfflineSimulation: () => void;

  // Admin-Reviewed Role Claims (Coach / Facility Verification Queue)
  roleClaims: MemberRoleClaim[];
  refreshRoleClaims: (adminMode?: boolean) => Promise<void>;
  submitRoleClaimApplication: (payload: {
    claimType: "coach" | "facility";
    targetFacilityId?: string;
    fullNameAr?: string;
    titleAr?: string;
    phone?: string;
    city?: string;
    governorate?: string;
    district?: string;
    sportSector?: "swimming" | "fitness" | "both";
    yearsExperience?: number;
    bioAr?: string;
    avatarUrl?: string;
    whatsappNumber?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    socialLinks?: UserSocialLinks;
    instapayHandle?: string;
    privatePackage8Egp?: number;
    privatePackage12Egp?: number;
    specialtiesAr?: string[];
    syndicateCardRef?: string;
    edlfCertRef?: string;
    affiliatedFacilityId?: string;
    managerName?: string;
    roleTitleAr?: string;
    commercialRegRef?: string;
    updatedBasePriceEgp?: number;
    proofDocumentUrl?: string;
    proofNotesAr?: string;
  }) => Promise<{
    ok: boolean;
    claim?: MemberRoleClaim;
    detectedKeyword?: string;
    messageAr: string;
  }>;
  reviewRoleClaim: (
    claimId: string,
    decision: "approve" | "reject" | "withdraw",
    reviewerNoteAr?: string
  ) => Promise<{ ok: boolean; claim?: MemberRoleClaim; messageAr: string }>;

  // Member Codes Registry & Auth Registration
  memberRegistry: MemberRegistryEntry[];
  registerMemberUser: (payload: {
    fullNameAr: string;
    phone: string;
    email?: string;
    city: string;
    governorate: string;
    sportPreference: "swimming" | "fitness" | "both";
    hasParentSupervision: boolean;
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
    accountIntent?: AccountIntent;
  }) => { ok: boolean; persona: PersonaAccount; memberCode: string; nextPath?: string };
  registerMemberWithCredentials: (payload: {
    fullNameAr: string;
    phone: string;
    email?: string;
    password: string;
    city: string;
    governorate: string;
    sportPreference: "swimming" | "fitness" | "both";
    hasParentSupervision: boolean;
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
    accountIntent?: AccountIntent;
  }) => Promise<{
    ok: boolean;
    persona?: PersonaAccount;
    memberCode?: string;
    nextPath?: string;
    messageAr?: string;
  }>;
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
  restoreProfileByLogin: (
    query: string,
    password?: string
  ) => Promise<{
    ok: boolean;
    persona?: PersonaAccount;
    messageAr?: string;
  }>;
  completeGoogleOnboarding: (payload: {
    role: "adult_athlete" | "parent" | "coach" | "facility_manager";
    accountIntent?: AccountIntent;
    phone?: string;
    city?: string;
    hasParentSupervision?: boolean;
  }) => Promise<{ ok: boolean; persona: PersonaAccount; nextPath?: string }>;
  signOutToGuest: () => void;
  deleteCurrentAccount: () => Promise<{ ok: boolean }>;

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
  respondToStaffInvitation: (
    facilityId: string,
    staffId: string,
    decision: "accepted" | "declined"
  ) => void;
  addFacilityStaffMember: (
    facilityId: string,
    payload: {
      fullNameAr: string;
      role: FacilityStaffRole;
      roleTitleAr?: string;
      phone?: string;
      email?: string;
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
    targetSport: "swimming" | "fitness" | "both" | "other";
    notes?: string;
    targetFacilityId?: string;
    targetFacilityNameAr?: string;
  }) => { ok: boolean; messageAr: string };
  demandSubmissions: DemandRadarSubmission[];

  // Entities
  facilities: Facility[];
  coaches: Coach[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluation: SkillEvaluation5Point;
  skillEvaluationsByAthlete: Record<string, SkillEvaluation5Point>;
  getSkillEvaluationForAthlete: (athleteId?: string) => SkillEvaluation5Point;
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
    coachNoteAr?: string,
    coachId?: string
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

  confirmReceiptByProvider: (
    ledgerId: string,
    receiptId: string
  ) => { ok: boolean; messageAr: string };

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
  updateMinorAthlete: (
    childId: string,
    patch: Partial<Pick<MinorAthleteProfile, "fullNameAr" | "age" | "gender" | "primarySport">>
  ) => void;
  removeMinorAthlete: (childId: string) => void;
  lookupStaffCandidatesRemote: (query: string) => Promise<
    Array<{
      memberCode: string;
      fullNameAr: string;
      phone: string;
      email?: string;
      city: string;
      role: string;
      avatarUrl?: string;
    }>
  >;

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

  // Facility Claim & Concierge & Admin Badge Review
  reviewEntityBadge: (
    kind: "coach" | "facility",
    entityId: string,
    badgeCode: VerificationBadge["code"],
    nextStatus: "active" | "expired"
  ) => void;

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

  resetDemoData: () => void;
}

const CaptenlyContext = createContext<CaptenlyContextType | undefined>(undefined);

const STORAGE_KEY = "captenly_platform_state_v6";
const LEGACY_STORAGE_KEY_V5 = "captenly_platform_state_v5";
const OWNER_EMAIL_LOWER = "moustafadesign.12@gmail.com";
const OWNER_CLEANUP_KEY = "captenly_single_owner_cleanup_v1";
const LEGACY_FAKE_PERSONA_IDS = new Set([
  "persona-athlete-independent",
  "persona-parent",
  "persona-facility",
  "persona-coach",
]);

type AccountActivitySnapshot = {
  savedFavoriteIds: string[];
  compareFacilityIds: string[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluationsByAthlete: Record<string, SkillEvaluation5Point>;
  notifications: NotificationItem[];
  userSettings: {
    familyLaw151Consent: boolean;
    notifyWhatsappSessions: boolean;
    notifyWhatsappRenewals: boolean;
    notifyEmailMarketing: boolean;
    privacyProfilePublic: boolean;
  };
  userLocation?: UserLocation;
};

function getAccountSnapshotKeys(persona: Pick<PersonaAccount, "memberCode" | "email">): string[] {
  const keys: string[] = [];
  if (persona.memberCode && persona.memberCode.trim()) {
    keys.push(`code:${persona.memberCode.trim().toUpperCase()}`);
  }
  if (persona.email && persona.email.trim()) {
    keys.push(`email:${persona.email.trim().toLowerCase()}`);
  }
  return keys;
}

function findAccountSnapshot(
  snapshots: Record<string, AccountActivitySnapshot>,
  persona: Pick<PersonaAccount, "memberCode" | "email">
): AccountActivitySnapshot | undefined {
  for (const k of getAccountSnapshotKeys(persona)) {
    if (snapshots[k]) return snapshots[k];
  }
  return undefined;
}

function generateDeterministicEmailMemberCode(email: string): string {
  const clean = email.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const num = 1000 + ((h >>> 0) % 9000);
  return `CAP-M-${num}`;
}

export function CaptenlyProvider({ children }: { children: React.ReactNode }) {
  const [allPersonas, setAllPersonas] = useState<PersonaAccount[]>(PERSONA_ACCOUNTS);
  const [currentPersona, setCurrentPersona] = useState<PersonaAccount>(GUEST_PERSONA);
  const [authGateModalOpen, setAuthGateModalOpen] = useState<boolean>(false);
  const [authGateFeatureNameAr, setAuthGateFeatureNameAr] = useState<string>("");
  const [memberRegistry, setMemberRegistry] = useState<MemberRegistryEntry[]>(INITIAL_MEMBER_REGISTRY);
  const isOfflineSimulated = false;
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(false);

  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [placesHydrating, setPlacesHydrating] = useState<boolean>(true);
  const [coaches, setCoaches] = useState<Coach[]>(INITIAL_COACHES);
  const [minorAthletes, setMinorAthletes] = useState<MinorAthleteProfile[]>(INITIAL_MINOR_ATHLETES);
  const [pbRecords, setPbRecords] = useState<PersonalBestRecord[]>(INITIAL_PB_RECORDS);
  const [skillEvaluation, setSkillEvaluation] = useState<SkillEvaluation5Point>(INITIAL_SKILL_EVALUATION);
  const [skillEvaluationsByAthlete, setSkillEvaluationsByAthlete] = useState<
    Record<string, SkillEvaluation5Point>
  >({});
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
  const [activeWorkspaceContext, setActiveWorkspaceContextState] =
    useState<WorkspaceContextMode>("member");
  const [roleClaims, setRoleClaims] = useState<MemberRoleClaim[]>([]);
  const [accountSnapshots, setAccountSnapshots] = useState<
    Record<string, AccountActivitySnapshot>
  >({});
  const [userSettings, setUserSettings] = useState(DEFAULT_USER_SETTINGS);

  const isAuthenticated =
    currentPersona.role !== "guest" && currentPersona.id !== "persona-guest";
  const openAuthGateModal = (featureNameAr = "استخدام هذه الميزة") => {
    setAuthGateFeatureNameAr(featureNameAr);
    setAuthGateModalOpen(true);
  };
  const closeAuthGateModal = () => setAuthGateModalOpen(false);
  const effectiveOffline = isBrowserOffline;

  // Hydrate persisted Offline-First state from localStorage (zero fake seeded personas/favorites/notifications)
  useEffect(() => {
    try {
      const needsOwnerCleanup = localStorage.getItem(OWNER_CLEANUP_KEY) !== "done";
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        let cleanedPersonas: PersonaAccount[] = PERSONA_ACCOUNTS;
        if (Array.isArray(parsed.allPersonas)) {
          cleanedPersonas = (parsed.allPersonas as PersonaAccount[]).filter((p) => {
            if (!p || LEGACY_FAKE_PERSONA_IDS.has(p.id)) return false;
            if (!needsOwnerCleanup) return true;
            return (
              p.role === "guest" ||
              p.id === "persona-guest" ||
              p.email?.toLowerCase() === OWNER_EMAIL_LOWER
            );
          });
          if (!cleanedPersonas.some((p) => p.role === "guest" || p.id === "persona-guest")) {
            cleanedPersonas = [GUEST_PERSONA, ...cleanedPersonas];
          }
          setAllPersonas(cleanedPersonas.length ? cleanedPersonas : PERSONA_ACCOUNTS);
        }

        const keptNonGuestPersonas = cleanedPersonas.filter(
          (p) => p.role !== "guest" && p.id !== "persona-guest"
        );
        const keptIds = new Set(keptNonGuestPersonas.map((p) => p.id));
        const keptCodes = new Set(
          keptNonGuestPersonas
            .map((p) => (p.memberCode || "").trim().toUpperCase())
            .filter(Boolean)
        );
        const keptCoachIds = new Set(
          keptNonGuestPersonas
            .map((p) => p.linkedCoachId || (p.memberCode ? getDeterministicCoachId(p.memberCode) : ""))
            .filter(Boolean)
        );

        if (Array.isArray(parsed.memberRegistry)) {
          setMemberRegistry(
            (parsed.memberRegistry as MemberRegistryEntry[]).filter((m) => {
              if (!m || LEGACY_FAKE_PERSONA_IDS.has(m.athleteId)) return false;
              if (m.memberCode === "CAP-M-5190" || m.memberCode === "CAP-M-4821") return false;
              if (!needsOwnerCleanup) return true;
              return (
                keptIds.has(m.athleteId) ||
                keptCodes.has((m.memberCode || "").trim().toUpperCase())
              );
            })
          );
        }
        if (Array.isArray(parsed.facilities)) {
          setFacilities(
            (parsed.facilities as Facility[]).filter(
              (f) =>
                f &&
                f.sportSector !== "fitness" &&
                !f.id.startsWith("fac-") &&
                f.supplyStatus !== "seeded_unclaimed"
            )
          );
        }
        if (Array.isArray(parsed.coaches)) {
          setCoaches(
            needsOwnerCleanup
              ? (parsed.coaches as Coach[]).filter(
                  (c) =>
                    c &&
                    (keptCoachIds.has(c.id) ||
                      keptCodes.has((c.SingleCoachId || "").trim().toUpperCase()))
                )
              : parsed.coaches
          );
        }

        if (parsed.accountSnapshots && typeof parsed.accountSnapshots === "object") {
          if (needsOwnerCleanup) {
            const filteredSnaps: Record<string, AccountActivitySnapshot> = {};
            for (const [k, v] of Object.entries(
              parsed.accountSnapshots as Record<string, AccountActivitySnapshot>
            )) {
              const lowerK = k.toLowerCase();
              const codePart = k.replace(/^code:/i, "").trim().toUpperCase();
              if (
                lowerK === `email:${OWNER_EMAIL_LOWER}` ||
                (k.toLowerCase().startsWith("code:") && keptCodes.has(codePart))
              ) {
                filteredSnaps[k] = v;
              }
            }
            setAccountSnapshots(filteredSnaps);
          } else {
            setAccountSnapshots(parsed.accountSnapshots);
          }
        }

        const activePersonaFound =
          parsed.personaId && !LEGACY_FAKE_PERSONA_IDS.has(parsed.personaId)
            ? cleanedPersonas.find((p: PersonaAccount) => p.id === parsed.personaId)
            : undefined;
        const activePersonaWasPreserved = Boolean(
          activePersonaFound &&
            (!needsOwnerCleanup ||
              activePersonaFound.role === "guest" ||
              activePersonaFound.id === "persona-guest" ||
              activePersonaFound.email?.toLowerCase() === OWNER_EMAIL_LOWER)
        );

        if (activePersonaWasPreserved && activePersonaFound) {
          if (parsed.minorAthletes) {
            setMinorAthletes(
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
          if (parsed.pbRecords) setPbRecords(parsed.pbRecords);
          if (parsed.skillEvaluationsByAthlete && typeof parsed.skillEvaluationsByAthlete === "object") {
            setSkillEvaluationsByAthlete(parsed.skillEvaluationsByAthlete);
          }
          if (parsed.sessionLedgers) setSessionLedgers(parsed.sessionLedgers);
          if (parsed.verifiedLeads) setVerifiedLeads(parsed.verifiedLeads);
          if (Array.isArray(parsed.savedFavoriteIds)) setSavedFavoriteIds(parsed.savedFavoriteIds);
          if (Array.isArray(parsed.compareFacilityIds)) setCompareFacilityIds(parsed.compareFacilityIds);
          if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications);
          if (parsed.userSettings) setUserSettings(parsed.userSettings);
          if (parsed.userLocation && parsed.userLocation.isSpecified) setUserLocation(parsed.userLocation);
          if (typeof parsed.activeStaffAssignmentId === "string" || parsed.activeStaffAssignmentId === null) {
            setActiveStaffAssignmentId(parsed.activeStaffAssignmentId);
          }
          if (
            parsed.activeWorkspaceContext === "member" ||
            parsed.activeWorkspaceContext === "coach" ||
            parsed.activeWorkspaceContext === "facility" ||
            parsed.activeWorkspaceContext === "staff"
          ) {
            setActiveWorkspaceContextState(parsed.activeWorkspaceContext);
          } else {
            setActiveWorkspaceContextState(
              activePersonaFound.linkedFacilityId || activePersonaFound.role === "facility_manager"
                ? "facility"
                : activePersonaFound.linkedCoachId || activePersonaFound.role === "coach"
                  ? "coach"
                  : "member"
            );
          }
          setCurrentPersona(activePersonaFound);
        } else {
          setCurrentPersona(GUEST_PERSONA);
          setActiveStaffAssignmentId(null);
          setActiveWorkspaceContextState("member");
          setSavedFavoriteIds([]);
          setCompareFacilityIds([]);
          setMinorAthletes([]);
          setPbRecords([]);
          setSkillEvaluationsByAthlete({});
          setSessionLedgers([]);
          setVerifiedLeads([]);
          setNotifications([]);
          setUserSettings(DEFAULT_USER_SETTINGS);
          setUserLocation(DEFAULT_EGYPT_LOCATION);
        }

        if (parsed.demandRadar) setDemandRadar(parsed.demandRadar);
        if (parsed.demandSubmissions) setDemandSubmissions(parsed.demandSubmissions);
        if (parsed.offlineQueue) setOfflineQueue(parsed.offlineQueue);
        if (Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          setArticles(parsed.articles);
        }
        if (parsed.newsletterEmails) setNewsletterEmails(parsed.newsletterEmails);
      } else {
        // One-time clean migration from v5: preserve userLocation & genuinely signed-in accounts only
        const legacyV5 = localStorage.getItem(LEGACY_STORAGE_KEY_V5);
        if (legacyV5) {
          const parsed = JSON.parse(legacyV5);
          if (Array.isArray(parsed.allPersonas)) {
            const realAccounts = (parsed.allPersonas as PersonaAccount[]).filter((p) => {
              if (
                !p ||
                LEGACY_FAKE_PERSONA_IDS.has(p.id) ||
                p.role === "guest" ||
                !(p.authProvider === "google" || p.id.startsWith("user-") || p.id.startsWith("google-"))
              ) {
                return false;
              }
              if (needsOwnerCleanup) {
                return p.email?.toLowerCase() === OWNER_EMAIL_LOWER;
              }
              return true;
            });
            if (realAccounts.length > 0) {
              setAllPersonas([GUEST_PERSONA, ...realAccounts]);
              const activeReal = realAccounts.find((p) => p.id === parsed.personaId);
              if (activeReal) {
                setCurrentPersona(activeReal);
                if (parsed.userLocation && parsed.userLocation.isSpecified) setUserLocation(parsed.userLocation);
              }
            }
          }
          if (!needsOwnerCleanup && Array.isArray(parsed.coaches) && parsed.coaches.length > 0) {
            setCoaches(parsed.coaches);
          }
        }
      }
      if (needsOwnerCleanup) {
        localStorage.setItem(OWNER_CLEANUP_KEY, "done");
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
        if (Array.isArray(data.articles) && data.articles.length > 0) {
          setArticles((prev) => {
            const byId = new Map(prev.map((a) => [a.id, a]));
            for (const remoteArt of data.articles as EditorialArticle[]) {
              if (remoteArt?.id) byId.set(remoteArt.id, remoteArt);
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

  // Auto-fetch live swimming pools from Places / OSM (Egypt-wide when unspecified, or localized when selected)
  useEffect(() => {
    let cancelled = false;
    setPlacesHydrating(true);
    const params = new URLSearchParams();
    const cleanCityParam = (userLocation.city || "")
      .replace(/\s*\(GPS\)/g, "")
      .replace(/موقعك الحالي/g, "")
      .replace(/موقع محدد على الخريطة/g, "")
      .replace(/كل مصر/g, "")
      .replace(/^الكل$/g, "")
      .trim();

    if (userLocation.isSpecified) {
      if (cleanCityParam) params.set("city", cleanCityParam);
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
    } else {
      params.set("scope", "egypt");
    }

    fetch(`/api/places/search?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.places)) {
          const freshExternal = data.places as Facility[];
          setFacilities((prev) => {
            const registered = prev.filter((f) => f.supplyStatus !== "seeded_unclaimed");
            const registeredPlaceIds = new Set(
              registered.map((f) => f.googlePlaceId).filter(Boolean)
            );
            const registeredIds = new Set(registered.map((f) => f.id));
            const uniqueExternal = freshExternal.filter(
              (ext) =>
                !registeredIds.has(ext.id) &&
                (!ext.googlePlaceId || !registeredPlaceIds.has(ext.googlePlaceId))
            );
            return [...registered, ...uniqueExternal];
          });
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

  // Keep per-account local activity snapshot up to date for authenticated users
  useEffect(() => {
    if (!isAuthenticated) return;
    const keys = getAccountSnapshotKeys(currentPersona);
    if (keys.length === 0) return;
    const snap: AccountActivitySnapshot = {
      savedFavoriteIds,
      compareFacilityIds,
      minorAthletes,
      pbRecords,
      skillEvaluationsByAthlete,
      notifications,
      userSettings,
      userLocation: userLocation.isSpecified ? userLocation : undefined,
    };
    setAccountSnapshots((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = snap;
      }
      return next;
    });
  }, [
    isAuthenticated,
    currentPersona,
    savedFavoriteIds,
    compareFacilityIds,
    minorAthletes,
    pbRecords,
    skillEvaluationsByAthlete,
    notifications,
    userSettings,
    userLocation,
  ]);

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
          skillEvaluationsByAthlete,
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
          activeWorkspaceContext,
          accountSnapshots,
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
    skillEvaluationsByAthlete,
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
    activeWorkspaceContext,
    accountSnapshots,
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
    if (!memberCode || currentPersona.needsOnboarding) return;
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

  const generateChildSubCode = (parentCode?: string, index = 1): string => {
    const digits =
      (parentCode || "").replace(/\D/g, "").slice(-4) ||
      String(Math.floor(1000 + Math.random() * 8999));
    const seq = String(Math.max(1, index)).padStart(2, "0");
    return `CAP-JR-${digits}-${seq}`;
  };

  const getDefaultWorkspaceContextForPersona = (persona: PersonaAccount): WorkspaceContextMode => {
    if (persona.linkedFacilityId || persona.role === "facility_manager") return "facility";
    if (persona.linkedCoachId || persona.role === "coach") return "coach";
    return "member";
  };

  const getProfileSyncKey = (persona: PersonaAccount): string => {
    if (persona.role === "guest" || persona.id === "persona-guest") return "";
    if (persona.memberCode) return persona.memberCode;
    return `FAC-${persona.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "USER"}`;
  };

  const refreshRoleClaims = async (adminMode = false) => {
    if (typeof window === "undefined") return;
    if (!adminMode && (currentPersona.role === "guest" || currentPersona.id === "persona-guest")) {
      setRoleClaims([]);
      return;
    }
    try {
      const res = await fetch(
        adminMode ? "/api/supabase/role-claims?scope=admin" : "/api/supabase/role-claims",
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.claims)) {
        setRoleClaims(data.claims as MemberRoleClaim[]);
      }
    } catch {
      // Ignore offline/network failures
    }
  };

  // Hydrate authoritative role/entity links & role claims when signed in
  useEffect(() => {
    if (!isAuthenticated || currentPersona.needsOnboarding) {
      if (!isAuthenticated) setRoleClaims([]);
      return;
    }
    let cancelled = false;
    refreshRoleClaims(false).catch(() => undefined);

    const profileKey = getProfileSyncKey(currentPersona);
    if (profileKey || currentPersona.email) {
      const qs = new URLSearchParams();
      if (profileKey) qs.set("memberCode", profileKey);
      if (currentPersona.email) qs.set("email", currentPersona.email);
      fetch(`/api/supabase/sync-profile?${qs.toString()}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.found || !data?.profile) return;
          const remote = data.profile as {
            role?: PersonaAccount["role"];
            linkedFacilityId?: string;
            linkedCoachId?: string;
            accountIntent?: AccountIntent;
            memberCode?: string;
            hasParentSupervision?: boolean;
            needsOnboarding?: boolean;
          };
          setCurrentPersona((prev) => {
            if (prev.role === "guest" || prev.id === "persona-guest") return prev;
            const nextRole = remote.role || prev.role;
            const nextFacId = remote.linkedFacilityId ?? prev.linkedFacilityId;
            const nextCoachId = remote.linkedCoachId ?? prev.linkedCoachId;
            const nextIntent = remote.accountIntent ?? prev.accountIntent;
            const nextCode = remote.memberCode || prev.memberCode;
            const nextOnboarding = remote.needsOnboarding ?? prev.needsOnboarding;
            if (
              nextRole === prev.role &&
              nextFacId === prev.linkedFacilityId &&
              nextCoachId === prev.linkedCoachId &&
              nextIntent === prev.accountIntent &&
              nextCode === prev.memberCode &&
              nextOnboarding === prev.needsOnboarding
            ) {
              return prev;
            }
            const nextPersona: PersonaAccount = {
              ...prev,
              role: nextRole,
              linkedFacilityId: nextFacId,
              linkedCoachId: nextCoachId,
              accountIntent: nextIntent,
              memberCode: nextCode,
              hasParentSupervision:
                remote.hasParentSupervision ?? prev.hasParentSupervision,
              needsOnboarding: Boolean(nextOnboarding),
            };
            setAllPersonas((list) => list.map((p) => (p.id === nextPersona.id ? nextPersona : p)));
            return nextPersona;
          });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPersona.id, currentPersona.memberCode, isAuthenticated]);

  const persistPrefsToRemote = (
    prefs: {
      favorites?: string[];
      compareIds?: string[];
      userSettings?: Record<string, unknown>;
      userLocation?: Record<string, unknown>;
    },
    overrideMemberCode?: string
  ) => {
    const code = overrideMemberCode || getProfileSyncKey(currentPersona);
    if (!code) return;
    postSupabaseSync("/api/supabase/user-state", {
      type: "prefs",
      memberCode: code,
      prefs,
    });
  };

  // Hydrate PB records, 5-point evaluations, family minor children, saved prefs, and leads from Supabase
  useEffect(() => {
    const profileKey = getProfileSyncKey(currentPersona);
    if (!profileKey || currentPersona.needsOnboarding) return;
    let cancelled = false;
    const athleteIds = [currentPersona.id, ...minorAthletes.map((m) => m.id)]
      .filter(Boolean)
      .join(",");

    fetch(
      `/api/supabase/user-state?memberCode=${encodeURIComponent(profileKey)}&athleteIds=${encodeURIComponent(athleteIds)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        if (Array.isArray(data.pbRecords) && data.pbRecords.length > 0) {
          setPbRecords((prev) => {
            const byId = new Map(prev.map((r) => [r.id, r]));
            for (const rec of data.pbRecords as PersonalBestRecord[]) {
              if (rec?.id) byId.set(rec.id, rec);
            }
            return Array.from(byId.values());
          });
        }
        if (data.skillEvaluations && typeof data.skillEvaluations === "object") {
          setSkillEvaluationsByAthlete((prev) => ({
            ...prev,
            ...(data.skillEvaluations as Record<string, SkillEvaluation5Point>),
          }));
        }
        if (Array.isArray(data.minorAthletes) && data.minorAthletes.length > 0) {
          setMinorAthletes((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            let seq = 0;
            for (const child of data.minorAthletes as MinorAthleteProfile[]) {
              if (!child?.id) continue;
              seq += 1;
              byId.set(child.id, {
                ...child,
                childMemberCode:
                  child.childMemberCode || generateChildSubCode(currentPersona.memberCode, seq),
                parentMemberCode: child.parentMemberCode || currentPersona.memberCode || undefined,
              });
            }
            return Array.from(byId.values());
          });
        }
        if (data.prefs) {
          if (Array.isArray(data.prefs.favorites)) {
            setSavedFavoriteIds(data.prefs.favorites as string[]);
          }
          if (Array.isArray(data.prefs.compareIds)) {
            setCompareFacilityIds(data.prefs.compareIds as string[]);
          }
          if (data.prefs.userSettings && typeof data.prefs.userSettings === "object") {
            setUserSettings({ ...DEFAULT_USER_SETTINGS, ...data.prefs.userSettings });
          } else {
            setUserSettings(DEFAULT_USER_SETTINGS);
          }
          if (data.prefs.userLocation && data.prefs.userLocation.isSpecified) {
            setUserLocation(data.prefs.userLocation as UserLocation);
          }
        }
      })
      .catch(() => undefined);

    const leadTargetId = currentPersona.linkedFacilityId || currentPersona.linkedCoachId;
    if (leadTargetId) {
      fetch(`/api/supabase/leads?targetId=${encodeURIComponent(leadTargetId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok || !Array.isArray(data.leads) || data.leads.length === 0) return;
          setVerifiedLeads((prev) => {
            const byId = new Map(prev.map((l) => [l.id, l]));
            for (const item of data.leads as Array<{
              id: string;
              facilityId: string;
              facilityNameAr: string;
              memberNameAr: string;
              phone: string;
              packageNameAr: string;
              notes?: string;
              createdAt?: string;
            }>) {
              if (!item.id || byId.has(item.id)) continue;
              byId.set(item.id, {
                id: item.id,
                referralCode: `CAP-L-${item.id.slice(-4).toUpperCase()}`,
                targetType: currentPersona.linkedCoachId ? "coach" : "facility",
                targetId: item.facilityId,
                targetNameAr: item.facilityNameAr || currentPersona.fullNameAr,
                inquirerNameAr: item.memberNameAr || "متدرب كابتنلي",
                inquirerPhone: item.phone || "",
                athleteAge: 10,
                requestedSpecialtyAr: item.packageNameAr || "استفسار باقة تدريب",
                preferredScheduleAr: item.notes || "عبر واتساب كابتنلي",
                createdAtAr: item.createdAt ? item.createdAt.slice(0, 10) : "سحابي",
                repliedWithin2h: true,
                replyMinutes: 15,
                convertedToLedger: false,
              });
            }
            return Array.from(byId.values());
          });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPersona.id, currentPersona.memberCode, currentPersona.linkedFacilityId, currentPersona.linkedCoachId]);

  const pushNotification = (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => {
    const { targetMemberCode, ...rest } = notif;
    const recipientCode = (targetMemberCode || getProfileSyncKey(currentPersona)).trim();
    const isForSelf =
      !targetMemberCode || targetMemberCode.trim() === getProfileSyncKey(currentPersona);

    if (isForSelf) {
      setNotifications((prev) => [
        {
          ...rest,
          id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timeAr: "الآن",
          isRead: false,
        },
        ...prev,
      ]);
    }
    if (recipientCode) {
      postSupabaseSync("/api/supabase/notifications", {
        memberCode: recipientCode,
        titleAr: rest.titleAr,
        messageAr: rest.messageAr,
        type: rest.type,
        actionLabelAr: rest.actionLabelAr,
        actionHref: rest.actionHref,
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
      coachId: currentPersona.linkedCoachId || (currentPersona.role === "coach" ? currentPersona.id : undefined),
      facilityId: currentPersona.linkedFacilityId || activeStaffAssignment?.facilityId || undefined,
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
      if (prev.role === "guest" || prev.id === "persona-guest" || prev.needsOnboarding) return prev;
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
    if (!clean || clean === "مصر" || clean === "كل مصر" || clean === "الكل") {
      setUserLocation(DEFAULT_EGYPT_LOCATION);
      return;
    }
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
      persistPrefsToRemote({ userLocation: DEFAULT_EGYPT_LOCATION as unknown as Record<string, unknown> });
      return;
    }
    const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
    const lat = preset?.lat ?? (city === "طنطا" ? 30.7865 : city === "زفتى" ? 30.7124 : 30.0444);
    const lng = preset?.lng ?? (city === "طنطا" ? 31.0004 : city === "زفتى" ? 31.2423 : 31.2357);
    const dist = facilities.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;
    const resolvedGov = resolveGovernorateFromCity(city, preset?.governorate || gov);

    const nextLoc: UserLocation = {
      city,
      governorate: resolvedGov,
      lat,
      lng,
      isAutoDetected: false,
      isSpecified: true,
      distanceKm: dist,
      isOutsideCoverage: false,
    };
    setUserLocation(nextLoc);
    syncAccountCityFromLocation(city, resolvedGov);
    persistPrefsToRemote({ userLocation: nextLoc as unknown as Record<string, unknown> });
  };

  const resetLocationToAllEgypt = () => {
    setUserLocation(DEFAULT_EGYPT_LOCATION);
    persistPrefsToRemote({ userLocation: DEFAULT_EGYPT_LOCATION as unknown as Record<string, unknown> });
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
    setSavedFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      persistPrefsToRemote({ favorites: next });
      return next;
    });
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
    setUserSettings((prev) => {
      const next = { ...prev, ...newSettings };
      persistPrefsToRemote({ userSettings: next as unknown as Record<string, unknown> });
      return next;
    });
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
    targetSport: "swimming" | "fitness" | "both" | "other";
    notes?: string;
    targetFacilityId?: string;
    targetFacilityNameAr?: string;
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
      titleAr: entry.targetFacilityNameAr
        ? `طلب توفير أسعار: ${entry.targetFacilityNameAr}`
        : `طلب توسع في ${entry.city}`,
      messageAr: entry.targetFacilityNameAr
        ? `تم تسجيل طلبك لأكاديمية ${entry.targetFacilityNameAr} في رادار الطلب التفاعلي.`
        : `تم حفظ تسجيلك بنجاح في رادار الطلب التفاعلي لمدينة ${entry.city}.`,
      type: "system",
    });

    postSupabaseSync("/api/supabase/demand-radar", {
      fullNameAr: entry.fullNameAr,
      phone: entry.phone,
      city: entry.city,
      governorate: entry.governorate,
      targetSport: entry.targetSport,
      notes: entry.notes,
      targetFacilityId: entry.targetFacilityId,
      targetFacilityNameAr: entry.targetFacilityNameAr,
    });

    return {
      ok: true,
      messageAr: entry.targetFacilityNameAr
        ? `تم تسجيل طلبك لتوفير أسعار وتوثيق «${entry.targetFacilityNameAr}»! سنقوم بالتواصل معهم وإشعارك فور التفعيل.`
        : `تم تسجيل طلبك لمدينة ${entry.city} بنجاح! سنبلغك فور تفعيل كابتن أو أكاديمية موثقة في نطاقك.`,
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
    accountIntent?: AccountIntent;
  }) => {
    const random4 = Math.floor(1000 + Math.random() * 8999);
    const memberCode = `CAP-M-${random4}`;
    const chosenRole: PersonaAccount["role"] =
      payload.role === "coach"
        ? "coach"
        : payload.role === "facility_manager"
        ? "facility_manager"
        : payload.role === "parent" || payload.hasParentSupervision
        ? "parent"
        : "adult_athlete";
    const resolvedIntent: AccountIntent =
      payload.accountIntent ||
      (chosenRole === "parent" && payload.hasParentSupervision
        ? "both_self_and_parent"
        : chosenRole === "parent"
        ? "parent_only"
        : "self_athlete");
    const nextPath =
      chosenRole === "coach"
        ? "/dashboard/coach"
        : chosenRole === "facility_manager"
        ? "/claim"
        : "/dashboard/athlete";
    const newId = `user-${Date.now()}`;
    const firstName = payload.fullNameAr.split(" ")[0];
    const linkedCoachId = chosenRole === "coach" ? getDeterministicCoachId(memberCode) : undefined;
    const roleTitleMap: Record<PersonaAccount["role"], string> = {
      guest: "زائر كابتنلي",
      adult_athlete: `سبّاح / متدرب وولي أمر — كود ${memberCode}`,
      parent: `سبّاح وولي أمر — ${memberCode}`,
      coach: `كابتن سباحة مسجل — ${memberCode}`,
      facility_manager: `إدارة منشأة / أكاديمية — ${memberCode}`,
      super_admin: "مشرف منصة كابتنلي",
    };

    const newPersona: PersonaAccount = {
      id: newId,
      role: chosenRole,
      accountIntent: resolvedIntent,
      memberCode,
      linkedCoachId,
      hasParentSupervision: chosenRole === "parent" || payload.hasParentSupervision,
      shortLabelAr: `${firstName} (${memberCode})`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr: roleTitleMap[chosenRole],
      city: payload.city || "كل مصر",
      phone: payload.phone,
      descriptionAr:
        "حساب موحد مفعّل بكود عضوية فريد جاهز لمتابعة كافة أنشطتك على كابتنلي.",
    };

    setAllPersonas((prev) => [newPersona, ...prev]);
    applyAccountSnapshotForPersona(newPersona, payload.governorate || "مصر");
    setCurrentPersona(newPersona);
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(newPersona));

    if (chosenRole === "coach") {
      setCoaches((prev) => {
        const nextCoach = buildSelfRegisteredCoach(newPersona, undefined, payload.governorate || "مصر");
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    const regEntry: MemberRegistryEntry = {
      memberCode,
      athleteId: newId,
      fullNameAr: payload.fullNameAr,
      phone: payload.phone,
      city: payload.city || "كل مصر",
      role: chosenRole === "parent" ? "parent" : "adult_athlete",
      isMinor: false,
    };
    setMemberRegistry((prev) => [regEntry, ...prev]);

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode,
      fullNameAr: payload.fullNameAr,
      role: chosenRole,
      accountIntent: resolvedIntent,
      phone: payload.phone,
      city: payload.city || "كل مصر",
      governorate: payload.governorate || "مصر",
      authProvider: "captenly",
      hasParentSupervision: newPersona.hasParentSupervision,
      needsOnboarding: false,
      linkedCoachId,
    });

    return { ok: true, persona: newPersona, memberCode, nextPath };
  };

  const registerMemberWithCredentials: CaptenlyContextType["registerMemberWithCredentials"] = async (
    payload
  ) => {
    const cleanName = payload.fullNameAr.trim();
    const cleanPhone = payload.phone.trim();
    const cleanEmail = payload.email?.trim().toLowerCase() || undefined;
    if (!cleanName || payload.password.length < 6) {
      return {
        ok: false,
        messageAr: "يرجى إدخال الاسم بالكامل وكلمة مرور لا تقل عن 6 أحرف.",
      };
    }

    const random4 = Math.floor(1000 + Math.random() * 8999);
    const dbMemberCode = `CAP-M-${random4}`;
    const chosenRole: PersonaAccount["role"] =
      payload.role === "coach"
        ? "coach"
        : payload.role === "facility_manager"
        ? "facility_manager"
        : payload.role === "parent" || payload.hasParentSupervision
        ? "parent"
        : "adult_athlete";
    const resolvedIntent: AccountIntent =
      payload.accountIntent ||
      (chosenRole === "parent" && payload.hasParentSupervision
        ? "both_self_and_parent"
        : chosenRole === "parent"
        ? "parent_only"
        : "self_athlete");
    const nextPath =
      chosenRole === "coach"
        ? "/dashboard/coach"
        : chosenRole === "facility_manager"
        ? "/claim"
        : "/dashboard/athlete";
    const cleanCity = (payload.city || "").trim() || "كل مصر";
    const cleanGov = resolveGovernorateFromCity(cleanCity, payload.governorate || "مصر");

    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          memberCode: dbMemberCode,
          fullNameAr: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          password: payload.password,
          city: cleanCity,
          governorate: cleanGov,
          sportPreference: payload.sportPreference,
          hasParentSupervision: chosenRole === "parent" || payload.hasParentSupervision,
          role: chosenRole,
          accountIntent: resolvedIntent,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.profile) {
        return {
          ok: false,
          messageAr:
            data?.messageAr ||
            "تعذر إتمام التسجيل في قاعدة البيانات حالياً. تأكد من عدم تكرار رقم الهاتف أو البريد الإلكتروني.",
        };
      }

      const persistedPersona = hydratePersonaFromRemoteProfile({
        ...data.profile,
        memberCode: data.profile.memberCode || dbMemberCode,
        accountIntent: resolvedIntent,
        needsOnboarding: false,
      });

      return {
        ok: true,
        persona: persistedPersona,
        memberCode: persistedPersona.memberCode || dbMemberCode,
        nextPath,
      };
    } catch {
      return {
        ok: false,
        messageAr: "تعذر الاتصال بالخادم لتسجيل الحساب. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.",
      };
    }
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

  const getSnapshotPool = (): Record<string, AccountActivitySnapshot> => {
    if (Object.keys(accountSnapshots).length > 0) return accountSnapshots;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.accountSnapshots && typeof parsed.accountSnapshots === "object") {
            return parsed.accountSnapshots as Record<string, AccountActivitySnapshot>;
          }
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return accountSnapshots;
  };

  const applyAccountSnapshotForPersona = (
    persona: Pick<PersonaAccount, "memberCode" | "email" | "city">,
    governorate = "مصر"
  ) => {
    const snap = findAccountSnapshot(getSnapshotPool(), persona);
    if (snap) {
      setSavedFavoriteIds(snap.savedFavoriteIds || []);
      setCompareFacilityIds(snap.compareFacilityIds || []);
      setMinorAthletes(snap.minorAthletes || []);
      setPbRecords(snap.pbRecords || []);
      setSkillEvaluationsByAthlete(snap.skillEvaluationsByAthlete || {});
      setNotifications(snap.notifications || []);
      setUserSettings(
        snap.userSettings ? { ...DEFAULT_USER_SETTINGS, ...snap.userSettings } : DEFAULT_USER_SETTINGS
      );
      if (snap.userLocation?.isSpecified) {
        setUserLocation(snap.userLocation);
      } else {
        applyAccountCityToUserLocation(persona.city, governorate);
      }
      return true;
    }
    setSavedFavoriteIds([]);
    setCompareFacilityIds([]);
    setMinorAthletes([]);
    setPbRecords([]);
    setSkillEvaluationsByAthlete({});
    setNotifications([]);
    setUserSettings(DEFAULT_USER_SETTINGS);
    applyAccountCityToUserLocation(persona.city, governorate);
    return false;
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
    const isVerifiedLocalReturningOwner =
      Boolean(existing) &&
      existing?.needsOnboarding === false &&
      cleanEmail === OWNER_EMAIL_LOWER;

    if (existing && isVerifiedLocalReturningOwner) {
      const stableCode =
        existing.role === "facility_manager"
          ? existing.memberCode || ""
          : existing.memberCode || generateDeterministicEmailMemberCode(cleanEmail);
      const updated: PersonaAccount = {
        ...existing,
        memberCode: stableCode || existing.memberCode,
        fullNameAr: existing.fullNameAr || cleanName,
        avatarUrl: existing.avatarUrl || payload.image || undefined,
        email: cleanEmail,
        authProvider: "google",
        needsOnboarding: false,
      };
      setAllPersonas((prev) => prev.map((p) => (p.id === existing.id ? updated : p)));
      if (currentPersona.id !== updated.id) {
        applyAccountSnapshotForPersona(updated);
      }
      setCurrentPersona(updated);
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(updated));
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: stableCode || `FAC-${updated.id.slice(-6)}`,
        email: cleanEmail,
        fullNameAr: updated.fullNameAr,
        role: updated.role,
        phone: updated.phone,
        city: updated.city,
        avatarUrl: updated.avatarUrl,
        authProvider: "google",
        hasParentSupervision: updated.hasParentSupervision,
        needsOnboarding: false,
      });
      return {
        ok: true,
        isNewUser: false,
        persona: updated,
        memberCode: stableCode,
      };
    }

    const memberCode = generateDeterministicEmailMemberCode(cleanEmail);
    const safeSlug = cleanEmail.replace(/[^a-z0-9]/g, "-");
    const newId = `google-${safeSlug}`;
    const firstName = cleanName.split(" ")[0];
    const defaultUserCity = "كل مصر";

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
        ? `حساب معاينة مسجّل بالبريد (${cleanEmail}).`
        : `حساب موثّق عبر Google (${cleanEmail}).`,
    };

    const keysToClear = getAccountSnapshotKeys(newPersona);
    if (keysToClear.length > 0) {
      setAccountSnapshots((prev) => {
        const next = { ...prev };
        for (const k of keysToClear) {
          delete next[k];
        }
        return next;
      });
    }
    setSavedFavoriteIds([]);
    setCompareFacilityIds([]);
    setMinorAthletes([]);
    setPbRecords([]);
    setSkillEvaluationsByAthlete({});
    setSkillEvaluation(INITIAL_SKILL_EVALUATION);
    setNotifications([]);
    setVerifiedLeads([]);
    setUserSettings(DEFAULT_USER_SETTINGS);
    setUserLocation(DEFAULT_EGYPT_LOCATION);

    setAllPersonas((prev) => [
      newPersona,
      ...prev.filter((p) => p.id !== newId && p.email?.toLowerCase() !== cleanEmail),
    ]);
    setCurrentPersona(newPersona);
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState("member");

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

    return { ok: true, isNewUser: true, persona: newPersona, memberCode };
  };

  const completeGoogleOnboarding: CaptenlyContextType["completeGoogleOnboarding"] = async (
    payload
  ) => {
    const cleanPhone = (payload.phone ?? currentPersona.phone ?? "").trim();
    const rawCity = (payload.city ?? currentPersona.city ?? "كل مصر").trim();
    const cleanCity = !rawCity || rawCity === "مصر" ? "كل مصر" : rawCity;
    const cleanGov = resolveGovernorateFromCity(cleanCity, "مصر");
    const firstName = currentPersona.fullNameAr.split(" ")[0];

    const existingSuffix = (currentPersona.memberCode || "").split("-").pop();
    const validDigits = /^\d{4}$/.test(existingSuffix || "")
      ? existingSuffix
      : String(Math.floor(1000 + Math.random() * 8999));

    const chosenRole: PersonaAccount["role"] =
      !currentPersona.needsOnboarding &&
      (currentPersona.role === "coach" ||
        currentPersona.role === "facility_manager" ||
        currentPersona.role === "super_admin")
        ? currentPersona.role
        : payload.role === "coach"
        ? "coach"
        : payload.role === "facility_manager"
        ? "facility_manager"
        : payload.role === "parent" || payload.hasParentSupervision
        ? "parent"
        : "adult_athlete";

    const resolvedIntent: AccountIntent =
      payload.accountIntent ||
      (chosenRole === "parent" && payload.hasParentSupervision
        ? "both_self_and_parent"
        : chosenRole === "parent"
        ? "parent_only"
        : "self_athlete");
    const nextCode =
      currentPersona.memberCode && /^CAP-M-\d+/i.test(currentPersona.memberCode)
        ? currentPersona.memberCode
        : `CAP-M-${validDigits}`;
    const nextLinkedCoachId =
      chosenRole === "coach"
        ? currentPersona.linkedCoachId || getDeterministicCoachId(nextCode)
        : currentPersona.linkedCoachId;

    const roleTitleMap: Record<PersonaAccount["role"], string> = {
      guest: "زائر كابتنلي",
      adult_athlete: `سبّاح / متدرب وولي أمر — كود ${nextCode}`,
      parent: `سبّاح وولي أمر — ${nextCode}`,
      coach: `كابتن سباحة مسجل — ${nextCode}`,
      facility_manager: `إدارة منشأة / أكاديمية — ${nextCode}`,
      super_admin: "مشرف منصة كابتنلي",
    };

    const updatedPersona: PersonaAccount = {
      ...currentPersona,
      role: chosenRole,
      accountIntent: resolvedIntent,
      memberCode: nextCode,
      linkedCoachId: nextLinkedCoachId,
      phone: cleanPhone,
      city: cleanCity,
      hasParentSupervision:
        chosenRole === "parent" ? true : Boolean(payload.hasParentSupervision),
      needsOnboarding: false,
      shortLabelAr: `${firstName} (${nextCode})`,
      personaTitleAr: roleTitleMap[chosenRole],
    };

    let syncedData: {
      memberCode?: string;
      role?: PersonaAccount["role"];
      linkedCoachId?: string;
      linkedFacilityId?: string;
    } | null = null;

    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/supabase/sync-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberCode: nextCode,
            email: updatedPersona.email,
            fullNameAr: updatedPersona.fullNameAr,
            role: updatedPersona.role,
            accountIntent: resolvedIntent,
            phone: updatedPersona.phone,
            city: updatedPersona.city,
            governorate: cleanGov,
            avatarUrl: updatedPersona.avatarUrl,
            authProvider: updatedPersona.authProvider || "google",
            hasParentSupervision: updatedPersona.hasParentSupervision,
            needsOnboarding: false,
            linkedFacilityId: updatedPersona.linkedFacilityId,
            linkedCoachId: updatedPersona.linkedCoachId,
          }),
        });
        if (res.ok) {
          syncedData = await res.json().catch(() => null);
        }
      } catch {
        // Offline / unreachable fallback: keep local state
      }
    }

    const finalCode = syncedData?.memberCode || nextCode;
    const finalRole = syncedData?.role || chosenRole;
    const finalLinkedCoachId =
      syncedData?.linkedCoachId ||
      (finalRole === "coach"
        ? nextLinkedCoachId || getDeterministicCoachId(finalCode)
        : updatedPersona.linkedCoachId);
    const finalLinkedFacilityId = syncedData?.linkedFacilityId ?? updatedPersona.linkedFacilityId;
    const finalPersona: PersonaAccount = {
      ...updatedPersona,
      memberCode: finalCode,
      role: finalRole,
      linkedCoachId: finalLinkedCoachId,
      linkedFacilityId: finalLinkedFacilityId,
      shortLabelAr: `${firstName} (${finalCode})`,
      personaTitleAr: roleTitleMap[finalRole] || roleTitleMap[chosenRole],
    };
    const nextPath =
      finalRole === "coach"
        ? "/dashboard/coach"
        : finalRole === "facility_manager"
        ? "/claim"
        : "/dashboard/athlete";

    setCurrentPersona(finalPersona);
    setAllPersonas((prev) =>
      prev.map((p) => (p.id === currentPersona.id ? finalPersona : p))
    );
    setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(finalPersona));
    applyAccountCityToUserLocation(cleanCity, cleanGov);

    if (finalRole === "coach") {
      setCoaches((prev) => {
        const existingCoach = prev.find(
          (c) =>
            (finalLinkedCoachId && c.id === finalLinkedCoachId) ||
            c.SingleCoachId?.toUpperCase() === finalCode.toUpperCase()
        );
        const nextCoach = buildSelfRegisteredCoach(finalPersona, existingCoach, cleanGov);
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    setMemberRegistry((prev) => {
      const regRole = finalRole === "parent" ? "parent" : "adult_athlete";
      const hasEntry = prev.some((m) => m.athleteId === currentPersona.id);
      if (hasEntry) {
        return prev.map((m) =>
          m.athleteId === currentPersona.id
            ? {
                ...m,
                memberCode: finalCode,
                phone: cleanPhone,
                city: cleanCity,
                role: regRole,
              }
            : m
        );
      }
      return [
        {
          memberCode: finalCode,
          athleteId: currentPersona.id,
          fullNameAr: currentPersona.fullNameAr,
          phone: cleanPhone,
          city: cleanCity,
          role: regRole,
          isMinor: false,
        },
        ...prev,
      ];
    });

    return { ok: true, persona: finalPersona, nextPath };
  };

  const hydratePersonaFromRemoteProfile = (remote: {
    id?: string;
    memberCode?: string;
    dbProfileKey?: string;
    email?: string;
    fullNameAr: string;
    role: PersonaAccount["role"];
    accountIntent?: AccountIntent;
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
    const isPendingOnboarding = Boolean(remote.needsOnboarding);
    const effectiveRole: PersonaAccount["role"] = isPendingOnboarding
      ? "adult_athlete"
      : remote.role || "adult_athlete";
    const isFacilityRole = effectiveRole === "facility_manager";
    const cleanCode = remote.memberCode || "";
    const resolvedLinkedFac = isPendingOnboarding ? undefined : remote.linkedFacilityId || undefined;
    const resolvedLinkedCoach = isPendingOnboarding
      ? undefined
      : remote.linkedCoachId ||
        (effectiveRole === "coach" && cleanCode ? getDeterministicCoachId(cleanCode) : undefined);

    const roleTitles: Record<PersonaAccount["role"], string> = {
      guest: "زائر كابتنلي",
      adult_athlete: `سبّاح / متدرب وولي أمر — كود ${cleanCode || "CAP-M"}`,
      parent: `سبّاح وولي أمر — ${cleanCode || "CAP-M"}`,
      coach: `كابتن سباحة مسجل — ${cleanCode || "CAP-M"}`,
      facility_manager: `إدارة منشأة / أكاديمية${cleanCode ? ` — ${cleanCode}` : ""}`,
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
      role: effectiveRole,
      accountIntent: isPendingOnboarding
        ? remote.accountIntent
        : remote.accountIntent ?? existing?.accountIntent,
      memberCode: cleanCode,
      hasParentSupervision: Boolean(remote.hasParentSupervision),
      avatarUrl: isPendingOnboarding
        ? remote.avatarUrl || undefined
        : remote.avatarUrl || existing?.avatarUrl || undefined,
      email: remote.email || existing?.email,
      authProvider: remote.authProvider || existing?.authProvider || "phone",
      needsOnboarding: isPendingOnboarding,
      shortLabelAr: isFacilityRole
        ? `إدارة (${firstName})`
        : cleanCode
        ? `${firstName} (${cleanCode})`
        : firstName,
      fullNameAr: remote.fullNameAr,
      personaTitleAr: roleTitles[effectiveRole] || roleTitles.adult_athlete,
      city: remote.city || "كل مصر",
      phone: isPendingOnboarding ? remote.phone || "" : remote.phone || existing?.phone || "",
      bioAr: isPendingOnboarding ? remote.bioAr : remote.bioAr ?? existing?.bioAr,
      socialLinks: isPendingOnboarding ? remote.socialLinks : remote.socialLinks ?? existing?.socialLinks,
      linkedFacilityId: resolvedLinkedFac,
      linkedCoachId: resolvedLinkedCoach,
      descriptionAr: isPendingOnboarding
        ? "حساب جديد بانتظار استكمال اختيار نوع الحساب."
        : existing?.descriptionAr ||
          "حساب محفوظ ومزامن عبر كابتنلي لاستعادة كافة البيانات عبر الأجهزة.",
    };

    const isSwitchingPersona = currentPersona.id !== persona.id;
    setAllPersonas((prev) => [persona, ...prev.filter((p) => p.id !== persona.id && (!persona.email || p.email?.toLowerCase() !== persona.email.toLowerCase()))]);
    if (isPendingOnboarding) {
      const keysToClear = getAccountSnapshotKeys(persona);
      if (keysToClear.length > 0) {
        setAccountSnapshots((prev) => {
          const next = { ...prev };
          for (const k of keysToClear) {
            delete next[k];
          }
          return next;
        });
      }
      setSavedFavoriteIds([]);
      setCompareFacilityIds([]);
      setMinorAthletes([]);
      setPbRecords([]);
      setSkillEvaluationsByAthlete({});
      setSkillEvaluation(INITIAL_SKILL_EVALUATION);
      setNotifications([]);
      setVerifiedLeads([]);
      setUserSettings(DEFAULT_USER_SETTINGS);
      setUserLocation(DEFAULT_EGYPT_LOCATION);
    } else if (isSwitchingPersona) {
      applyAccountSnapshotForPersona(persona, remote.governorate || "مصر");
    }
    setCurrentPersona(persona);
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(persona));

    if (!isPendingOnboarding && persona.role === "coach") {
      setCoaches((prev) => {
        const existingCoach = prev.find(
          (c) =>
            (resolvedLinkedCoach && c.id === resolvedLinkedCoach) ||
            (cleanCode && c.SingleCoachId?.toUpperCase() === cleanCode.toUpperCase())
        );
        const nextCoach = buildSelfRegisteredCoach(
          persona,
          existingCoach,
          remote.governorate || resolveGovernorateFromCity(persona.city, "مصر")
        );
        return [nextCoach, ...prev.filter((c) => c.id !== nextCoach.id)];
      });
    }

    if (cleanCode) {
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

    if (!isPendingOnboarding && (cleanCode || persona.linkedFacilityId || persona.linkedCoachId)) {
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
    const cleanName = payload.name.trim() || cleanEmail.split("@")[0] || "عضو كابتنلي";

    try {
      const authRes = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "google_login",
          email: cleanEmail,
          fullNameAr: cleanName,
          avatarUrl: payload.image || undefined,
          isSimulatedPreview: Boolean(payload.isSimulatedPreview),
        }),
      });
      if (authRes.ok) {
        const authData = await authRes.json().catch(() => null);
        if (authData?.ok && authData?.profile) {
          const restored = hydratePersonaFromRemoteProfile({
            ...authData.profile,
            needsOnboarding: Boolean(authData.profile.needsOnboarding),
            avatarUrl: authData.profile.avatarUrl || payload.image || undefined,
            authProvider: "google",
          });
          return {
            ok: true,
            isNewUser: Boolean(authData.isNewUser) || Boolean(authData.profile.needsOnboarding),
            persona: restored,
            memberCode: restored.memberCode || "",
          };
        }
      }
    } catch {
      // Fall through to sync-profile GET or local fallback
    }

    try {
      const res = await fetch(`/api/supabase/sync-profile?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.found && data?.profile) {
          const restored = hydratePersonaFromRemoteProfile({
            ...data.profile,
            needsOnboarding: Boolean(data.profile.needsOnboarding),
            avatarUrl: data.profile.avatarUrl || payload.image || undefined,
            authProvider: "google",
          });
          return {
            ok: true,
            isNewUser: Boolean(data.profile.needsOnboarding),
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

  const restoreProfileByLogin: CaptenlyContextType["restoreProfileByLogin"] = async (
    query,
    password = ""
  ) => {
    const clean = query.trim();
    if (!clean) {
      return { ok: false, messageAr: "يرجى إدخال كود العضوية أو رقم الموبايل أو البريد الإلكتروني." };
    }
    if (!password) {
      return { ok: false, messageAr: "يرجى إدخال كلمة المرور للمتابعة." };
    }

    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          query: clean,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.profile) {
        const restored = hydratePersonaFromRemoteProfile(data.profile);
        return { ok: true, persona: restored };
      }
      return {
        ok: false,
        messageAr:
          data?.messageAr ||
          "بيانات الدخول غير صحيحة أو الحساب غير موجود.",
      };
    } catch {
      return {
        ok: false,
        messageAr: "تعذر الاتصال بالخادم للتحقق من كلمة المرور. يرجى المحاولة مجدداً.",
      };
    }
  };

  const signOutToGuest = () => {
    if (isAuthenticated) {
      const snapKeys = getAccountSnapshotKeys(currentPersona);
      if (snapKeys.length > 0) {
        const snap: AccountActivitySnapshot = {
          savedFavoriteIds,
          compareFacilityIds,
          minorAthletes,
          pbRecords,
          skillEvaluationsByAthlete,
          notifications,
          userSettings,
          userLocation: userLocation.isSpecified ? userLocation : undefined,
        };
        setAccountSnapshots((prev) => {
          const next = { ...prev };
          for (const k of snapKeys) {
            next[k] = snap;
          }
          return next;
        });
      }
      const syncCode = getProfileSyncKey(currentPersona);
      if (syncCode) {
        persistPrefsToRemote(
          {
            favorites: savedFavoriteIds,
            compareIds: compareFacilityIds,
            userSettings,
            userLocation: userLocation as unknown as Record<string, unknown>,
          },
          syncCode
        );
      }
    }

    if (typeof window !== "undefined") {
      fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => {});
      nextAuthSignOut({ redirect: false }).catch(() => {});
    }
    const guest =
      allPersonas.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS[0];
    setCurrentPersona(guest);
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState("member");
    setRoleClaims([]);
    setSavedFavoriteIds([]);
    setCompareFacilityIds([]);
    setMinorAthletes([]);
    setPbRecords([]);
    setSkillEvaluationsByAthlete({});
    setSkillEvaluation(INITIAL_SKILL_EVALUATION);
    setVerifiedLeads([]);
    setNotifications([]);
    setUserLocation(DEFAULT_EGYPT_LOCATION);
    setUserSettings(DEFAULT_USER_SETTINGS);
  };

  const deleteCurrentAccount: CaptenlyContextType["deleteCurrentAccount"] = async () => {
    const targetPersona = currentPersona;
    const targetCode = (targetPersona.memberCode || "").trim().toUpperCase();
    const targetEmail = (targetPersona.email || "").trim().toLowerCase();
    const targetId = targetPersona.id;
    const childIds = new Set(minorAthletes.map((m) => m.id));
    const keysToRemove = getAccountSnapshotKeys(targetPersona);

    let serverOk = true;
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/auth/member-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_account",
            memberCode: targetCode || undefined,
            email: targetEmail || undefined,
            athleteId: targetId,
          }),
        });
        if (!res.ok && res.status !== 401 && res.status !== 503) {
          serverOk = false;
        }
      } catch {
        // Proceed with full local cleanup even when offline
      }
      nextAuthSignOut({ redirect: false }).catch(() => {});
    }

    setAccountSnapshots((prev) => {
      const next = { ...prev };
      for (const k of keysToRemove) {
        delete next[k];
      }
      return next;
    });

    setAllPersonas((prev) =>
      prev.filter(
        (p) =>
          p.id !== targetId &&
          (!targetCode || (p.memberCode || "").toUpperCase() !== targetCode) &&
          (!targetEmail || (p.email || "").toLowerCase() !== targetEmail)
      )
    );
    setMemberRegistry((prev) =>
      prev.filter(
        (m) =>
          m.athleteId !== targetId &&
          (!targetCode || m.memberCode.toUpperCase() !== targetCode)
      )
    );
    setSessionLedgers((prev) =>
      prev.filter(
        (l) =>
          l.athleteId !== targetId &&
          !childIds.has(l.athleteId) &&
          (!targetCode || (l.memberCode || "").toUpperCase() !== targetCode)
      )
    );
    const deletedCoachId =
      targetPersona.linkedCoachId || (targetCode ? getDeterministicCoachId(targetCode) : "");
    setCoaches((prev) =>
      prev.filter(
        (c) =>
          (!deletedCoachId || c.id !== deletedCoachId) &&
          (!targetCode || (c.SingleCoachId || "").toUpperCase() !== targetCode)
      )
    );

    const guest =
      PERSONA_ACCOUNTS.find((p) => p.role === "guest") || GUEST_PERSONA;
    setCurrentPersona(guest);
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState("member");
    setRoleClaims([]);
    setSavedFavoriteIds([]);
    setCompareFacilityIds([]);
    setMinorAthletes([]);
    setPbRecords([]);
    setSkillEvaluationsByAthlete({});
    setSkillEvaluation(INITIAL_SKILL_EVALUATION);
    setVerifiedLeads([]);
    setNotifications([]);
    setUserLocation(DEFAULT_EGYPT_LOCATION);
    setUserSettings(DEFAULT_USER_SETTINGS);

    return { ok: serverOk };
  };

  const switchPersona = (personaId: string) => {
    const target = allPersonas.find((p) => p.id === personaId);
    if (target) {
      if (target.id !== currentPersona.id) {
        if (target.role === "guest") {
          setSavedFavoriteIds([]);
          setCompareFacilityIds([]);
          setMinorAthletes([]);
          setPbRecords([]);
          setSkillEvaluationsByAthlete({});
          setNotifications([]);
          setUserLocation(DEFAULT_EGYPT_LOCATION);
          setUserSettings(DEFAULT_USER_SETTINGS);
        } else {
          applyAccountSnapshotForPersona(target);
        }
      }
      setCurrentPersona(target);
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(target));
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
      const profileKey = getProfileSyncKey(currentPersona);
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: profileKey,
        email: currentPersona.email,
        fullNameAr: currentPersona.fullNameAr,
        role: currentPersona.role,
        accountIntent: currentPersona.accountIntent,
        phone: currentPersona.phone,
        city: currentPersona.city,
        avatarUrl: avatarDataUrl,
        authProvider: currentPersona.authProvider || "captenly",
        hasParentSupervision: currentPersona.hasParentSupervision,
        needsOnboarding: false,
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
    accountIntent?: AccountIntent;
  }) => {
    if (currentPersona.linkedCoachId && patch.bioAr !== undefined) {
      const linkedCoach = coaches.find((c) => c.id === currentPersona.linkedCoachId);
      const hasMedicalLicense = linkedCoach?.badges.some(
        (b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active"
      );
      if (!hasMedicalLicense) {
        const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => patch.bioAr?.includes(kw));
        if (detected) {
          return {
            ok: false,
            detectedKeyword: detected,
            messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
          };
        }
      }
    }

    const next: PersonaAccount = {
      ...currentPersona,
      ...(patch.fullNameAr !== undefined ? { fullNameAr: patch.fullNameAr } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.bioAr !== undefined ? { bioAr: patch.bioAr } : {}),
      ...(patch.socialLinks !== undefined
        ? { socialLinks: { ...(currentPersona.socialLinks || {}), ...patch.socialLinks } }
        : {}),
      ...(patch.hasParentSupervision !== undefined
        ? { hasParentSupervision: patch.hasParentSupervision }
        : {}),
      ...(patch.accountIntent !== undefined ? { accountIntent: patch.accountIntent } : {}),
    };

    const effectiveCoachId =
      next.linkedCoachId ||
      (next.role === "coach" && next.memberCode ? getDeterministicCoachId(next.memberCode) : undefined);

    if (effectiveCoachId) {
      next.linkedCoachId = effectiveCoachId;
    }

    setCurrentPersona(next);
    setAllPersonas((list) => list.map((p) => (p.id === next.id ? next : p)));

    if (effectiveCoachId) {
      const govForCoach = resolveGovernorateFromCity(next.city, "مصر");
      setCoaches((list) => {
        const existingCoach = list.find(
          (c) =>
            c.id === effectiveCoachId ||
            (next.memberCode && c.SingleCoachId?.toUpperCase() === next.memberCode.toUpperCase())
        );
        const nextCoach = buildSelfRegisteredCoach(next, existingCoach, govForCoach);
        syncCoachToSupabase(nextCoach);
        return [nextCoach, ...list.filter((c) => c.id !== nextCoach.id)];
      });
    }

    if (next.linkedFacilityId) {
      updateFacilityAndSync(next.linkedFacilityId, (f) => ({
        ...f,
        ...(patch.city && patch.city !== "كل مصر"
          ? {
              city: patch.city,
              governorate: resolveGovernorateFromCity(patch.city, f.governorate),
            }
          : {}),
        ...(patch.bioAr !== undefined ? { publicDescriptionAr: patch.bioAr } : {}),
        ...(patch.socialLinks?.facebook !== undefined
          ? { facebookUrl: patch.socialLinks.facebook || f.facebookUrl }
          : {}),
        ...(patch.socialLinks?.instagram !== undefined
          ? { instagramUrl: patch.socialLinks.instagram || f.instagramUrl }
          : {}),
      }));
    }

    if (next.role !== "guest") {
      const profileKey = getProfileSyncKey(next);
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: profileKey,
        email: next.email,
        fullNameAr: next.fullNameAr,
        role: next.role,
        accountIntent: next.accountIntent,
        phone: next.phone,
        city: next.city,
        avatarUrl: next.avatarUrl,
        bioAr: next.bioAr,
        socialLinks: next.socialLinks,
        authProvider: next.authProvider || "captenly",
        hasParentSupervision: next.hasParentSupervision,
        needsOnboarding: false,
        linkedFacilityId: next.linkedFacilityId,
        linkedCoachId: next.linkedCoachId,
      });
    }

    return { ok: true, messageAr: "تم حفظ تحديثات الملف بنجاح." };
  };

  const toggleOfflineSimulation = () => {};

  const toggleCompareFacility = (facilityId: string) => {
    if (compareFacilityIds.includes(facilityId)) {
      const next = compareFacilityIds.filter((id) => id !== facilityId);
      setCompareFacilityIds(next);
      persistPrefsToRemote({ compareIds: next });
      return { ok: true };
    }
    if (compareFacilityIds.length >= 4) {
      return {
        ok: false,
        messageAr: "الحد الأقصى للمقارنة الجانبية هو 4 منشآت في شاشة واحدة (MVP-04).",
      };
    }
    const next = [...compareFacilityIds, facilityId];
    setCompareFacilityIds(next);
    persistPrefsToRemote({ compareIds: next });
    return { ok: true };
  };

  const clearComparison = () => {
    setCompareFacilityIds([]);
    persistPrefsToRemote({ compareIds: [] });
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

    const regMatch = memberRegistry.find(
      (m) =>
        m.memberCode.toUpperCase() === normalizedCode ||
        (m.childMemberCode || "").toUpperCase() === normalizedCode
    );
    const minorMatch = minorAthletes.find(
      (c) =>
        (c.childMemberCode || "").toUpperCase() === normalizedCode ||
        c.id.toUpperCase() === rawCode
    );
    const personaMatch = allPersonas.find((p) => (p.memberCode || "").toUpperCase() === normalizedCode);
    const targetFacility = facilities.find((f) => f.id === payload.facilityId);
    const targetCoach = coaches.find((c) => c.id === payload.coachId);

    const athleteId =
      minorMatch?.id || regMatch?.athleteId || personaMatch?.id || `member-${normalizedCode}`;
    const athleteNameAr =
      payload.athleteNameAr?.trim() ||
      minorMatch?.fullNameAr ||
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
      isMinor: Boolean(payload.isMinor ?? (minorMatch ? true : regMatch?.isMinor)),
      parentNameAr: payload.parentNameAr || (minorMatch ? currentPersona.fullNameAr : regMatch?.parentNameAr),
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
          role: "adult_athlete",
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
        messageAr: `أهلاً ${athleteNameAr} — تم تفعيل باقتك (${trackLabelAr}) في ${targetFacility?.nameAr || currentPersona.fullNameAr}. كود اشتراكك لهذه الباقة هو ${subscriptionCode}.`,
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
    const hasUnmaskedPin = Boolean(targetLedger.pinCode && targetLedger.pinCode !== "****");
    if (
      method === "pin_4digit" &&
      !(hasUnmaskedPin && cleanInput === targetLedger.pinCode.toUpperCase()) &&
      cleanInput !== subCode.toUpperCase() &&
      cleanInput !== targetLedger.ledgerCode.toUpperCase()
    ) {
      return {
        ok: false,
        messageAr: `كود الاشتراك أو الـ PIN غير صحيح! يرجى التحقق من كود الاشتراك الحالي (${subCode}) أو مسح رمز QR الخاص بالسباح.`,
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
    coachNoteAr?: string,
    coachId?: string
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

    // Strict scoping: never fall back to other facilities or coaches when a scope is supplied
    const searchPool = sessionLedgers.filter((l) => {
      if (facilityId && l.facilityId !== facilityId) return false;
      if (coachId && l.coachId !== coachId) return false;
      return true;
    });

    const exactMatch =
      searchPool.find(
        (l) =>
          (l.subscriptionCode || "").toUpperCase() === cleaned ||
          l.ledgerCode.toUpperCase() === cleaned
      ) ||
      searchPool.find(
        (l) => l.pinCode && l.pinCode !== "****" && l.pinCode === cleaned && l.status !== "completed"
      );

    if (!exactMatch) {
      return {
        ok: false,
        messageAr: `لم يتم العثور على اشتراك بالكود «${raw}». تأكد من مسح أو كتابة كود الاشتراك (CAP-SUB-...) الظاهر بجانب اسم المشترك.`,
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

    // Mark old ledger code as expired/completed and persist to backend
    const closedOldLedger: SessionLedger = {
      ...oldLedger,
      status: "completed",
      isCodeExpired: true,
    };
    setSessionLedgers((prev) =>
      prev.map((l) => (l.id === ledgerId ? closedOldLedger : l))
    );
    if (!effectiveOffline) {
      postSupabaseSync("/api/supabase/session-ledgers", { ledger: closedOldLedger });
    }

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
              uploadedDateAr: "بانتظار مراجعة وتأكيد الحسابات",
              confirmedByProvider: false,
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

  const confirmReceiptByProvider = (ledgerId: string, receiptId: string) => {
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
        if (!effectiveOffline) {
          postSupabaseSync("/api/supabase/session-ledgers", { ledger: updated });
        }
        return updated;
      })
    );
    pushNotification({
      titleAr: "تم تأكيد مطابقة الإيصال المالي",
      messageAr: "اعتمد فريق الحسابات إيصال الدفع بنجاح وتحديث سجل المدفوعات.",
      type: "school_card",
      actionHref: "/dashboard/ledger",
    });
    return {
      ok: true,
      messageAr: "تم تأكيد مطابقة الإيصال المالي وتحديث سجل الحسابات ✓",
    };
  };

  const getSkillEvaluationForAthlete = (athleteId?: string): SkillEvaluation5Point => {
    const targetId = athleteId || currentPersona.id;
    if (skillEvaluationsByAthlete[targetId]) {
      return skillEvaluationsByAthlete[targetId];
    }
    if (targetId === currentPersona.id && skillEvaluation.athleteId === currentPersona.id) {
      return skillEvaluation;
    }
    return {
      athleteId: targetId || "unrated",
      evaluatedDateAr: "",
      coachNameAr: "",
      coachFeedbackAr: "",
      metrics: INITIAL_SKILL_EVALUATION.metrics.map((m) => ({ ...m, score: 0 })),
    };
  };

  const addNewPBRecord = (record: Omit<PersonalBestRecord, "id" | "recordedDateAr">) => {
    const newRec: PersonalBestRecord = {
      ...record,
      id: `pb-${Date.now()}`,
      recordedDateAr: "اليوم — مسجل بالحساب",
    };
    setPbRecords((prev) => [newRec, ...prev]);
    const ownerCode = getProfileSyncKey(currentPersona);
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "pb",
        memberCode: ownerCode,
        pbRecord: newRec,
      });
    }
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

    const regMember = memberRegistry.find((m) => m.athleteId === targetAthleteId);
    const personaTarget = allPersonas.find((p) => p.id === targetAthleteId);
    const ledgerTarget = sessionLedgers.find((l) => l.athleteId === targetAthleteId);
    const recipientMemberCode =
      regMember?.memberCode ||
      personaTarget?.memberCode ||
      ledgerTarget?.memberCode ||
      getProfileSyncKey(currentPersona);

    if (recipientMemberCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "pb",
        memberCode: recipientMemberCode,
        pbRecord: newRec,
      });
    }

    if (payload.skills) {
      const scopedSkills: SkillEvaluation5Point = {
        ...payload.skills,
        athleteId: targetAthleteId,
      };
      setSkillEvaluationsByAthlete((prev) => ({
        ...prev,
        [targetAthleteId]: scopedSkills,
      }));
      if (targetAthleteId === currentPersona.id) {
        setSkillEvaluation(scopedSkills);
      }
      if (recipientMemberCode) {
        postSupabaseSync("/api/supabase/user-state", {
          type: "skill_eval",
          memberCode: recipientMemberCode,
          skillEvaluation: scopedSkills,
        });
      }
    }

    pushNotification({
      targetMemberCode: recipientMemberCode || undefined,
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
    const ownerCode = getProfileSyncKey(currentPersona);
    const parentMemberCode = currentPersona.memberCode || ownerCode || "";
    const existingCodes = new Set(
      minorAthletes.map((m) => (m.childMemberCode || "").toUpperCase()).filter(Boolean)
    );
    let seq = minorAthletes.length + 1;
    let childSubCode = generateChildSubCode(parentMemberCode, seq);
    while (existingCodes.has(childSubCode.toUpperCase()) && seq < 99) {
      seq += 1;
      childSubCode = generateChildSubCode(parentMemberCode, seq);
    }

    const newChild: MinorAthleteProfile = {
      id: `athlete-${Date.now()}`,
      childMemberCode: childSubCode,
      parentMemberCode: parentMemberCode || undefined,
      fullNameAr: child.fullNameAr,
      age: child.age,
      birthYear: 2026 - child.age,
      gender: child.gender,
      primarySport: "swimming",
      currentStarLevel: 0,
      starTitleAr: "",
      isPrivateByDefault: true,
      parentConsentVerified: true,
      activeCoachNameAr: "",
      activeFacilityNameAr: "",
    };
    setMinorAthletes((prev) => [...prev, newChild]);
    setMemberRegistry((prev) => [
      {
        memberCode: childSubCode,
        childMemberCode: childSubCode,
        parentMemberCode: parentMemberCode || undefined,
        athleteId: newChild.id,
        fullNameAr: child.fullNameAr,
        phone: currentPersona.phone,
        city: currentPersona.city,
        role: "adult_athlete",
        isMinor: true,
        parentNameAr: currentPersona.fullNameAr,
        hasParentSupervision: true,
      },
      ...prev.filter((m) => m.memberCode !== childSubCode),
    ]);
    setCurrentPersona((prev) => ({
      ...prev,
      hasParentSupervision: true,
      accountIntent:
        prev.accountIntent === "self_athlete" || prev.accountIntent === "both_self_and_parent"
          ? "both_self_and_parent"
          : prev.accountIntent || "parent_only",
    }));
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "minor_upsert",
        memberCode: ownerCode,
        minorAthlete: newChild,
      });
    }
  };

  const updateMinorAthlete = (
    childId: string,
    patch: Partial<Pick<MinorAthleteProfile, "fullNameAr" | "age" | "gender" | "primarySport">>
  ) => {
    const ownerCode = getProfileSyncKey(currentPersona);
    setMinorAthletes((prev) =>
      prev.map((c) => {
        if (c.id !== childId) return c;
        const nextAge = patch.age !== undefined ? patch.age : c.age;
        const updated: MinorAthleteProfile = {
          ...c,
          ...patch,
          birthYear: 2026 - nextAge,
        };
        if (ownerCode) {
          postSupabaseSync("/api/supabase/user-state", {
            type: "minor_upsert",
            memberCode: ownerCode,
            minorAthlete: updated,
          });
        }
        return updated;
      })
    );
  };

  const removeMinorAthlete = (childId: string) => {
    setMinorAthletes((prev) => prev.filter((c) => c.id !== childId));
    const ownerCode = getProfileSyncKey(currentPersona);
    if (ownerCode) {
      postSupabaseSync("/api/supabase/user-state", {
        type: "minor_delete",
        memberCode: ownerCode,
        minorId: childId,
      });
    }
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

  const submitRoleClaimApplication: CaptenlyContextType["submitRoleClaimApplication"] = async (
    payload
  ) => {
    if (!isAuthenticated || currentPersona.role === "guest" || currentPersona.id === "persona-guest") {
      return {
        ok: false,
        messageAr: "يجب تسجيل الدخول أولاً بحساب كابتنلي لتقديم طلب التوثيق.",
      };
    }

    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    const cleanFb = (payload.facebookUrl || payload.socialLinks?.facebook || "").trim();
    const cleanIg = (payload.instagramUrl || payload.socialLinks?.instagram || "").trim();
    const cleanPhone = (payload.phone || currentPersona.phone || "").replace(/\D/g, "");

    if (!cleanWa && !cleanFb && !cleanIg && !cleanPhone) {
      return {
        ok: false,
        messageAr: "يرجى إدخال وسيلة تواصل واحدة على الأقل (رقم موبايل أو واتساب أو رابط حساب تواصل).",
      };
    }

    if (payload.claimType === "coach") {
      const bio = payload.bioAr || "";
      const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => bio.includes(kw));
      if (detected) {
        return {
          ok: false,
          detectedKeyword: detected,
          messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
        };
      }
    }

    const targetFacility =
      facilities.find((f) => f.id === payload.targetFacilityId) ||
      facilities.find((f) => f.id === payload.affiliatedFacilityId);

    const formattedWa = cleanWa
      ? cleanWa.startsWith("20")
        ? cleanWa
        : cleanWa.startsWith("0")
        ? `2${cleanWa}`
        : `20${cleanWa}`
      : undefined;

    const proposedPayload: Record<string, unknown> = {
      fullNameAr: payload.fullNameAr || currentPersona.fullNameAr,
      titleAr: payload.titleAr || "",
      sportSector: "swimming",
      governorate:
        payload.governorate || targetFacility?.governorate || currentPersona.city || "كل مصر",
      city: payload.city || targetFacility?.city || currentPersona.city || "كل مصر",
      district: payload.district || targetFacility?.district || "",
      yearsExperience: payload.yearsExperience ?? 0,
      bioAr: payload.bioAr || "",
      avatarUrl: payload.avatarUrl || currentPersona.avatarUrl || "",
      whatsappNumber: formattedWa,
      facebookUrl: cleanFb || undefined,
      instagramUrl: cleanIg || undefined,
      socialLinks: {
        ...(payload.socialLinks || {}),
        ...(cleanFb ? { facebook: cleanFb } : {}),
        ...(cleanIg ? { instagram: cleanIg } : {}),
      },
      instapayHandle: payload.instapayHandle,
      privatePackage8Egp: payload.privatePackage8Egp,
      privatePackage12Egp: payload.privatePackage12Egp,
      specialtiesAr: payload.specialtiesAr,
      syndicateCardRef: payload.syndicateCardRef,
      edlfCertRef: payload.edlfCertRef,
      affiliatedFacilityId: payload.affiliatedFacilityId || targetFacility?.id,
      managerName: payload.managerName || currentPersona.fullNameAr,
      roleTitleAr: payload.roleTitleAr,
      phone: payload.phone || currentPersona.phone,
      commercialRegRef: payload.commercialRegRef,
      updatedBasePriceEgp: payload.updatedBasePriceEgp,
    };

    try {
      const res = await fetch("/api/supabase/role-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimType: payload.claimType,
          applicantNameAr:
            payload.claimType === "facility"
              ? payload.managerName || payload.fullNameAr || currentPersona.fullNameAr
              : payload.fullNameAr || currentPersona.fullNameAr,
          applicantPhone: payload.phone || currentPersona.phone || "",
          applicantEmail: currentPersona.email || "",
          targetFacilityId: payload.targetFacilityId || targetFacility?.id || undefined,
          targetFacilityNameAr: targetFacility?.nameAr,
          cityAr: payload.city || targetFacility?.city || currentPersona.city || "كل مصر",
          governorateAr: payload.governorate || targetFacility?.governorate || "مصر",
          proofDocumentUrl: payload.proofDocumentUrl,
          proofNotesAr: payload.proofNotesAr,
          proposedPayload,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.claim) {
        return {
          ok: false,
          messageAr:
            data?.messageAr ||
            "تعذّر إرسال طلب التوثيق حالياً. تأكد من تسجيل الدخول وصحة البيانات ثم أعد المحاولة.",
        };
      }
      const savedClaim = data.claim as MemberRoleClaim;
      setRoleClaims((prev) => [savedClaim, ...prev.filter((c) => c.id !== savedClaim.id)]);
      pushNotification({
        titleAr:
          payload.claimType === "facility"
            ? `تم استلام طلب توثيق منشأة ${targetFacility?.nameAr || ""}`.trim()
            : "تم استلام طلب التوثيق ككابتن للمراجعة",
        messageAr:
          "يراجع فريق كابتنلي مستنداتك الآن. سيبقى حسابك الحالي مفعلاً بالكامل حتى صدور قرار الاعتماد.",
        type: "passport_badge",
        actionLabelAr: "متابعة حالة الطلب",
        actionHref: "/claim",
      });
      return {
        ok: true,
        claim: savedClaim,
        messageAr:
          data.messageAr ||
          "تم استلام طلب التوثيق بنجاح وهو الآن قيد المراجعة الإدارية — سيبقى حسابك الحالي فعالاً حتى الاعتماد.",
      };
    } catch {
      return {
        ok: false,
        messageAr: "تعذّر الاتصال بالخادم لإرسال طلب التوثيق. حاول مرة أخرى.",
      };
    }
  };

  const reviewRoleClaim: CaptenlyContextType["reviewRoleClaim"] = async (
    claimId,
    decision,
    reviewerNoteAr
  ) => {
    try {
      const res = await fetch("/api/supabase/role-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId, action: decision, reviewerNoteAr }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.claim) {
        return {
          ok: false,
          messageAr: data?.messageAr || "تعذّر تنفيذ قرار المراجعة الإدارية للطلب.",
        };
      }
      const updatedClaim = data.claim as MemberRoleClaim;
      setRoleClaims((prev) =>
        prev.map((c) => (c.id === updatedClaim.id ? updatedClaim : c))
      );

      if (decision === "approve") {
        // Refresh approved public facilities/coaches immediately
        fetch("/api/supabase/public-supply", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((supply) => {
            if (!supply) return;
            if (Array.isArray(supply.facilities)) setFacilities(supply.facilities);
            if (Array.isArray(supply.coaches)) setCoaches(supply.coaches);
          })
          .catch(() => undefined);

        if (
          currentPersona.memberCode &&
          updatedClaim.applicantMemberCode.toUpperCase() ===
            currentPersona.memberCode.toUpperCase()
        ) {
          const nextRole: PersonaAccount["role"] =
            updatedClaim.claimType === "facility" ? "facility_manager" : "coach";
          setCurrentPersona((prev) => {
            const nextPersona: PersonaAccount = {
              ...prev,
              role: nextRole,
              linkedCoachId:
                typeof data.approvedCoachId === "string"
                  ? data.approvedCoachId
                  : prev.linkedCoachId,
              linkedFacilityId:
                typeof data.approvedFacilityId === "string"
                  ? data.approvedFacilityId
                  : prev.linkedFacilityId,
            };
            setAllPersonas((list) =>
              list.map((p) => (p.id === nextPersona.id ? nextPersona : p))
            );
            return nextPersona;
          });
        }
      }

      return {
        ok: true,
        claim: updatedClaim,
        messageAr:
          decision === "approve"
            ? "تم اعتماد الطلب وتفعيل الصلاحيات الرسمية في المنصة بنجاح."
            : decision === "withdraw"
            ? "تم سحب طلب التوثيق بنجاح."
            : "تم رفض الطلب وتسجيل ملاحظة المراجعة للمتقدم.",
      };
    } catch {
      return {
        ok: false,
        messageAr: "تعذّر الاتصال بالخادم لتحديث حالة الطلب.",
      };
    }
  };

  // تقديم طلب توثيق كابتن (لا يمنح ترقية فورية — يدخل طابور المراجعة الإدارية)
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

    void submitRoleClaimApplication({
      claimType: "coach",
      affiliatedFacilityId: payload.facilityId,
      targetFacilityId: payload.facilityId,
      fullNameAr: payload.fullNameAr,
      titleAr: payload.titleAr,
      phone: payload.phone,
      city: payload.city,
      governorate: payload.governorate,
      district: payload.district,
      sportSector: "swimming",
      yearsExperience: payload.yearsExperience,
      bioAr: payload.bioAr,
      avatarUrl: payload.avatarUrl,
      whatsappNumber: payload.whatsappNumber,
      facebookUrl: payload.facebookUrl,
      instagramUrl: payload.instagramUrl,
      socialLinks: payload.socialLinks,
      instapayHandle: payload.instapayHandle,
      privatePackage8Egp: payload.privatePackage8Egp,
      privatePackage12Egp: payload.privatePackage12Egp,
      specialtiesAr: payload.specialtiesAr,
      syndicateCardRef: payload.syndicateCardRef,
      edlfCertRef: payload.edlfCertRef,
      proofNotesAr: `قيد نقابي/شهادة: ${payload.syndicateCardRef}${payload.edlfCertRef ? ` | إنقاذ: ${payload.edlfCertRef}` : ""}`,
    });

    return {
      ok: true,
      messageAr:
        "تم استلام طلب التوثيق ككابتن للمراجعة الإدارية بنجاح — سيبقى حسابك الحالي فعالاً حتى اعتماد الطلب من إدارة كابتنلي.",
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
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      affiliations: c.affiliations.map((aff) =>
        aff.facilityId === facilityId ? { ...aff, status: "gracefully_disaffiliated" } : aff
      ),
    }));
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      affiliatedCoachIds: f.affiliatedCoachIds.filter((id) => id !== coachId),
    }));
  };

  const requestMutualAffiliation = (
    coachId: string,
    facilityId: string,
    scheduleAr: string,
    roleAr: string
  ) => {
    const targetFacility = facilities.find((f) => f.id === facilityId);
    if (!targetFacility) return;
    updateCoachAndSync(coachId, (c) => ({
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
    }));
  };

  const approveAffiliationMutual = (coachId: string, facilityId: string) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      affiliations: c.affiliations.map((a) =>
        a.facilityId === facilityId ? { ...a, status: "active_mutual" } : a
      ),
    }));
    updateFacilityAndSync(facilityId, (f) =>
      f.affiliatedCoachIds.includes(coachId)
        ? f
        : { ...f, affiliatedCoachIds: [...f.affiliatedCoachIds, coachId] }
    );
  };

  const reviewEntityBadge = (
    kind: "coach" | "facility",
    entityId: string,
    badgeCode: VerificationBadge["code"],
    nextStatus: "active" | "expired"
  ) => {
    const todayLabel = "اليوم — اعتماد إدارة كابتنلي";
    if (kind === "coach") {
      updateCoachAndSync(entityId, (c) => ({
        ...c,
        badges: c.badges.map((b) =>
          b.code === badgeCode
            ? {
                ...b,
                status: nextStatus,
                verifiedDate: nextStatus === "active" ? todayLabel : b.verifiedDate,
              }
            : b
        ),
      }));
      return;
    }
    updateFacilityAndSync(entityId, (f) => ({
      ...f,
      badges: f.badges.map((b) =>
        b.code === badgeCode
          ? {
              ...b,
              status: nextStatus,
              verifiedDate: nextStatus === "active" ? todayLabel : b.verifiedDate,
            }
          : b
      ),
    }));
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

  const syncFacilityProgramsPricing = (
    f: Facility,
    nextPrograms: FacilitySchoolProgram[]
  ): Facility => {
    const nonProgPackages = (f.pricePackages || []).filter(
      (p) => !p.id.startsWith("pkg_prog_")
    );
    const syncedPackages = [
      ...nextPrograms.map(schoolProgramToPricePackage),
      ...nonProgPackages,
    ];
    return {
      ...f,
      schoolPrograms: nextPrograms,
      pricePackages: syncedPackages,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — محدث من الإدارة",
    };
  };

  const addFacilitySchoolProgram = (
    facilityId: string,
    program: Omit<FacilitySchoolProgram, "id">
  ) => {
    const newProgram: FacilitySchoolProgram = {
      ...program,
      id: `prog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(f, [newProgram, ...(f.schoolPrograms || [])])
    );
    return { ok: true, messageAr: `تم نشر بطاقة «${program.titleAr}» بنجاح!` };
  };

  const updateFacilitySchoolProgram = (
    facilityId: string,
    programId: string,
    patch: Partial<Omit<FacilitySchoolProgram, "id">>
  ) => {
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(
        f,
        (f.schoolPrograms || []).map((p) => (p.id === programId ? { ...p, ...patch } : p))
      )
    );
    return { ok: true, messageAr: "تم تحديث تفاصيل البطاقة بنجاح." };
  };

  const removeFacilitySchoolProgram = (facilityId: string, programId: string) => {
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(
        f,
        (f.schoolPrograms || []).filter((p) => p.id !== programId)
      )
    );
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

  // تقديم طلب مطالبة وتوثيق منشأة (لا يمنح ترقية فورية — يدخل طابور المراجعة الإدارية)
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

    // Prevent unauthorized re-claiming of already verified facilities
    if (existing.supplyStatus === "verified_active") {
      return {
        ok: false,
        messageAr: "هذه المنشأة موثقة ومُدارة بالفعل من قِبل مالكها أو مديرها المعتمد.",
      };
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

    void submitRoleClaimApplication({
      claimType: "facility",
      targetFacilityId: facilityId,
      fullNameAr: payload.managerName,
      managerName: payload.managerName,
      roleTitleAr: payload.roleTitleAr,
      phone: payload.phone,
      city: existing.city,
      governorate: existing.governorate,
      whatsappNumber: payload.whatsappNumber,
      facebookUrl: payload.facebookUrl,
      instagramUrl: payload.instagramUrl,
      instapayHandle: payload.instapayHandle,
      updatedBasePriceEgp: payload.updatedBasePriceEgp,
      commercialRegRef: payload.commercialRegRef,
      proofNotesAr: `طلب مطالبة منشأة: ${existing.nameAr}${payload.commercialRegRef ? ` | مرجع: ${payload.commercialRegRef}` : ""}`,
    });

    return {
      ok: true,
      messageAr: `تم استلام طلب توثيق وإدارة «${existing.nameAr}» للمراجعة الإدارية بنجاح — سيبقى حسابك الحالي فعالاً حتى اعتماد الطلب من إدارة كابتنلي.`,
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
    const matchedPreset = EGYPT_CITY_PRESETS.find(
      (p) => p.city === newFac.city || newFac.city.includes(p.city) || p.city.includes(newFac.city)
    );
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
      governorate: resolveGovernorateFromCity(newFac.city, matchedPreset?.governorate || "مصر"),
      city: newFac.city,
      district: newFac.district,
      addressAr: `${newFac.district}، ${newFac.city}`,
      coordinates: matchedPreset ? { lat: matchedPreset.lat, lng: matchedPreset.lng } : { lat: 30.0444, lng: 31.2357 },
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

  // --- موظفو المنشأة والصلاحيات + تبديل الحساب ---
  const lookupStaffCandidatesRemote: CaptenlyContextType["lookupStaffCandidatesRemote"] = async (
    query
  ) => {
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      const res = await fetch(`/api/supabase/staff-lookup?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.candidates) ? data.candidates : [];
    } catch {
      return [];
    }
  };

  const myStaffAssignments: FacilityStaffMember[] = facilities.flatMap((fac) =>
    (fac.staffMembers || []).filter((st) => {
      if (!isAuthenticated) return false;
      if (st.invitationStatus === "declined" || st.invitationStatus === "revoked") return false;
      if (st.linkedPersonaId && st.linkedPersonaId === currentPersona.id) return true;
      if (
        st.linkedMemberCode &&
        currentPersona.memberCode &&
        st.linkedMemberCode.trim().toUpperCase() === currentPersona.memberCode.trim().toUpperCase()
      ) {
        return true;
      }
      if (
        st.email &&
        currentPersona.email &&
        st.email.trim().toLowerCase() === currentPersona.email.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    })
  );

  const activeStaffAssignment: FacilityStaffMember | null =
    myStaffAssignments.find(
      (s) => s.id === activeStaffAssignmentId && s.invitationStatus !== "pending"
    ) || null;

  const switchToStaffMode = (staffAssignmentId: string | null) => {
    if (staffAssignmentId) {
      const target = myStaffAssignments.find((s) => s.id === staffAssignmentId);
      if (!target) return;
      if (target.invitationStatus === "pending") {
        pushNotification({
          titleAr: `دعوة عمل معلقة لدى ${target.facilityNameAr}`,
          messageAr: `يرجى قبول الدعوة الوظيفية كـ «${target.roleTitleAr}» أولاً لتفعيل لوحة المنشأة.`,
          type: "system",
          actionLabelAr: "إدارة الدعوات",
          actionHref: "/dashboard/athlete/settings",
        });
        return;
      }
      setActiveStaffAssignmentId(staffAssignmentId);
      setActiveWorkspaceContextState("staff");
      pushNotification({
        titleAr: `تبديل الحساب: ${target.roleTitleAr}`,
        messageAr: `أنت الآن تعمل بصلاحية «${target.roleTitleAr}» داخل ${target.facilityNameAr}.`,
        type: "passport_badge",
        actionLabelAr: "فتح لوحة المنشأة",
        actionHref: "/dashboard/facility",
      });
      return;
    }

    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(currentPersona));
  };

  const switchWorkspaceContext: CaptenlyContextType["switchWorkspaceContext"] = (
    mode,
    staffAssignmentId
  ) => {
    if (mode === "member") {
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState("member");
      return;
    }
    if (mode === "coach") {
      if (currentPersona.linkedCoachId || currentPersona.role === "coach") {
        setActiveStaffAssignmentId(null);
        setActiveWorkspaceContextState("coach");
      }
      return;
    }
    if (mode === "facility") {
      if (currentPersona.linkedFacilityId || currentPersona.role === "facility_manager") {
        setActiveStaffAssignmentId(null);
        setActiveWorkspaceContextState("facility");
      }
      return;
    }
    if (mode === "staff") {
      const targetId =
        staffAssignmentId ||
        myStaffAssignments.find((s) => s.invitationStatus !== "pending")?.id ||
        null;
      if (targetId) {
        switchToStaffMode(targetId);
      }
    }
  };

  const respondToStaffInvitation: CaptenlyContextType["respondToStaffInvitation"] = (
    facilityId,
    staffId,
    decision
  ) => {
    const targetFac = facilities.find((f) => f.id === facilityId);
    const targetStaff = targetFac?.staffMembers?.find((s) => s.id === staffId);
    if (!targetFac || !targetStaff) return;

    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: (f.staffMembers || []).map((st) =>
        st.id === staffId
          ? {
              ...st,
              invitationStatus: decision,
              assignedDateAr:
                decision === "accepted" ? "اليوم — دعوة مقبولة ✓" : "تم رفض الدعوة",
            }
          : st
      ),
    }));

    if (decision === "declined" && activeStaffAssignmentId === staffId) {
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(currentPersona));
    }

    pushNotification({
      titleAr:
        decision === "accepted"
          ? `تم قبول الانضمام لطاقم ${targetFac.nameAr}`
          : `تم رفض دعوة ${targetFac.nameAr}`,
      messageAr:
        decision === "accepted"
          ? `يمكنك الآن التبديل إلى وضع موظف (${targetStaff.roleTitleAr}) في أي وقت.`
          : `تم تحديث حالة الدعوة الخاصة بـ ${targetFac.nameAr}.`,
      type: "system",
      actionLabelAr: decision === "accepted" ? "تبديل وضع العمل" : undefined,
      actionHref: decision === "accepted" ? "/dashboard/athlete/settings" : undefined,
    });
  };

  const addFacilityStaffMember = (
    facilityId: string,
    payload: {
      fullNameAr: string;
      role: FacilityStaffRole;
      roleTitleAr?: string;
      phone?: string;
      email?: string;
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
    const emailInput = (payload.email || "").trim().toLowerCase();
    const matchedPersona = allPersonas.find(
      (p) =>
        p.id !== "persona-guest" &&
        ((query &&
          ((p.memberCode && p.memberCode.toUpperCase() === query.toUpperCase()) ||
            (p.email && p.email.toLowerCase() === query.toLowerCase()))) ||
          (emailInput && p.email && p.email.toLowerCase() === emailInput) ||
          p.fullNameAr.trim() === cleanName)
    );
    const matchedRegistry = memberRegistry.find(
      (m) =>
        (query &&
          (m.memberCode.toUpperCase() === query.toUpperCase() ||
            (m.email && m.email.toLowerCase() === query.toLowerCase()))) ||
        (emailInput && m.email && m.email.toLowerCase() === emailInput) ||
        m.fullNameAr.trim() === cleanName
    );

    const hasAccount = Boolean(
      matchedPersona || matchedRegistry || query.toUpperCase().startsWith("CAP-")
    );
    const linkedMemberCode =
      matchedPersona?.memberCode ||
      matchedRegistry?.memberCode ||
      (query.toUpperCase().startsWith("CAP-") ? query.toUpperCase() : undefined);
    const resolvedEmail =
      emailInput ||
      matchedPersona?.email ||
      matchedRegistry?.email ||
      (query.includes("@") ? query.toLowerCase() : undefined);

    const newStaff: FacilityStaffMember = {
      id: `staff-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: fac.id,
      facilityNameAr: fac.nameAr,
      fullNameAr: matchedPersona?.fullNameAr || matchedRegistry?.fullNameAr || cleanName,
      role: payload.role,
      roleTitleAr: payload.roleTitleAr?.trim() || defaultRoleTitles[payload.role],
      phone: payload.phone?.trim() || matchedPersona?.phone || matchedRegistry?.phone,
      email: resolvedEmail,
      linkedMemberCode,
      linkedPersonaId: matchedPersona?.id,
      hasAccount,
      invitationStatus: hasAccount ? "pending" : "accepted",
      assignedDateAr: hasAccount ? "اليوم — دعوة بانتظار القبول" : "اليوم — سجل داخلي",
    };

    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: [newStaff, ...(f.staffMembers || [])],
    }));

    pushNotification({
      targetMemberCode: linkedMemberCode || undefined,
      titleAr: hasAccount
        ? `دعوة عمل جديدة لدى ${fac.nameAr}`
        : `تم تسجيل ${newStaff.fullNameAr} (${newStaff.roleTitleAr})`,
      messageAr: hasAccount
        ? `دعتك إدارة ${fac.nameAr} للانضمام بصلاحية «${newStaff.roleTitleAr}». يمكنك قبول الدعوة أو رفضها من الإعدادات أو القائمة العلوية.`
        : `تم تسجيل ${newStaff.fullNameAr} ضمن طاقم ${fac.nameAr} بدون اشتراط حساب شخصي.`,
      type: "passport_badge",
      actionLabelAr: hasAccount ? "قبول أو رفض الدعوة" : undefined,
      actionHref: hasAccount ? "/dashboard/athlete/settings" : undefined,
    });

    return {
      ok: true,
      staff: newStaff,
      messageAr: hasAccount
        ? `تم إرسال دعوة العمل لـ «${newStaff.fullNameAr}» بصلاحية (${newStaff.roleTitleAr}) بنجاح — تُفعّل فور قبوله الدعوة.`
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
      if (updatedArticle) {
        postSupabaseSync("/api/supabase/public-supply", { article: updatedArticle });
      }
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
    postSupabaseSync("/api/supabase/public-supply", { article: newArticle });

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
    postSupabaseSync("/api/supabase/public-supply", { deleteArticleId: articleId });
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAllPersonas(PERSONA_ACCOUNTS);
    setCurrentPersona(GUEST_PERSONA);
    setActiveWorkspaceContextState("member");
    setRoleClaims([]);
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
        activeWorkspaceContext,
        switchWorkspaceContext,
        roleClaims,
        refreshRoleClaims,
        submitRoleClaimApplication,
        reviewRoleClaim,
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
        registerMemberWithCredentials,
        loginOrCreateWithGoogle,
        restoreOrLoginWithGoogle,
        restoreProfileByLogin,
        completeGoogleOnboarding,
        signOutToGuest,
        deleteCurrentAccount,
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
        skillEvaluationsByAthlete,
        getSkillEvaluationForAthlete,
        sessionLedgers,
        verifiedLeads,
        demandRadar,
        offlineQueue,
        syncOfflineQueue,
        compareFacilityIds,
        toggleCompareFacility,
        clearComparison,
        createStructuredWhatsappLead,
        enrollSwimmerByMemberCode,
        checkInSession,
        checkInBySubscriptionCode,
        renewSwimmerSubscription,
        uploadInstaPayReceipt,
        confirmReceiptByProvider,
        lookupRemoteLedgersOrProfile,
        syncLedgersFromServer,
        addNewPBRecord,
        recordCoachSkillAndPB,
        addMinorAthlete,
        updateMinorAthlete,
        removeMinorAthlete,
        lookupStaffCandidatesRemote,
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
        respondToStaffInvitation,
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
        reviewEntityBadge,
        claimFacilityAndVerify,
        seedNewFacilityConcierge,
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
