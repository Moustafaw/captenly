export type AccountRole =
  | "guest"
  | "parent"
  | "adult_athlete"
  | "coach"
  | "facility_manager"
  | "super_admin";

export type SportSector = "swimming" | "fitness" | "both";

export type BadgeCode =
  | "BADGE_01_IDENTITY"
  | "BADGE_02_FACILITY"
  | "BADGE_03_SPORTS_SCIENCE"
  | "BADGE_04_ESF_FEDERATION"
  | "BADGE_05_EDLF_LIFEGUARD"
  | "BADGE_06_MEDICAL_PT";

export interface VerificationBadge {
  code: BadgeCode;
  titleAr: string;
  authorityAr: string;
  verifiedDate: string;
  expiresDate?: string;
  status: "active" | "expiring_soon" | "expired" | "pending";
  documentRef?: string;
  descriptionAr: string;
}

export interface PricePackage {
  id: string;
  nameAr: string;
  sessionsCount: number;
  sessionsPerWeek: number;
  durationMinutes: number;
  baseMonthlyEgp: number;
  assessmentFeeEgp: number;
  membershipCardFeeEgp: number;
  mandatoryKitFeeEgp: number;
  companionFeeEgp: number;
}

export interface UserSocialLinks {
  facebook?: string;
  instagram?: string;
  x?: string;
  threads?: string;
}

export interface FacilitySchoolProgram {
  id: string;
  trackType: "buds" | "prep" | "team" | "school" | "ladies";
  trackLabelAr: string; // e.g. "البراعم" | "التجهيزي" | "الفريق"
  titleAr: string;
  ageRangeAr?: string;
  sessionsPerMonth?: number;
  sessionTimeAr?: string; // الساعة / توقيت الحصة (مثلاً: 5:00 م)
  durationMinutes?: number; // وقت / مدة الحصة بالدقائق
  priceEgp: number;
  scheduleAr: string;
  notesAr?: string;
}

export interface CoachSessionOffer {
  id: string;
  titleAr: string;
  sessionsCount: number;
  priceEgp: number;
  sessionTimeAr?: string;
  durationMinutes?: number;
  notesAr?: string;
}

export interface Facility {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  facilityType: "swimming_academy" | "club_pool" | "gym_fitness" | "multi_sport";
  sportSector: SportSector;
  governorate: string;
  city: string;
  district: string;
  addressAr: string;
  coordinates: { lat: number; lng: number };
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  googlePlaceId?: string;
  publicDescriptionAr?: string;
  isFeaturedTier?: boolean;
  instapayHandle: string;
  vodafoneCashNumber: string;
  supplyStatus: "verified_active" | "self_listed_pending" | "seeded_unclaimed";
  subscriptionTier: "free_founding" | "facility_pro" | "prepaid_leads";
  isSponsored: boolean;
  priceLastVerifiedDaysAgo: number; // 0..60 (Fresh), 61..119 (Warning), >=120 (Expired)
  priceLastVerifiedDate: string;
  avgReplyMinutes: number;
  completenessScore: number;
  rating: number;
  reviewsCount: number;
  heroImage: string;
  scheduleSummaryAr?: string;
  sourcePublicNoteAr?: string;
  verifiedClaimDateAr?: string;
  badges: VerificationBadge[];
  // Swimming specs
  poolSpecs?: {
    poolType: "أوليمبي 50م" | "نصف أوليمبي 25م" | "تعليمي 15م";
    depthRange: string;
    isHeatedWinter: boolean;
    isCoveredIndoor: boolean;
    maxSwimmersPerLane: number;
    hasLadiesOnlySlots: boolean;
    hasEdlfLifeguard: boolean;
  };
  // Gym specs
  gymSpecs?: {
    areaSqm: number;
    isAirConditioned: boolean;
    hasLadiesOnlySlots: boolean;
    ladiesScheduleAr: string;
    hasFemaleTrainers: boolean;
    equipmentHighlights: string[];
  };
  specialtiesAr: string[];
  pricePackages: PricePackage[];
  schoolPrograms?: FacilitySchoolProgram[];
  affiliatedCoachIds: string[];
  // Monthly Value Proof (MVP-11/12)
  monthlyMetrics: {
    profileViews: number;
    comparisonAppearances: number;
    verifiedWhatsappLeads: number;
    activeSessionLedgers: number;
  };
}

