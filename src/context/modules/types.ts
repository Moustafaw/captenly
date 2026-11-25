import type {
  AccountIntent,
  Coach,
  CoachSessionOffer,
  DemandRadarEntry,
  DemandRadarSubmission,
  EditorialArticle,
  Facility,
  FacilityCoachRosterEntry,
  FacilityLinkedEntity,
  FacilityPoolDeskConfig,
  FacilityPromoCode,
  FacilitySchoolProgram,
  FacilityStaffMember,
  FacilityStaffRole,
  LedgerPricingSnapshot,
  MemberRegistryEntry,
  MemberRoleClaim,
  MinorAthleteProfile,
  NotificationItem,
  OfflineCheckinQueueItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionCheckin,
  SessionLedger,
  SkillEvaluation5Point,
  SmartFiltersState,
  UserLocation,
  VerificationBadge,
  VerifiedLeadItem,
  WorkspaceContextMode,
} from "@/types/captenly";
import type {
  ClaimFacilityPayload,
  RegisterCoachPayload,
  RegisterFacilityPayload,
  RegisterMemberPayload,
  SaveEditorialArticlePayload,
  SubmitRoleClaimPayload,
  UpdatePersonaProfilePayload,
  UserSettingsState,
} from "./payloadTypes";

export type {
  AccountActivitySnapshot,
  CaptenlyProviderProps,
  ClaimFacilityPayload,
  InitialPublicSupply,
  RegisterCoachPayload,
  RegisterFacilityPayload,
  RegisterMemberPayload,
  RemoteProfilePayload,
  SaveEditorialArticlePayload,
  SubmitRoleClaimPayload,
  UpdatePersonaProfilePayload,
  UserSettingsState,
} from "./payloadTypes";

export interface CaptenlyContextType {
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
  updateCurrentPersonaAvatar: (
    avatarDataUrl: string
  ) => Promise<{ ok: boolean; persisted?: boolean; messageAr?: string }>;
  updateFacilityHeroImage: (
    facilityId: string,
    heroImageDataUrl: string
  ) => Promise<{ ok: boolean; persisted?: boolean; messageAr?: string }>;
  updateCurrentPersonaProfile: (
    patch: UpdatePersonaProfilePayload
  ) => { ok: boolean; detectedKeyword?: string; messageAr?: string };
  allPersonas: PersonaAccount[];
  isOfflineSimulated: boolean;
  isBrowserOffline: boolean;
  effectiveOffline: boolean;
  toggleOfflineSimulation: () => void;

