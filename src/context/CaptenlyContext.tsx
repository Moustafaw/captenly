"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Coach,
  CoachSessionOffer,
  DemandRadarEntry,
  DemandRadarSubmission,
  EditorialArticle,
  Facility,
  FacilitySchoolProgram,
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
  sortBy: "rating",
};

interface CaptenlyContextType {
  // Active Persona / Auth State
  currentPersona: PersonaAccount;
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
  subscribeNewsletter: (email: string) => { ok: boolean; messageAr: string };

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

  uploadInstaPayReceipt: (
    ledgerId: string,
    payload: {
      referenceNumber: string;
      channel: "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)";
      amountEgp: number;
      packageTitleAr: string;
    }
  ) => void;

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
  removeCoachSessionOffer: (coachId: string, offerId: string) => void;
  addFacilitySchoolProgram: (facilityId: string, program: Omit<FacilitySchoolProgram, "id">) => { ok: boolean; messageAr: string };
  removeFacilitySchoolProgram: (facilityId: string, programId: string) => void;
  mergeExternalPlacesFacilities: (externalPlaces: Facility[]) => void;

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

const STORAGE_KEY = "captenly_platform_state_v4";
const LEGACY_STORAGE_KEY_V3 = "captenly_platform_state_v3";

export function CaptenlyProvider({ children }: { children: React.ReactNode }) {
  const [allPersonas, setAllPersonas] = useState<PersonaAccount[]>(PERSONA_ACCOUNTS);
  const [currentPersona, setCurrentPersona] = useState<PersonaAccount>(PERSONA_ACCOUNTS[0]);
  const [memberRegistry, setMemberRegistry] = useState<MemberRegistryEntry[]>(INITIAL_MEMBER_REGISTRY);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(false);

  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [coaches, setCoaches] = useState<Coach[]>(INITIAL_COACHES);
  const [minorAthletes, setMinorAthletes] = useState<MinorAthleteProfile[]>(INITIAL_MINOR_ATHLETES);
  const [pbRecords, setPbRecords] = useState<PersonalBestRecord[]>(INITIAL_PB_RECORDS);
  const [skillEvaluation, setSkillEvaluation] = useState<SkillEvaluation5Point>(INITIAL_SKILL_EVALUATION);
  const [sessionLedgers, setSessionLedgers] = useState<SessionLedger[]>(INITIAL_SESSION_LEDGERS);
  const [verifiedLeads, setVerifiedLeads] = useState<VerifiedLeadItem[]>(INITIAL_VERIFIED_LEADS);
  const [demandRadar, setDemandRadar] = useState<DemandRadarEntry[]>(INITIAL_DEMAND_RADAR);
  const [demandSubmissions, setDemandSubmissions] = useState<DemandRadarSubmission[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckinQueueItem[]>([]);
  const [compareFacilityIds, setCompareFacilityIds] = useState<string[]>([
    "fac-ghazl-mahalla",
    "fac-said-mahalla",
  ]);
  const [newsletterEmails, setNewsletterEmails] = useState<string[]>([]);

  // Location & Modals
  const [userLocation, setUserLocation] = useState<UserLocation>({
    city: "المحلة الكبرى",
    governorate: "الغربية",
    lat: 30.9706,
    lng: 31.1656,
    isAutoDetected: false,
    distanceKm: 1.2,
    isOutsideCoverage: false,
  });
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [smartFilters, setSmartFilters] = useState<SmartFiltersState>(DEFAULT_SMART_FILTERS);

  const [savedFavoriteIds, setSavedFavoriteIds] = useState<string[]>([
    "fac-said-mahalla",
    "art-winter-safety",
  ]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [articles] = useState<EditorialArticle[]>(INITIAL_ARTICLES);
  const [userSettings, setUserSettings] = useState({
    familyLaw151Consent: false,
    notifyWhatsappSessions: true,
    notifyWhatsappRenewals: true,
    notifyEmailMarketing: false,
    privacyProfilePublic: false,
  });

  const effectiveOffline = isOfflineSimulated || isBrowserOffline;

  // Hydrate persisted Offline-First state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.allPersonas) setAllPersonas(parsed.allPersonas);
        if (parsed.memberRegistry) setMemberRegistry(parsed.memberRegistry);
        if (parsed.facilities) setFacilities(parsed.facilities);
        if (parsed.coaches) setCoaches(parsed.coaches);
        if (parsed.minorAthletes) setMinorAthletes(parsed.minorAthletes);
        if (parsed.pbRecords) setPbRecords(parsed.pbRecords);
        if (parsed.sessionLedgers) setSessionLedgers(parsed.sessionLedgers);
        if (parsed.verifiedLeads) setVerifiedLeads(parsed.verifiedLeads);
        if (parsed.demandRadar) setDemandRadar(parsed.demandRadar);
        if (parsed.demandSubmissions) setDemandSubmissions(parsed.demandSubmissions);
        if (parsed.offlineQueue) setOfflineQueue(parsed.offlineQueue);
        if (parsed.savedFavoriteIds) setSavedFavoriteIds(parsed.savedFavoriteIds);
        if (parsed.compareFacilityIds) setCompareFacilityIds(parsed.compareFacilityIds);
        if (parsed.notifications) setNotifications(parsed.notifications);
        if (parsed.userSettings) setUserSettings(parsed.userSettings);
        if (parsed.newsletterEmails) setNewsletterEmails(parsed.newsletterEmails);
        if (parsed.userLocation) setUserLocation(parsed.userLocation);
        if (parsed.personaId) {
          const pool = parsed.allPersonas || PERSONA_ACCOUNTS;
          const found = pool.find((p: PersonaAccount) => p.id === parsed.personaId);
          if (found) setCurrentPersona(found);
        }
      } else {
        // Preserve custom avatar/location/favorites from v3 while updating seed data (5 ledgers, clean labels)
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V3);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed.userLocation) setUserLocation(parsed.userLocation);
          if (parsed.savedFavoriteIds) setSavedFavoriteIds(parsed.savedFavoriteIds);
          if (parsed.compareFacilityIds) setCompareFacilityIds(parsed.compareFacilityIds);
          if (parsed.allPersonas && Array.isArray(parsed.allPersonas)) {
            const avatarMap = new Map<string, string>();
            for (const lp of parsed.allPersonas as PersonaAccount[]) {
              if (lp?.id && lp?.avatarUrl) avatarMap.set(lp.id, lp.avatarUrl);
            }
            if (avatarMap.size > 0) {
              const merged = PERSONA_ACCOUNTS.map((p) =>
                avatarMap.has(p.id) ? { ...p, avatarUrl: avatarMap.get(p.id) } : p
              );
              setAllPersonas(merged);
              const targetId = parsed.personaId || merged[0].id;
              const found = merged.find((p) => p.id === targetId);
              if (found) setCurrentPersona(found);
            }
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

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

  const syncOfflineQueue = () => {
    const pendingCount = offlineQueue.filter((q) => !q.synced).length;
    if (pendingCount === 0) return 0;

    setOfflineQueue((prev) => prev.map((q) => ({ ...q, synced: true })));
    setSessionLedgers((prev) =>
      prev.map((l) => ({
        ...l,
        checkins: l.checkins.map((c) =>
          c.wasOffline && c.dateAr.includes("محفوظ أوفلاين")
            ? { ...c, dateAr: `${c.dateAr.replace("محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً", "تمت المزامنة سحابياً بنجاح ✓")}` }
            : c
        ),
      }))
    );

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

  const setUserCoordinates = ({
    lat,
    lng,
    city,
    governorate = "الغربية",
  }: {
    lat: number;
    lng: number;
    city: string;
    governorate?: string;
  }) => {
    const distanceKm = getNearestFacilityDistance(lat, lng);
    const isCovered = distanceKm <= 45;
    setUserLocation({
      city,
      governorate,
      lat,
      lng,
      isAutoDetected: false,
      distanceKm,
      isOutsideCoverage: !isCovered,
    });
  };

  const setUserCity = (city: string, gov = "الغربية") => {
    const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
    const lat = preset?.lat ?? (city === "طنطا" ? 30.7865 : city === "زفتى" ? 30.7124 : 30.9706);
    const lng = preset?.lng ?? (city === "طنطا" ? 31.0004 : city === "زفتى" ? 31.2423 : 31.1669);
    const isCovered = ["المحلة الكبرى", "طنطا", "سمنود", "زفتى", "كفر الزيات"].includes(city);
    const dist = preset ? getNearestFacilityDistance(lat, lng) : isCovered ? 1.2 : 95.0;

    setUserLocation({
      city,
      governorate: preset?.governorate || gov,
      lat,
      lng,
      isAutoDetected: false,
      distanceKm: dist,
      isOutsideCoverage: !isCovered,
    });
  };

  const requestAutoGeolocation = async () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat1 = pos.coords.latitude;
          const lon1 = pos.coords.longitude;
          const distanceKm = getNearestFacilityDistance(lat1, lon1);
          const isOutside = distanceKm > 45;

          setUserLocation({
            city: isOutside ? "موقعك الحالي" : "المحلة الكبرى (GPS)",
            governorate: isOutside ? "خارج نطاق الغربية حالياً" : "الغربية",
            lat: lat1,
            lng: lon1,
            isAutoDetected: true,
            distanceKm,
            isOutsideCoverage: isOutside,
          });
        },
        () => {
          setUserCity("المحلة الكبرى", "الغربية");
        }
      );
    }
  };

  const updateSmartFilters = (patch: Partial<SmartFiltersState>) => {
    setSmartFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetSmartFilters = () => setSmartFilters(DEFAULT_SMART_FILTERS);

  const toggleFavorite = (id: string) => {
    setSavedFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isFavorite = (id: string) => savedFavoriteIds.includes(id);

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

  const subscribeDemandRadar = (entry: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    targetSport: "swimming" | "fitness" | "other";
    notes?: string;
  }) => {
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
              filterTitleAr:
                entry.targetSport === "swimming"
                  ? "أكاديميات سباحة معتمدة"
                  : "مراكز لياقة وتدريب معتمدة",
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
    const prefix =
      payload.role === "coach" ? "CAP-C" : payload.role === "facility_manager" ? "CAP-F" : "CAP-M";
    const memberCode = `${prefix}-${random4}`;
    const newId = `user-${Date.now()}`;

    const newPersona: PersonaAccount = {
      id: newId,
      role: payload.role,
      memberCode,
      hasParentSupervision: payload.role === "parent" ? true : payload.hasParentSupervision,
      shortLabelAr: `${payload.fullNameAr.split(" ")[0]} (${memberCode})`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr:
        payload.role === "coach"
          ? "كابتن متقدم للتوثيق"
          : payload.role === "facility_manager"
          ? "مدير منشأة / أكاديمية"
          : payload.role === "parent" || payload.hasParentSupervision
          ? `حساب ولي أمر اختياري — ${memberCode}`
          : `رياضي مستقل — كود ${memberCode}`,
      city: payload.city,
      phone: payload.phone,
      descriptionAr: "حساب مفعّل بكود عضوية فريد جاهز للربط مع الكباتن والأكاديميات الموثقة.",
    };

    setAllPersonas((prev) => [newPersona, ...prev]);
    setCurrentPersona(newPersona);

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
      titleAr: `مرحباً بك في كابتنلي يا ${payload.fullNameAr.split(" ")[0]}!`,
      messageAr: `تم توليد كود عضويتك الفريد ${memberCode}. أعطِ هذا الكود للكابتن أو إدارة الأكاديمية لتفعيل باقتك ودفتر الحصص الـ QR.`,
      type: "school_card",
      actionLabelAr: "عرض كود العضوية",
      actionHref: "/dashboard/ledger",
    });

    postSupabaseSync("/api/supabase/sync-profile", {
      memberCode,
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
      postSupabaseSync("/api/supabase/sync-profile", {
        memberCode: updated.memberCode || "CAP-M-5190",
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
        memberCode: updated.memberCode || "CAP-M-5190",
      };
    }

    const memberCode = generateUniqueMemberCode("CAP-M");
    const safeSlug = cleanEmail.replace(/[^a-z0-9]/g, "-");
    const newId = `google-${safeSlug}`;
    const firstName = cleanName.split(" ")[0];

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
      city: userLocation.city,
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
      city: userLocation.city,
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
      city: userLocation.city,
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
    const cleanCity = (payload.city ?? currentPersona.city ?? userLocation.city).trim();
    const firstName = currentPersona.fullNameAr.split(" ")[0];

    const existingSuffix = (currentPersona.memberCode || "").split("-").pop();
    const validDigits = /^\d{4}$/.test(existingSuffix || "")
      ? existingSuffix
      : String(Math.floor(1000 + Math.random() * 8999));

    const prefix =
      payload.role === "coach" ? "CAP-C" : payload.role === "facility_manager" ? "CAP-F" : "CAP-M";
    const nextCode = `${prefix}-${validDigits}`;

    const roleTitleMap: Record<typeof payload.role, string> = {
      adult_athlete: `رياضي مستقل — كود ${nextCode}`,
      parent: `حساب ولي أمر عائلي — ${nextCode}`,
      coach: `كابتن مسجّل — ${nextCode}`,
      facility_manager: `إدارة منشأة / نادي — ${nextCode}`,
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
      shortLabelAr: `${firstName} (${nextCode})`,
      personaTitleAr: roleTitleMap[payload.role],
    };

    setCurrentPersona(updatedPersona);
    setAllPersonas((prev) =>
      prev.map((p) => (p.id === currentPersona.id ? updatedPersona : p))
    );

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
      memberCode: updatedPersona.memberCode || currentPersona.memberCode || "CAP-M-5190",
      email: updatedPersona.email,
      fullNameAr: updatedPersona.fullNameAr,
      role: updatedPersona.role,
      phone: updatedPersona.phone,
      city: updatedPersona.city,
      avatarUrl: updatedPersona.avatarUrl,
      authProvider: updatedPersona.authProvider || "google",
      hasParentSupervision: updatedPersona.hasParentSupervision,
      needsOnboarding: false,
    });

    return { ok: true, persona: updatedPersona };
  };

  const signOutToGuest = () => {
    const guest =
      allPersonas.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS.find((p) => p.role === "guest") ||
      PERSONA_ACCOUNTS[0];
    setCurrentPersona(guest);
  };

  const switchPersona = (personaId: string) => {
    const target = allPersonas.find((p) => p.id === personaId);
    if (target) setCurrentPersona(target);
  };

  const updateCurrentPersonaAvatar = (avatarDataUrl: string) => {
    setCurrentPersona((prev) => ({ ...prev, avatarUrl: avatarDataUrl }));
    setAllPersonas((prev) =>
      prev.map((p) => (p.id === currentPersona.id ? { ...p, avatarUrl: avatarDataUrl } : p))
    );
    if (currentPersona.linkedCoachId) {
      setCoaches((prev) =>
        prev.map((c) =>
          c.id === currentPersona.linkedCoachId ? { ...c, avatarUrl: avatarDataUrl } : c
        )
      );
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
          list.map((c) =>
            c.id === next.linkedCoachId
              ? {
                  ...c,
                  ...(patch.bioAr !== undefined ? { bioAr: patch.bioAr } : {}),
                  ...(patch.socialLinks !== undefined
                    ? {
                        socialLinks: { ...(c.socialLinks || {}), ...patch.socialLinks },
                        facebookUrl: patch.socialLinks.facebook ?? c.facebookUrl,
                        instagramUrl: patch.socialLinks.instagram ?? c.instagramUrl,
                      }
                    : {}),
                }
              : c
          )
        );
      }

      if (next.memberCode) {
        postSupabaseSync("/api/supabase/sync-profile", {
          memberCode: next.memberCode,
          fullNameAr: next.fullNameAr,
          role: next.role,
          phone: next.phone,
          city: next.city,
          bioAr: next.bioAr,
          socialLinks: next.socialLinks,
          hasParentSupervision: next.hasParentSupervision,
          needsOnboarding: false,
        });
      }
      return next;
    });
  };

  const toggleOfflineSimulation = () => {
    setIsOfflineSimulated((prev) => !prev);
  };

  const toggleCompareFacility = (facilityId: string) => {
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

  // تفعيل باقة ودفتر حصص للسباح باستخدام كود العضوية (CAP-M-XXXX)
  const enrollSwimmerByMemberCode = (payload: {
    memberCode: string;
    athleteNameAr?: string;
    facilityId: string;
    coachId?: string;
    packageTitleAr: string;
    totalSessions: 8 | 12 | 24;
    amountEgp: number;
    isMinor?: boolean;
    parentNameAr?: string;
  }) => {
    const normalizedCode = payload.memberCode.trim().toUpperCase();
    if (!normalizedCode.startsWith("CAP-")) {
      return {
        ok: false,
        messageAr: "كود العضوية يجب أن يبدأ بصيغة CAP-M-XXXX أو CAP-.",
      };
    }

    const regMatch = memberRegistry.find((m) => m.memberCode.toUpperCase() === normalizedCode);
    const personaMatch = allPersonas.find((p) => (p.memberCode || "").toUpperCase() === normalizedCode);
    const targetFacility = facilities.find((f) => f.id === payload.facilityId) || facilities[0];
    const targetCoach = coaches.find((c) => c.id === payload.coachId);

    const athleteId = regMatch?.athleteId || personaMatch?.id || `member-${normalizedCode}`;
    const athleteNameAr =
      payload.athleteNameAr?.trim() ||
      regMatch?.fullNameAr ||
      personaMatch?.fullNameAr ||
      `عضو (${normalizedCode})`;

    const numericDigits = normalizedCode.replace(/\D/g, "");
    const pinCode = numericDigits.length >= 4 ? numericDigits.slice(-4) : String(Math.floor(1000 + Math.random() * 8999));

    const newLedger: SessionLedger = {
      id: `ledger-${Date.now()}`,
      ledgerCode: `LED-2026-${Math.floor(200 + Math.random() * 799)}`,
      athleteId,
      athleteNameAr,
      isMinor: Boolean(payload.isMinor ?? regMatch?.isMinor),
      parentNameAr: payload.parentNameAr || regMatch?.parentNameAr,
      coachId: targetCoach?.id || targetFacility.id,
      coachNameAr: targetCoach?.fullNameAr || `إدارة ${targetFacility.nameAr}`,
      facilityId: targetFacility.id,
      facilityNameAr: targetFacility.nameAr,
      sportSector: targetFacility.sportSector === "fitness" ? "fitness" : "swimming",
      packageTitleAr: payload.packageTitleAr,
      totalSessions: payload.totalSessions,
      completedSessions: 0,
      pinCode,
      status: "active",
      startedDateAr: "اليوم — مفعّل أوفلاين & QR",
      checkins: [],
      receipts: [
        {
          id: `rcp-${Date.now()}`,
          referenceNumber: `REG-${numericDigits || "2026"}`,
          channel: "إنستاباي (InstaPay)",
          amountEgp: payload.amountEgp,
          uploadedDateAr: "مؤكد عند التسجيل",
          confirmedByProvider: true,
          packageTitleAr: payload.packageTitleAr,
        },
      ],
    };

    setSessionLedgers((prev) => [newLedger, ...prev]);

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

    if (!regMatch) {
      setMemberRegistry((prev) => [
        {
          memberCode: normalizedCode,
          athleteId,
          fullNameAr: athleteNameAr,
          phone: personaMatch?.phone || "",
          city: targetFacility.city,
          role: payload.isMinor ? "parent" : "adult_athlete",
          isMinor: payload.isMinor,
          parentNameAr: payload.parentNameAr,
        },
        ...prev,
      ]);
    }

    pushNotification({
      titleAr: `تم تفعيل باقة ${payload.totalSessions} حصص لـ ${athleteNameAr}`,
      messageAr: `الـ QR ودفتـر الحصص مفعّلان الآن لكود العضوية ${normalizedCode} في ${targetFacility.nameAr} (PIN الحضور: ${pinCode}).`,
      type: "session_reminder",
      actionLabelAr: "فتح دفتر الحصص والـ QR",
      actionHref: "/dashboard/ledger",
    });

    return {
      ok: true,
      ledger: newLedger,
      messageAr: `تم تسجيل ${athleteNameAr} وتفعيل باقة (${payload.totalSessions} حصص) بنجاح! كود QR والـ PIN (${pinCode}) يعملان الآن أوفلاين.`,
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
    if (targetLedger.completedSessions >= targetLedger.totalSessions) {
      return {
        ok: false,
        messageAr: "تم استنفاد جميع حصص الباقة بالفعل! يرجى تجديد الباقة.",
      };
    }
    if (method === "pin_4digit" && enteredPinOrQr.trim() !== targetLedger.pinCode) {
      return {
        ok: false,
        messageAr: `كود الـ PIN غير صحيح! كود هذا الدفتر هو: ${targetLedger.pinCode}`,
      };
    }

    const nextNum = targetLedger.completedSessions + 1;
    const remaining = targetLedger.totalSessions - nextNum;
    const isOff = effectiveOffline || method === "offline_sync";

    setSessionLedgers((prev) =>
      prev.map((l) => {
        if (l.id !== ledgerId) return l;
        return {
          ...l,
          completedSessions: nextNum,
          status:
            nextNum >= l.totalSessions
              ? "completed"
              : remaining <= 2
              ? "renewal_due"
              : "active",
          checkins: [
            ...l.checkins,
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
      })
    );

    if (isOff) {
      setOfflineQueue((prev) => [
        {
          id: `oq-${Date.now()}`,
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

    const renewalMsg =
      remaining <= 2
        ? ` تنبيه: متبقي ${remaining} حصة فقط في الباقة.`
        : "";

    return {
      ok: true,
      messageAr: `تم خصم وتوثيق الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) بنجاح ${
        isOff ? "في ذاكرة الأوفلاين (سيتم المزامنة تلقائياً عند توفر الشبكة)" : "مع ختم زمني فوري"
      }!${renewalMsg}`,
    };
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
        return {
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

    if (fac) {
      setFacilities((prev) =>
        prev.map((f) =>
          f.id === fac.id ? { ...f, affiliatedCoachIds: [...f.affiliatedCoachIds, coachId] } : f
        )
      );
    }

    const coachPersona: PersonaAccount = {
      id: `persona-${coachId}`,
      role: "coach",
      memberCode: `CAP-ID-${idNum}`,
      hasParentSupervision: false,
      avatarUrl: payload.avatarUrl || "/screens/3dff88737bec.jpg",
      shortLabelAr: `${payload.fullNameAr} (موثق ✓)`,
      fullNameAr: payload.fullNameAr,
      personaTitleAr: `كابتن موثق — كود ${newCoach.SingleCoachId}`,
      city: payload.city,
      phone: payload.phone,
      linkedCoachId: coachId,
      linkedFacilityId: fac?.id,
      descriptionAr: "حساب كابتن موثق بالشارات الخضراء ومفعّل لإدارة دفاتر الحصص وكروت المدارس.",
    };
    setAllPersonas((prev) => [coachPersona, ...prev]);
    setCurrentPersona(coachPersona);

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

    setCoaches((prev) => prev.map((c) => (c.id === coachId ? { ...c, bioAr: newBioAr } : c)));
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

  const addCoachSessionOffer = (coachId: string, offer: Omit<CoachSessionOffer, "id">) => {
    const newOffer: CoachSessionOffer = { ...offer, id: `offer-${Date.now()}` };
    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId ? { ...c, sessionOffers: [newOffer, ...(c.sessionOffers || [])] } : c
      )
    );
    return { ok: true, messageAr: `تم نشر عرض التدريب «${offer.titleAr}» بنجاح!` };
  };

  const removeCoachSessionOffer = (coachId: string, offerId: string) => {
    setCoaches((prev) =>
      prev.map((c) =>
        c.id === coachId
          ? { ...c, sessionOffers: (c.sessionOffers || []).filter((o) => o.id !== offerId) }
          : c
      )
    );
  };

  const addFacilitySchoolProgram = (
    facilityId: string,
    program: Omit<FacilitySchoolProgram, "id">
  ) => {
    const newProgram: FacilitySchoolProgram = { ...program, id: `prog-${Date.now()}` };
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId
          ? {
              ...f,
              schoolPrograms: [newProgram, ...(f.schoolPrograms || [])],
              priceLastVerifiedDaysAgo: 0,
              priceLastVerifiedDate: "اليوم — محدث من الإدارة",
            }
          : f
      )
    );
    return { ok: true, messageAr: `تم نشر برنامج «${program.titleAr}» في ملف المنشأة!` };
  };

  const removeFacilitySchoolProgram = (facilityId: string, programId: string) => {
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId
          ? {
              ...f,
              schoolPrograms: (f.schoolPrograms || []).filter((p) => p.id !== programId),
            }
          : f
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

    const mgrPersona: PersonaAccount = {
      id: `persona-mgr-${facilityId}`,
      role: "facility_manager",
      memberCode: `CAP-F-${Math.floor(1000 + Math.random() * 8999)}`,
      hasParentSupervision: false,
      shortLabelAr: `إدارة ${existing.nameAr.slice(0, 18)}`,
      fullNameAr: payload.managerName,
      personaTitleAr: `${payload.roleTitleAr} — ${existing.nameAr}`,
      city: existing.city,
      phone: payload.phone,
      linkedFacilityId: existing.id,
      descriptionAr: "حساب إدارة منشأة موثقة مع صلاحية تفعيل دفاتر الحصص للسباحين.",
    };
    setAllPersonas((prev) => [mgrPersona, ...prev]);
    setCurrentPersona(mgrPersona);

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

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAllPersonas(PERSONA_ACCOUNTS);
    setCurrentPersona(PERSONA_ACCOUNTS[0]);
    setMemberRegistry(INITIAL_MEMBER_REGISTRY);
    setFacilities(INITIAL_FACILITIES);
    setCoaches(INITIAL_COACHES);
    setMinorAthletes(INITIAL_MINOR_ATHLETES);
    setPbRecords(INITIAL_PB_RECORDS);
    setSessionLedgers(INITIAL_SESSION_LEDGERS);
    setVerifiedLeads(INITIAL_VERIFIED_LEADS);
    setDemandRadar(INITIAL_DEMAND_RADAR);
    setOfflineQueue([]);
    setCompareFacilityIds(["fac-ghazl-mahalla", "fac-said-mahalla"]);
    setNotifications(INITIAL_NOTIFICATIONS);
  };

  return (
    <CaptenlyContext.Provider
      value={{
        currentPersona,
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
        completeGoogleOnboarding,
        signOutToGuest,
        userLocation,
        setUserCity,
        setUserCoordinates,
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
        uploadInstaPayReceipt,
        addNewPBRecord,
        recordCoachSkillAndPB,
        addMinorAthlete,
        registerAndVerifyCoach,
        addCoachSessionOffer,
        removeCoachSessionOffer,
        addFacilitySchoolProgram,
        removeFacilitySchoolProgram,
        mergeExternalPlacesFacilities,
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