export interface CoachAffiliation {
  facilityId: string;
  facilityNameAr: string;
  city: string;
  scheduleAr: string;
  roleAr: string;
  status: "active_mutual" | "pending" | "gracefully_disaffiliated";
}

export interface Coach {
  id: string;
  slug: string;
  SingleCoachId: string; // e.g. CAP-ID-9042
  fullNameAr: string;
  titleAr: string;
  sportSector: SportSector;
  governorate: string;
  city: string;
  district: string;
  yearsExperience: number;
  bioAr: string;
  avatarUrl: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  socialLinks?: UserSocialLinks;
  sessionOffers?: CoachSessionOffer[];
  instapayHandle: string;
  privatePackage8Egp: number;
  privatePackage12Egp: number;
  subscriptionTier: "free_founding" | "coach_pro";
  commissionRate: 0;
  qrCodeToken: string;
  priceLastVerifiedDaysAgo: number;
  priceLastVerifiedDate: string;
  rating: number;
  verifiedReviewsCount: number;
  activeAthletesCount: number;
  isVerifiedCoach?: boolean;
  badges: VerificationBadge[];
  specialties: {
    nameAr: string;
    credibilityTier: "official_credential" | "reviewed_qualification" | "self_declared";
  }[];
  affiliations: CoachAffiliation[];
}

export interface SessionCheckin {
  sessionNumber: number;
  dateAr: string;
  method: "pin_4digit" | "qr_scan" | "offline_sync";
  verifiedByAr: string;
  coachNoteAr?: string;
  wasOffline?: boolean;
}

export interface InstaPayReceipt {
  id: string;
  referenceNumber: string;
  channel: "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)";
  amountEgp: number;
  uploadedDateAr: string;
  confirmedByProvider: boolean;
  packageTitleAr: string;
}

export interface SessionLedger {
  id: string;
  ledgerCode: string;
  athleteId: string;
  athleteNameAr: string;
  isMinor: boolean;
  parentNameAr?: string;
  coachId: string;
  coachNameAr: string;
  facilityId: string;
  facilityNameAr: string;
  sportSector: "swimming" | "fitness";
  packageTitleAr: string;
  totalSessions: 8 | 12 | 24;
  completedSessions: number;
  pinCode: string;
  status: "active" | "renewal_due" | "completed";
  startedDateAr: string;
  checkins: SessionCheckin[];
  receipts: InstaPayReceipt[];
}

export interface PersonalBestRecord {
  id: string;
  athleteId: string;
  athleteNameAr: string;
  sportType: "swimming" | "fitness";
  eventTitleAr: string; // e.g., "50م حرة" or "Squat (سكوات)"
  currentValue: number;
  previousValue: number;
  unitAr: string; // "ثانية" or "كجم"
  recordedDateAr: string;
  verificationSource: "official_esf_result" | "document_verified" | "coach_reviewed" | "self_entered";
  verificationLabelAr: string;
  coachNameAr: string;
  facilityNameAr: string;
  starBadgeAr?: string;
}

export interface SkillEvaluation5Point {
  athleteId: string;
  evaluatedDateAr: string;
  coachNameAr: string;
  metrics: {
    labelAr: string;
    score: number; // 1..5
  }[];
  coachFeedbackAr: string;
}

