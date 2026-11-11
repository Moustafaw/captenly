"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Coach,
  DemandRadarEntry,
  DemandRadarSubmission,
  EditorialArticle,
  Facility,
  MinorAthleteProfile,
  NotificationItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionLedger,
  SkillEvaluation5Point,
  UserLocation,
  VerifiedLeadItem,
} from "@/types/captenly";
import {
  INITIAL_ARTICLES,
  INITIAL_COACHES,
  INITIAL_DEMAND_RADAR,
  INITIAL_FACILITIES,
  INITIAL_MINOR_ATHLETES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PB_RECORDS,
  INITIAL_SESSION_LEDGERS,
  INITIAL_SKILL_EVALUATION,
  INITIAL_VERIFIED_LEADS,
  PERSONA_ACCOUNTS,
  PROHIBITED_MEDICAL_KEYWORDS,
} from "@/data/seedData";

interface CaptenlyContextType {
  // Active Persona / Auth State
  currentPersona: PersonaAccount;
  switchPersona: (personaId: string) => void;
  allPersonas: PersonaAccount[];
  isOfflineSimulated: boolean;
  toggleOfflineSimulation: () => void;

  // Location & Proximity (Dynamic Geolocation & Coverage Fallback)
  userLocation: UserLocation;
  setUserCity: (city: string, gov?: string) => void;
  requestAutoGeolocation: () => Promise<void>;
  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;

  // Filter Modal
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

  // Editorial Articles
  articles: EditorialArticle[];

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

  // Entities
  facilities: Facility[];
  coaches: Coach[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluation: SkillEvaluation5Point;
  sessionLedgers: SessionLedger[];
  verifiedLeads: VerifiedLeadItem[];
  demandRadar: DemandRadarEntry[];

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
    whatsappNumber: string;
    inquirerNameAr: string;
    inquirerPhone: string;
    athleteAge: number;
    requestedSpecialtyAr: string;
    preferredScheduleAr: string;
  }) => { referralCode: string; whatsappUrl: string; isDuplicate30d: boolean };

  // Session Ledger & InstaPay Actions (MVP-09..10)
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
  addMinorAthlete: (child: {
    fullNameAr: string;
    age: number;
    gender: "male" | "female";
    primarySport: "swimming" | "fitness";
  }) => void;

  // Coach Governance & Law 3/1985 Medical Filter (MVP-05..06)
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

  // Founder Admin Concierge & Claim Actions
  seedNewFacilityConcierge: (newFac: {
    nameAr: string;
    city: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    baseMonthlyPrice: number;
    whatsappNumber: string;
    isHeatedWinter: boolean;
    hasLadiesSlots: boolean;
  }) => Facility;
  claimFacilityListing: (facilityId: string, managerName: string, phone: string) => void;
  resetDemoData: () => void;
}

const CaptenlyContext = createContext<CaptenlyContextType | undefined>(undefined);

const STORAGE_KEY = "captenly_platform_state_v2";

