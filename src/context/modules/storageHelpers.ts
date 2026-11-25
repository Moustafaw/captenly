import type {
  AccountIntent,
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
import { GUEST_PERSONA, PERSONA_ACCOUNTS } from "@/data/seedData";
import type { AccountActivitySnapshot, UserSettingsState } from "./types";

export const STORAGE_KEY = "captenly_platform_state_v6";
export const LEGACY_STORAGE_KEY_V5 = "captenly_platform_state_v5";

export const LEGACY_FAKE_PERSONA_IDS = new Set([
  "persona-athlete-independent",
  "persona-parent",
  "persona-facility",
  "persona-coach",
]);

export const DEFAULT_SMART_FILTERS: SmartFiltersState = {
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

export const DEFAULT_USER_SETTINGS: UserSettingsState = {
  familyLaw151Consent: false,
  notifyWhatsappSessions: true,
  notifyWhatsappRenewals: true,
  notifyEmailMarketing: false,
  privacyProfilePublic: false,
};

export const DEFAULT_EGYPT_LOCATION: UserLocation = {
  city: "كل مصر",
  governorate: "نطاق مفتوح",
  lat: 30.0444,
  lng: 31.2357,
  isAutoDetected: false,
  isSpecified: false,
  distanceKm: 0,
  isOutsideCoverage: false,
};

export function getAccountSnapshotKeys(
  persona: Pick<PersonaAccount, "memberCode" | "email">
): string[] {
  const keys: string[] = [];
  if (persona.memberCode && persona.memberCode.trim()) {
    keys.push(`code:${persona.memberCode.trim().toUpperCase()}`);
  }
  if (persona.email && persona.email.trim()) {
    keys.push(`email:${persona.email.trim().toLowerCase()}`);
  }
  return keys;
}

export function findAccountSnapshot(
  snapshots: Record<string, AccountActivitySnapshot>,
  persona: Pick<PersonaAccount, "memberCode" | "email">
): AccountActivitySnapshot | undefined {
  for (const k of getAccountSnapshotKeys(persona)) {
    if (snapshots[k]) return snapshots[k];
  }
  return undefined;
}

export function generateDeterministicEmailMemberCode(email: string): string {
  const clean = email.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const num = 1000 + ((h >>> 0) % 9000);
  return `CAP-M-${num}`;
}

export function generateChildSubCode(parentCode?: string, index = 1): string {
  const digits =
    (parentCode || "").replace(/\D/g, "").slice(-4) ||
    String(Math.floor(1000 + Math.random() * 8999));
  const seq = String(Math.max(1, index)).padStart(2, "0");
  return `CAP-JR-${digits}-${seq}`;
}

export function getDefaultWorkspaceContextForPersona(
  persona: PersonaAccount
): WorkspaceContextMode {
  if (persona.linkedFacilityId || persona.role === "facility_manager") return "facility";
  if (persona.linkedCoachId || persona.role === "coach") return "coach";
  return "member";
}

export function getProfileSyncKey(persona: PersonaAccount): string {
  if (persona.role === "guest" || persona.id === "persona-guest") return "";
  if (persona.memberCode) return persona.memberCode;
  return `FAC-${persona.id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "USER"}`;
}

export function resolveMemberRoleAndIntent(
  role: "adult_athlete" | "parent" | "coach" | "facility_manager",
  hasParentSupervision: boolean,
  accountIntent?: AccountIntent
): { chosenRole: PersonaAccount["role"]; resolvedIntent: AccountIntent; nextPath: string } {
  const chosenRole: PersonaAccount["role"] =
    role === "coach"
      ? "coach"
      : role === "facility_manager"
        ? "facility_manager"
        : role === "parent" || hasParentSupervision
          ? "parent"
          : "adult_athlete";
  const resolvedIntent: AccountIntent =
    accountIntent ||
    (chosenRole === "parent" && hasParentSupervision
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
  return { chosenRole, resolvedIntent, nextPath };
}

export function buildRoleTitleMap(memberCode: string): Record<PersonaAccount["role"], string> {
  const codeLabel = memberCode || "CAP-M";
  return {
    guest: "زائر كابتنلي",
    adult_athlete: `سبّاح / متدرب وولي أمر — كود ${codeLabel}`,
    parent: `سبّاح وولي أمر — ${codeLabel}`,
    coach: `كابتن سباحة مسجل — ${codeLabel}`,
    facility_manager: memberCode
      ? `إدارة منشأة / أكاديمية — ${memberCode}`
      : "إدارة منشأة / أكاديمية",
    super_admin: "مشرف منصة كابتنلي",
  };
}

export function formatEgyptianWhatsapp(raw?: string): string | undefined {
  const cleanWa = (raw || "").replace(/\D/g, "");
  if (!cleanWa) return undefined;
  return cleanWa.startsWith("20") ? cleanWa : cleanWa.startsWith("0") ? `2${cleanWa}` : `20${cleanWa}`;
}

/** Fire-and-forget background sync to Supabase API routes (offline/optimistic UX preserved). */
export function postSupabaseSync(path: string, body: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export interface PersistedPayload {
  personaId: string;
  allPersonas: PersonaAccount[];
  memberRegistry: MemberRegistryEntry[];
  facilities: Facility[];
  coaches: Coach[];
  minorAthletes: MinorAthleteProfile[];
  pbRecords: PersonalBestRecord[];
  skillEvaluationsByAthlete: Record<string, SkillEvaluation5Point>;
  sessionLedgers: SessionLedger[];
  verifiedLeads: VerifiedLeadItem[];
  demandRadar: DemandRadarEntry[];
  demandSubmissions: DemandRadarSubmission[];
  offlineQueue: OfflineCheckinQueueItem[];
  facilityLinks: FacilityLinkedEntity[];
  savedFavoriteIds: string[];
  compareFacilityIds: string[];
  notifications: NotificationItem[];
  articles: EditorialArticle[];
  activeStaffAssignmentId: string | null;
  activeWorkspaceContext: WorkspaceContextMode;
  accountSnapshots: Record<string, AccountActivitySnapshot>;
  userSettings: UserSettingsState;
  newsletterEmails: string[];
  userLocation: UserLocation;
  smartFilters: SmartFiltersState;
}

export function readSnapshotPoolFallback(
  accountSnapshots: Record<string, AccountActivitySnapshot>
): Record<string, AccountActivitySnapshot> {
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
}

export function writePersistedStateToStorage(payload: PersistedPayload): void {
  const persistedFacilities = payload.facilities.filter(
    (f) => f && f.supplyStatus !== "seeded_unclaimed"
  );
  const buildPayload = (slim = false) =>
    JSON.stringify({
      ...payload,
      facilities: persistedFacilities,
      notifications: slim ? payload.notifications.slice(0, 15) : payload.notifications,
      articles: slim
        ? payload.articles.map((a) =>
            a.imageUrl && a.imageUrl.startsWith("data:") ? { ...a, imageUrl: "" } : a
          )
        : payload.articles,
      accountSnapshots: slim ? {} : payload.accountSnapshots,
    });

  try {
    localStorage.setItem(STORAGE_KEY, buildPayload(false));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, buildPayload(true));
    } catch {
      // Ignore storage errors if browser storage is completely disabled
    }
  }
}

export function readCleanPersonasFromSaved(rawAllPersonas: unknown): PersonaAccount[] {
  if (!Array.isArray(rawAllPersonas)) return PERSONA_ACCOUNTS;
  let cleaned = (rawAllPersonas as PersonaAccount[]).filter(
    (p) => p && !LEGACY_FAKE_PERSONA_IDS.has(p.id)
  );
  if (!cleaned.some((p) => p.role === "guest" || p.id === "persona-guest")) {
    cleaned = [GUEST_PERSONA, ...cleaned];
  }
  return cleaned.length ? cleaned : PERSONA_ACCOUNTS;
}
