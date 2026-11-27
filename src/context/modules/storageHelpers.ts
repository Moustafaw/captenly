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

export type SyncFailureCategory =
  | "ok"
  | "offline"
  | "auth"
  | "forbidden"
  | "validation"
  | "conflict"
  | "server"
  | "network";

export interface SyncResult {
  ok: boolean;
  status: number;
  category: SyncFailureCategory;
  data?: Record<string, unknown>;
  errorCode?: string;
  messageAr?: string;
}

function classifyHttpStatus(status: number): SyncFailureCategory {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 422) return "validation";
  if (status === 409) return "conflict";
  if (status >= 500) return "server";
  return status >= 200 && status < 300 ? "ok" : "validation";
}

function defaultArabicErrorForCategory(category: SyncFailureCategory): string {
  switch (category) {
    case "offline":
      return "الجهاز غير متصل بالإنترنت — تم الاحتفاظ بالعملية للمزامنة لاحقاً.";
    case "auth":
      return "انتهت جلسة تسجيل الدخول أو غير مصرح — يرجى إعادة تسجيل الدخول لإكمال المزامنة.";
    case "forbidden":
      return "لا تملك صلاحية تنفيذ هذه العملية على السيرفر.";
    case "validation":
      return "بيانات الطلب غير مكتملة أو غير صالحة.";
    case "conflict":
      return "تعارض مع بيانات السيرفر أو تسجيل مكرر خلال نافذة الحماية.";
    case "server":
      return "تعذر حفظ البيانات على السيرفر حالياً — يرجى المحاولة مرة أخرى.";
    case "network":
      return "تعذر الاتصال بالسيرفر — تحقق من اتصال الإنترنت.";
    default:
      return "";
  }
}

/**
 * Transactional cloud sync helper with HTTP status classification, timeout abort,
 * and explicit failure reporting (never swallows HTTP or network errors silently).
 */
export async function syncToSupabase(
  path: string,
  body: Record<string, unknown>,
  options?: { method?: "POST" | "PATCH"; timeoutMs?: number }
): Promise<SyncResult> {
  if (typeof window === "undefined") {
    return {
      ok: false,
      status: 0,
      category: "offline",
      errorCode: "ssr_unavailable",
      messageAr: defaultArabicErrorForCategory("offline"),
    };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      status: 0,
      category: "offline",
      errorCode: "browser_offline",
      messageAr: defaultArabicErrorForCategory("offline"),
    };
  }

  const method = options?.method ?? "POST";
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data: Record<string, unknown> | undefined;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // Non-JSON response body
    }

    const serverErrorCode =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.reason === "string"
          ? data.reason
          : undefined;
    const serverMessageAr =
      typeof data?.messageAr === "string" && data.messageAr.trim()
        ? data.messageAr
        : undefined;

    if (!res.ok) {
      const category = classifyHttpStatus(res.status);
      return {
        ok: false,
        status: res.status,
        category,
        data,
        errorCode: serverErrorCode || `http_${res.status}`,
        messageAr: serverMessageAr || defaultArabicErrorForCategory(category),
      };
    }

    // Backend routes may return HTTP 200 with { persisted: false, reason } when DB persistence fails
    if (data?.persisted === false || data?.ok === false) {
      return {
        ok: false,
        status: res.status,
        category: "server",
        data,
        errorCode: serverErrorCode || "not_persisted",
        messageAr: serverMessageAr || defaultArabicErrorForCategory("server"),
      };
    }

    return {
      ok: true,
      status: res.status,
      category: "ok",
      data,
      messageAr: serverMessageAr,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      category: "network",
      errorCode: isAbort ? "timeout" : "network_error",
      messageAr: isAbort
        ? "انتهت مهلة الاتصال بالسيرفر — تم الإبقاء على العملية لإعادة المحاولة."
        : defaultArabicErrorForCategory("network"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transitional wrapper for legacy callers not yet migrated to `await syncToSupabase(...)`.
 * Logs failures visibly instead of swallowing rejections silently.
 */
export function postSupabaseSync(
  path: string,
  body: Record<string, unknown>,
  onResult?: (result: SyncResult) => void
): void {
  if (typeof window === "undefined") return;
  void syncToSupabase(path, body).then((result) => {
    if (!result.ok) {
      console.warn(
        `[CAPTENLY sync failure] ${path} -> ${result.category} (${result.status}) ${result.errorCode || ""}`
      );
    }
    onResult?.(result);
  });
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