export function CaptenlyProvider({ children }: { children: React.ReactNode }) {
  const [currentPersona, setCurrentPersona] = useState<PersonaAccount>(PERSONA_ACCOUNTS[1]); // Default to Madam Noha or easy switch
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);

  const [facilities, setFacilities] = useState<Facility[]>(INITIAL_FACILITIES);
  const [coaches, setCoaches] = useState<Coach[]>(INITIAL_COACHES);
  const [minorAthletes, setMinorAthletes] = useState<MinorAthleteProfile[]>(INITIAL_MINOR_ATHLETES);
  const [pbRecords, setPbRecords] = useState<PersonalBestRecord[]>(INITIAL_PB_RECORDS);
  const [skillEvaluation] = useState<SkillEvaluation5Point>(INITIAL_SKILL_EVALUATION);
  const [sessionLedgers, setSessionLedgers] = useState<SessionLedger[]>(INITIAL_SESSION_LEDGERS);
  const [verifiedLeads, setVerifiedLeads] = useState<VerifiedLeadItem[]>(INITIAL_VERIFIED_LEADS);
  const [demandRadar] = useState<DemandRadarEntry[]>(INITIAL_DEMAND_RADAR);
  const [compareFacilityIds, setCompareFacilityIds] = useState<string[]>([
    "fac-mahalla-dolphin",
    "fac-mahalla-ghazl",
  ]);

  // Location & Proximity state (PostGIS / GPS Simulation)
  const [userLocation, setUserLocation] = useState<UserLocation>({
    city: "المحلة الكبرى",
    governorate: "الغربية",
    lat: 30.9706,
    lng: 31.1656,
    isAutoDetected: false,
    distanceKm: 0.8,
    isOutsideCoverage: false,
  });

  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);

  // Favorites & Bookmarks
  const [savedFavoriteIds, setSavedFavoriteIds] = useState<string[]>([
    "fac-mahalla-dolphin",
    "coach-mahalla-shinnawi",
    "art-01-winter-pool-safety",
  ]);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Editorial Articles
  const [articles] = useState<EditorialArticle[]>(INITIAL_ARTICLES);

  // User Settings & Law 151
  const [userSettings, setUserSettings] = useState({
    familyLaw151Consent: true,
    notifyWhatsappSessions: true,
    notifyWhatsappRenewals: true,
    notifyEmailMarketing: false,
    privacyProfilePublic: false,
  });

  const setUserCity = (city: string, gov = "الغربية") => {
    const isOutside = !["المحلة الكبرى", "طنطا", "سمنود", "زفتى", "كفر الزيات", "المنصورة"].includes(city);
    let dist = 1.2;
    if (city === "طنطا") dist = 24.5;
    else if (city === "سمنود") dist = 6.2;
    else if (city === "زفتى") dist = 32.0;
    else if (city === "المنصورة") dist = 28.0;
    else if (city === "القاهرة") dist = 115.0;
    else if (city === "الإسكندرية") dist = 135.0;
    else if (isOutside) dist = 85.0;

    setUserLocation({
      city,
      governorate: gov,
      lat: isOutside ? 30.0444 : 30.9706,
      lng: isOutside ? 31.2357 : 31.1656,
      isAutoDetected: false,
      distanceKm: dist,
      isOutsideCoverage: isOutside,
    });
  };

  const requestAutoGeolocation = async () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat1 = pos.coords.latitude;
          const lon1 = pos.coords.longitude;
          const lat2 = 30.9706;
          const lon2 = 31.1656;
          const R = 6371; // km
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceKm = Math.round(R * c * 10) / 10;
          const isOutside = distanceKm > 35;

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
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const updateUserSettings = (newSettings: Partial<typeof userSettings>) => {
    setUserSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const subscribeDemandRadar = (entry: {
    fullNameAr: string;
    phone: string;
    city: string;
    governorate: string;
    targetSport: "swimming" | "fitness" | "other";
    notes?: string;
  }) => {
    return {
      ok: true,
      messageAr: `تم تسجيل طلبك لمدينة ${entry.city} بنجاح! سنرسل لك إشعاراً فور اكتمال 30 طلباً واعتماد منشأة في حيك.`,
    };
  };

  // Load persisted state from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.facilities) setFacilities(parsed.facilities);
        if (parsed.coaches) setCoaches(parsed.coaches);
        if (parsed.minorAthletes) setMinorAthletes(parsed.minorAthletes);
        if (parsed.pbRecords) setPbRecords(parsed.pbRecords);
        if (parsed.sessionLedgers) setSessionLedgers(parsed.sessionLedgers);
        if (parsed.verifiedLeads) setVerifiedLeads(parsed.verifiedLeads);
        if (parsed.personaId) {
          const found = PERSONA_ACCOUNTS.find((p) => p.id === parsed.personaId);
          if (found) setCurrentPersona(found);
        }
      }
    } catch {
      // Ignore storage errors in private mode
    }
  }, []);

  // Save state changes to localStorage (Offline-First persistence)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          personaId: currentPersona.id,
          facilities,
          coaches,
          minorAthletes,
          pbRecords,
          sessionLedgers,
          verifiedLeads,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [currentPersona, facilities, coaches, minorAthletes, pbRecords, sessionLedgers, verifiedLeads]);

  const switchPersona = (personaId: string) => {
    const target = PERSONA_ACCOUNTS.find((p) => p.id === personaId);
    if (target) setCurrentPersona(target);
  };

  const toggleOfflineSimulation = () => {
    setIsOfflineSimulated((prev) => !prev);
  };

  // Comparison logic (Max 4 facilities - MVP-04)
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

  // Price Freshness 60/120-day cycle (MVP-03)
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
          priceLastVerifiedDate: "الآن — نوفمبر 2026",
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

  // Structured WhatsApp Lead Generation + 30-day deduplication (MVP-11)
  const createStructuredWhatsappLead = (payload: {
    targetType: "facility" | "coach";
    targetId: string;
    targetNameAr: string;
    whatsappNumber: string;
    inquirerNameAr: string;
    inquirerPhone: string;
    athleteAge: number;
    requestedSpecialtyAr: string;
    preferredScheduleAr: string;
  }) => {
    const cleanPhone = payload.inquirerPhone.trim();
    const isDuplicate30d = verifiedLeads.some(
      (l) => l.targetId === payload.targetId && l.inquirerPhone === cleanPhone
    );
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `#CAP-${randomNum}`;

    const newLead: VerifiedLeadItem = {
      id: `lead-${Date.now()}`,
      referralCode,
      targetType: payload.targetType,
      targetId: payload.targetId,
      targetNameAr: payload.targetNameAr,
      inquirerNameAr: payload.inquirerNameAr || "ولي أمر عبر كابتنلي",
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
    }

    const messageText = `السلام عليكم، شفت صفحة (${payload.targetNameAr}) الموثقة على منصة كابتنلي (captenly.com) وقارنت الأسعار والمواعيد.\nحابب أستفسر عن الاشتراك في: [${payload.requestedSpecialtyAr}]\nلسن: [${payload.athleteAge} سنوات]\nالموعد المفضل: [${payload.preferredScheduleAr}]\nوهل متاح حجز حصة تقييم هذا الأسبوع؟\n(كود إحالة كابتنلي: ${referralCode})`;
    const whatsappUrl = `https://wa.me/${payload.whatsappNumber}?text=${encodeURIComponent(
      messageText
    )}`;

    return { referralCode, whatsappUrl, isDuplicate30d };
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
        messageAr: "تم استنفاد جميع حصص الباقة بالفعل! يرجى تجديد الباقة ورفع إيصال إنستاباي.",
      };
    }
    if (method === "pin_4digit" && enteredPinOrQr.trim() !== targetLedger.pinCode) {
      return {
        ok: false,
        messageAr: `كود الـ PIN غير صحيح! للتجربة السريعة استخدم كود هذا الدفتر: ${targetLedger.pinCode}`,
      };
    }

    const nextNum = targetLedger.completedSessions + 1;
    const remaining = targetLedger.totalSessions - nextNum;

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
              dateAr: isOfflineSimulated
                ? "الآن (محفوظ أوفلاين بجوار المسبح — سيتم المزامنة تلقائياً)"
                : "الآن — نوفمبر 2026",
              method: isOfflineSimulated ? "offline_sync" : method,
              verifiedByAr: `${currentPersona.shortLabelAr}`,
              coachNoteAr: coachNoteAr || "حضور مؤكد وتمرين ممتاز",
              wasOffline: isOfflineSimulated,
            },
          ],
        };
      })
    );

    const renewalMsg =
      remaining <= 2
        ? ` 🔔 تنبيه ذكي: متبقي ${remaining} حصة فقط في الباقة — تم تفعيل إشعار التجديد وأرشيف إنستاباي!`
        : "";

    return {
      ok: true,
      messageAr: `تم ختم الحصة رقم (${nextNum} من ${targetLedger.totalSessions}) بنجاح ${
        isOfflineSimulated ? "في وضع الأوفلاين (IndexedDB)" : "بختم زمني موثق"
      }!${renewalMsg}`,
    };
  };

  // Non-Custodial InstaPay Receipt Upload (MVP-10)
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
              uploadedDateAr: "الآن — مضغوط WebP (< 80KB)",
              confirmedByProvider: true,
              packageTitleAr: payload.packageTitleAr,
            },
            ...l.receipts,
          ],
        };
      })
    );
  };

  // Athletic Passport PB Record (MVP-07)
  const addNewPBRecord = (record: Omit<PersonalBestRecord, "id" | "recordedDateAr">) => {
    const newRec: PersonalBestRecord = {
      ...record,
      id: `pb-${Date.now()}`,
      recordedDateAr: "اليوم — نوفمبر 2026",
    };
    setPbRecords((prev) => [newRec, ...prev]);
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
      activeCoachNameAr: "كابتن أحمد حسن الشناوي",
      activeFacilityNameAr: "أكاديمية دولفين — المحلة الكبرى",
    };
    setMinorAthletes((prev) => [...prev, newChild]);
  };

  // Law 3/1985 Medical Filter & Coach Bio Validation
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
          messageAr: `⛔ حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): غير مسموح باستخدام مصطلح «${detected}» لغير الأطباء وأخصائيي العلاج الطبيعي الحاصلين على الشارة السادسة المرخصة من وزارة الصحة. يرجى استخدام مصطلحات الإعداد البدني الرياضي أو المرونة والحركة.`,
        };
      }
    }

    setCoaches((prev) =>
      prev.map((c) => (c.id === coachId ? { ...c, bioAr: newBioAr } : c))
    );
    return {
      ok: true,
      messageAr: "تم فحص النص وحفظ الملف المهني للكابتن بنجاح (متوافق 100% مع الضوابط القانونية).",
    };
  };

  // Coach-Facility 5 Governance Rules (Bidirectional & Graceful Disaffiliation)
  const gracefulDisaffiliateCoach = (coachId: string, facilityId: string) => {
    setCoaches((prev) =>
      prev.map((c) => {
        if (c.id !== coachId) return c;
        return {
          ...c,
          affiliations: c.affiliations.map((aff) =>
            aff.facilityId === facilityId
              ? { ...aff, status: "gracefully_disaffiliated" }
              : aff
          ),
        };
      })
    );
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId
          ? {
              ...f,
              affiliatedCoachIds: f.affiliatedCoachIds.filter((id) => id !== coachId),
            }
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
    const targetFac = facilities.find((f) => f.id === facilityId);
    if (!targetFac) return;
    setCoaches((prev) =>
      prev.map((c) => {
        if (c.id !== coachId) return c;
        const exists = c.affiliations.find((a) => a.facilityId === facilityId);
        if (exists) {
          return {
            ...c,
            affiliations: c.affiliations.map((a) =>
              a.facilityId === facilityId
                ? { ...a, status: "pending", scheduleAr, roleAr }
                : a
            ),
          };
        }
        return {
          ...c,
          affiliations: [
            ...c.affiliations,
            {
              facilityId: targetFac.id,
              facilityNameAr: targetFac.nameAr,
              city: targetFac.city,
              scheduleAr,
              roleAr,
              status: "pending",
            },
          ],
        };
      })
    );
  };

  const approveAffiliationMutual = (coachId: string, facilityId: string) => {
    setCoaches((prev) =>
      prev.map((c) => {
        if (c.id !== coachId) return c;
        return {
          ...c,
          affiliations: c.affiliations.map((a) =>
            a.facilityId === facilityId ? { ...a, status: "active_mutual" } : a
          ),
        };
      })
    );
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId && !f.affiliatedCoachIds.includes(coachId)
          ? { ...f, affiliatedCoachIds: [...f.affiliatedCoachIds, coachId] }
          : f
      )
    );
  };

  // Founder 12-Step Concierge Pre-building
  const seedNewFacilityConcierge = (newFac: {
    nameAr: string;
    city: string;
    district: string;
    sportSector: "swimming" | "fitness" | "both";
    baseMonthlyPrice: number;
    whatsappNumber: string;
    isHeatedWinter: boolean;
    hasLadiesSlots: boolean;
  }) => {
    const slug = `facility-${Date.now()}`;
    const created: Facility = {
      id: `fac-${Date.now()}`,
      slug,
      nameAr: newFac.nameAr,
      nameEn: newFac.nameAr,
      facilityType: newFac.sportSector === "fitness" ? "gym_fitness" : "swimming_academy",
      sportSector: newFac.sportSector,
      governorate: "الغربية",
      city: newFac.city,
      district: newFac.district,
      addressAr: `${newFac.city} — ${newFac.district}`,
      coordinates: { lat: 30.97, lng: 31.16 },
      whatsappNumber: newFac.whatsappNumber || "201000000000",
      instapayHandle: "academy@instapay",
      vodafoneCashNumber: newFac.whatsappNumber || "01000000000",
      supplyStatus: "seeded_unclaimed",
      subscriptionTier: "free_founding",
      isSponsored: false,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "الآن — بذر ميداني",
      avgReplyMinutes: 45,
      completenessScore: 90,
      rating: 4.8,
      reviewsCount: 12,
      heroImage: "seeded_facility",
      badges: [
        {
          code: "BADGE_02_FACILITY",
          titleAr: "صفحة مجهزة ميدانياً بكابتنلي",
          authorityAr: "فريق البذر الميداني — كابتنلي",
          verifiedDate: "نوفمبر 2026",
          status: "active",
          descriptionAr: "تم تجهيز الصفحة ضمن بروتوكول الـ 12 خطوة الميداني ومتاحة لاستلام الإدارة مجاناً.",
        },
      ],
      poolSpecs:
        newFac.sportSector !== "fitness"
          ? {
              poolType: "نصف أوليمبي 25م",
              depthRange: "1.1م إلى 1.9م",
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
          ? ["تدريب شخصي فردي (Personal Training - PT)", "لياقة بدنية عامة وتحسين الصحة والنشاط اليومي"]
          : ["تأسيس أطفال ومبتدئين (الطفو والتنفس الآمن)", "تجهيز اختبارات النجوم الرسمية (Stars Prep)"],
      pricePackages: [
        {
          id: `pkg-${Date.now()}`,
          nameAr: "الباقة الشهرية الأساسية (8 حصص)",
          sessionsCount: 8,
          sessionsPerWeek: 2,
          durationMinutes: 60,
          baseMonthlyEgp: newFac.baseMonthlyPrice,
          assessmentFeeEgp: 50,
          membershipCardFeeEgp: 50,
          mandatoryKitFeeEgp: 0,
          companionFeeEgp: 0,
        },
      ],
      affiliatedCoachIds: ["coach-ahmed-shenawy"],
      monthlyMetrics: {
        profileViews: 120,
        comparisonAppearances: 18,
        verifiedWhatsappLeads: 4,
        activeSessionLedgers: 2,
      },
    };

    setFacilities((prev) => [created, ...prev]);
    return created;
  };

  const claimFacilityListing = (facilityId: string, _managerName: string, phone: string) => {
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === facilityId
          ? {
              ...f,
              supplyStatus: "verified_active",
              whatsappNumber: phone.startsWith("2") ? phone : `2${phone}`,
            }
          : f
      )
    );
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setFacilities(INITIAL_FACILITIES);
    setCoaches(INITIAL_COACHES);
    setMinorAthletes(INITIAL_MINOR_ATHLETES);
    setPbRecords(INITIAL_PB_RECORDS);
    setSessionLedgers(INITIAL_SESSION_LEDGERS);
    setVerifiedLeads(INITIAL_VERIFIED_LEADS);
    setCompareFacilityIds(["fac-mahalla-dolphin", "fac-mahalla-ghazl"]);
  };

  return (
    <CaptenlyContext.Provider
      value={{
        currentPersona,
        switchPersona,
        allPersonas: PERSONA_ACCOUNTS,
        isOfflineSimulated,
        toggleOfflineSimulation,
        userLocation,
        setUserCity,
        requestAutoGeolocation,
        locationModalOpen,
        setLocationModalOpen,
        filterModalOpen,
        setFilterModalOpen,
        savedFavoriteIds,
        toggleFavorite,
        isFavorite,
        notifications,
        markNotificationAsRead,
        unreadNotificationsCount,
        articles,
        userSettings,
        updateUserSettings,
        subscribeDemandRadar,
        facilities,
        coaches,
        minorAthletes,
        pbRecords,
        skillEvaluation,
        sessionLedgers,
        verifiedLeads,
        demandRadar,
        compareFacilityIds,
        toggleCompareFacility,
        clearComparison,
        confirmFacilityPrices60d,
        simulateTimeTravelDays,
        createStructuredWhatsappLead,
        checkInSession,
        uploadInstaPayReceipt,
        addNewPBRecord,
        addMinorAthlete,
        validateAndSaveCoachBio,
        gracefulDisaffiliateCoach,
        requestMutualAffiliation,
        approveAffiliationMutual,
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