  // Admin-Reviewed Role Claims (Coach / Facility Verification Queue)
  roleClaims: MemberRoleClaim[];
  refreshRoleClaims: (adminMode?: boolean) => Promise<void>;
  submitRoleClaimApplication: (payload: SubmitRoleClaimPayload) => Promise<{
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
  registerAndPublishFacility: (payload: RegisterFacilityPayload) => Promise<{
    ok: boolean;
    facility?: Facility;
    verificationClaimSubmitted?: boolean;
    messageAr: string;
  }>;

  // Member Codes Registry & Auth Registration
  memberRegistry: MemberRegistryEntry[];
  registerMemberUser: (
    payload: RegisterMemberPayload
  ) => { ok: boolean; persona: PersonaAccount; memberCode: string; nextPath?: string };
  registerMemberWithCredentials: (
    payload: RegisterMemberPayload & { password: string }
  ) => Promise<{
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
  saveEditorialArticle: (
    payload: SaveEditorialArticlePayload
  ) => { ok: boolean; article?: EditorialArticle; messageAr: string };
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
  userSettings: UserSettingsState;
  updateUserSettings: (newSettings: Partial<UserSettingsState>) => void;

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

  // Session Ledger, Enrollment & InstaPay Actions (MVP-09..10) + Pool Desk Operations
  facilityLinks: FacilityLinkedEntity[];
  refreshFacilityLinks: () => Promise<void>;
  updateFacilityPoolDeskConfig: (
    facilityId: string,
    patch: Partial<FacilityPoolDeskConfig>
  ) => { ok: boolean; messageAr: string };
  saveFacilityPromoCode: (
    facilityId: string,
    promo: Omit<FacilityPromoCode, "id" | "usedCount" | "createdAtIso"> & { id?: string }
  ) => { ok: boolean; messageAr: string };
  toggleFacilityPromoCode: (facilityId: string, promoId: string) => void;
  removeFacilityPromoCode: (facilityId: string, promoId: string) => void;
  addDirectFacilityLinkedEntity: (
    facilityId: string,
    payload: {
      displayNameAr: string;
      entityKind: "academy" | "coach";
      ownerNameAr?: string;
      phone?: string;
      agreementType: "per_swimmer_water" | "fixed_monthly";
      fixedMonthlyAmountEgp?: number;
      customWaterFeePerSessionEgp?: number;
      canScanGroupQr?: boolean;
      linkedMemberCode?: string;
      groupLabelAr?: string;
      swimmersCountEstimate?: number;
    }
  ) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;
  requestCoachHostClubLink: (payload: {
    facilityId: string;
    facilityNameAr: string;
    entityKind?: "academy" | "coach";
    displayNameAr?: string;
    agreementType?: "per_swimmer_water" | "fixed_monthly";
    fixedMonthlyAmountEgp?: number;
    groupLabelAr?: string;
    swimmersCountEstimate?: number;
  }) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;
  reviewFacilityLinkedEntity: (
    facilityId: string,
    linkId: string,
    patch: {
      status?: "approved" | "rejected" | "pending";
      agreementType?: "per_swimmer_water" | "fixed_monthly";
      fixedMonthlyAmountEgp?: number;
      customWaterFeePerSessionEgp?: number;
      canScanGroupQr?: boolean;
      collectedMonthlyEgp?: number;
    }
  ) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;

  enrollSwimmerByMemberCode: (payload: {
    memberCode: string;
    athleteNameAr?: string;
    facilityId: string;
    coachId?: string;
    linkedEntityId?: string;
    linkedEntityNameAr?: string;
    agreementTypeAtEnroll?: "per_swimmer_water" | "fixed_monthly";
    pricingSnapshot?: LedgerPricingSnapshot;
    promoCodeUsed?: string;
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
    coachNoteAr?: string,
    options?: {
      overrideDuplicate3h?: boolean;
      scanSource?: SessionCheckin["scanSource"];
    }
  ) => { ok: boolean; duplicateBlocked?: boolean; messageAr: string };

  checkInBySubscriptionCode: (
    codeInput: string,
    facilityId?: string,
    coachNoteAr?: string,
    coachId?: string,
    options?: {
      overrideDuplicate3h?: boolean;
      scanSource?: SessionCheckin["scanSource"];
      allowedLinkedEntityId?: string;
    }
  ) => {
    ok: boolean;
    expired?: boolean;
    duplicateBlocked?: boolean;
    ledger?: SessionLedger;
    messageAr: string;
  };

  renewSwimmerSubscription: (
    ledgerIdOrPayload:
      | string
      | {
          ledgerId: string;
          totalSessions?: 8 | 12 | 24;
          packageTitleAr?: string;
          amountEgp?: number;
          pricingSnapshot?: LedgerPricingSnapshot;
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
  registerAndVerifyCoach: (
    payload: RegisterCoachPayload
  ) => { ok: boolean; coach?: Coach; detectedKeyword?: string; messageAr: string };

  addCoachSessionOffer: (
    coachId: string,
    offer: Omit<CoachSessionOffer, "id">
  ) => { ok: boolean; messageAr: string };
  updateCoachSessionOffer: (
    coachId: string,
    offerId: string,
    patch: Partial<Omit<CoachSessionOffer, "id">>
  ) => { ok: boolean; messageAr: string };
  removeCoachSessionOffer: (coachId: string, offerId: string) => void;
  addFacilitySchoolProgram: (
    facilityId: string,
    program: Omit<FacilitySchoolProgram, "id">
  ) => { ok: boolean; messageAr: string };
  updateFacilitySchoolProgram: (
    facilityId: string,
    programId: string,
    patch: Partial<Omit<FacilitySchoolProgram, "id">>
  ) => { ok: boolean; messageAr: string };
  removeFacilitySchoolProgram: (facilityId: string, programId: string) => void;
  mergeExternalPlacesFacilities: (externalPlaces: Facility[]) => void;
  placesHydrating: boolean;
  publicSupplyHydrated: boolean;

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
    payload: ClaimFacilityPayload
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

  storageHydrated: boolean;
  resetDemoData: () => void;
}

export interface AuthDomainDeps {
  coaches: Coach[];
  setCoaches: React.Dispatch<React.SetStateAction<Coach[]>>;
  syncCoachToSupabase: (coach: Coach) => void;
  updateFacilityAndSync: (facilityId: string, updater: (f: Facility) => Facility) => void;
  setActiveStaffAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveWorkspaceContextState: React.Dispatch<React.SetStateAction<WorkspaceContextMode>>;
  setRoleClaims: React.Dispatch<React.SetStateAction<MemberRoleClaim[]>>;
  refreshRoleClaims: (adminMode?: boolean) => Promise<void>;
  applyAccountCityToUserLocation: (accountCity?: string, accountGov?: string) => void;
  setSavedFavoriteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCompareFacilityIds: React.Dispatch<React.SetStateAction<string[]>>;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation>>;
  savedFavoriteIds: string[];
  compareFacilityIds: string[];
  userLocation: UserLocation;
  minorAthletes: MinorAthleteProfile[];
  setMinorAthletes: React.Dispatch<React.SetStateAction<MinorAthleteProfile[]>>;
  pbRecords: PersonalBestRecord[];
  setPbRecords: React.Dispatch<React.SetStateAction<PersonalBestRecord[]>>;
  skillEvaluationsByAthlete: Record<string, SkillEvaluation5Point>;
  setSkillEvaluationsByAthlete: React.Dispatch<
    React.SetStateAction<Record<string, SkillEvaluation5Point>>
  >;
  setSkillEvaluation: React.Dispatch<React.SetStateAction<SkillEvaluation5Point>>;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setVerifiedLeads: React.Dispatch<React.SetStateAction<VerifiedLeadItem[]>>;
  userSettings: UserSettingsState;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettingsState>>;
  setSessionLedgers: React.Dispatch<React.SetStateAction<SessionLedger[]>>;
  persistPrefsToRemote: (
    prefs: {
      favorites?: string[];
      compareIds?: string[];
      userSettings?: Record<string, unknown>;
      userLocation?: Record<string, unknown>;
    },
    overrideMemberCode?: string
  ) => void;
  lookupRemoteLedgersOrProfile: CaptenlyContextType["lookupRemoteLedgersOrProfile"];
  isBrowserOffline: boolean;
}