export interface MinorAthleteProfile {
  id: string;
  fullNameAr: string;
  age: number;
  birthYear: number;
  gender: "male" | "female";
  primarySport: "swimming" | "fitness";
  currentStarLevel: number; // 1..5
  starTitleAr: string;
  isPrivateByDefault: boolean;
  parentConsentVerified: boolean;
  activeCoachNameAr: string;
  activeFacilityNameAr: string;
}

export interface VerifiedLeadItem {
  id: string;
  referralCode: string; // e.g., #CAP-8492
  targetType: "facility" | "coach";
  targetId: string;
  targetNameAr: string;
  inquirerNameAr: string;
  inquirerPhone: string;
  athleteAge: number;
  requestedSpecialtyAr: string;
  preferredScheduleAr: string;
  createdAtAr: string;
  repliedWithin2h: boolean;
  replyMinutes?: number;
  convertedToLedger: boolean;
}

export interface DemandRadarEntry {
  city: string;
  governorate: string;
  totalSearchesMonth: number; // Must be >= 30 to display percentages
  topUnmetFilters: {
    filterTitleAr: string;
    searchCount: number;
    percentage: number;
    opportunityNoteAr: string;
  }[];
}

export interface PersonaAccount {
  id: string;
  role: AccountRole;
  memberCode?: string;
  hasParentSupervision?: boolean;
  avatarUrl?: string;
  email?: string;
  authProvider?: "google" | "phone" | "demo";
  needsOnboarding?: boolean;
  shortLabelAr: string;
  fullNameAr: string;
  personaTitleAr: string;
  city: string;
  phone: string;
  linkedCoachId?: string;
  linkedFacilityId?: string;
  bioAr?: string;
  socialLinks?: UserSocialLinks;
  descriptionAr: string;
}

export interface UserLocation {
  city: string;
  governorate: string;
  lat: number;
  lng: number;
  isAutoDetected: boolean;
  distanceKm: number;
  isOutsideCoverage: boolean;
}

export interface NotificationItem {
  id: string;
  titleAr: string;
  messageAr: string;
  timeAr: string;
  type: "session_reminder" | "passport_badge" | "school_card" | "editorial" | "system";
  actionLabelAr?: string;
  actionHref?: string;
  isRead: boolean;
}

export interface EditorialArticle {
  id: string;
  slug: string;
  titleAr: string;
  excerptAr: string;
  categoryAr: string;
  readingMinutes: number;
  authorNameAr: string;
  authorRoleAr: string;
  publishedDateAr: string;
  imageUrl: string;
  contentMarkdownAr: string;
  recommendedFacilitySlugs: string[];
  recommendedCoachSlugs: string[];
}

export interface DemandRadarSubmission {
  id: string;
  fullNameAr: string;
  phone: string;
  city: string;
  governorate: string;
  targetSport: "swimming" | "fitness" | "other";
  notes?: string;
  createdAt: string;
}

export interface MemberRegistryEntry {
  memberCode: string;
  athleteId: string;
  fullNameAr: string;
  phone: string;
  city: string;
  role: "adult_athlete" | "parent";
  isMinor?: boolean;
  parentNameAr?: string;
}

export interface OfflineCheckinQueueItem {
  id: string;
  ledgerId: string;
  athleteNameAr: string;
  sessionNumber: number;
  method: "pin_4digit" | "qr_scan" | "offline_sync";
  coachNoteAr?: string;
  queuedAtIso: string;
  synced: boolean;
}

export interface SmartFiltersState {
  searchQuery: string;
  sportCategory: string;
  city: string;
  maxDistanceKm: number;
  maxPriceEgp: number;
  heatedOnly: boolean;
  ladiesOnly: boolean;
  freeTrialOnly: boolean;
  ozoneOnly: boolean;
  lifeguardOnly: boolean;
  warmChangingOnly: boolean;
  aedOnly: boolean;
  laneDensity: "all" | "1:1" | "2-4" | "5-6" | "7-10";
  sortBy: "rating" | "price_asc" | "nearest";
}
