import type React from "react";
import type {
  AccountIntent,
  Coach,
  EditorialArticle,
  Facility,
  FacilityLocation,
  MinorAthleteProfile,
  NotificationItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionLedger,
  SkillEvaluation5Point,
  UserLocation,
  UserSocialLinks,
} from "@/types/captenly";

export interface UserSettingsState {
  familyLaw151Consent: boolean;
  notifyWhatsappSessions: boolean;
  notifyWhatsappRenewals: boolean;
  notifyEmailMarketing: boolean;
  privacyProfilePublic: boolean;
}

export interface AccountActivitySnapshot {
  savedFavoriteIds: string[];
  compareFacilityIds: string[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluationsByAthlete: Record<string, SkillEvaluation5Point>;
  notifications: NotificationItem[];
  userSettings: UserSettingsState;
  userLocation?: UserLocation;
}

export interface InitialPublicSupply {
  facilities?: Facility[];
  coaches?: Coach[];
  articles?: EditorialArticle[];
}

export interface CaptenlyProviderProps {
  children: React.ReactNode;
  initialPublicSupply?: InitialPublicSupply;
}

export interface UpdatePersonaProfilePayload {
  fullNameAr?: string;
  phone?: string;
  city?: string;
  bioAr?: string;
  socialLinks?: UserSocialLinks;
  hasParentSupervision?: boolean;
  accountIntent?: AccountIntent;
}

export interface SubmitRoleClaimPayload {
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
}

export interface RegisterFacilityPayload {
  nameAr: string;
  publicDescriptionAr?: string;
  isAcademyInHostClubs: boolean;
  locations: FacilityLocation[];
  managerName: string;
  roleTitleAr: string;
  phone: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  instapayHandle?: string;
  heroImage?: string;
  updatedBasePriceEgp?: number;
  commercialRegRef?: string;
  proofDocumentUrl?: string;
  proofNotesAr?: string;
}

export interface RegisterMemberPayload {
  fullNameAr: string;
  phone: string;
  email?: string;
  city: string;
  governorate: string;
  sportPreference: "swimming" | "fitness" | "both";
  hasParentSupervision: boolean;
  role: "adult_athlete" | "parent" | "coach" | "facility_manager";
  accountIntent?: AccountIntent;
}

export interface SaveEditorialArticlePayload {
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
}

export interface RegisterCoachPayload {
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
}

export interface ClaimFacilityPayload {
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

export interface RemoteProfilePayload {
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
}
