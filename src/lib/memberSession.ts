import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { AccountRole, FacilityStaffRole } from "@/types/captenly";
import { getAuthInstance } from "@/auth";
import { getAuthSecret } from "@/lib/googleAuthConfig";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";

export const MEMBER_COOKIE_NAME = "captenly_member_session";
export const ADMIN_COOKIE_NAME = "captenly_admin_session";
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface MemberSessionPayload {
  memberCode: string;
  role: AccountRole;
  email?: string;
  phone?: string;
  linkedFacilityId?: string;
  linkedCoachId?: string;
  exp: number;
}

export interface ServerCallerContext {
  authenticated: boolean;
  isAdmin: boolean;
  memberCode?: string;
  role?: AccountRole;
  email?: string;
  phone?: string;
  linkedFacilityId?: string;
  linkedCoachId?: string;
}

const globalForSecrets = globalThis as unknown as {
  __captenlyEphemeralSecrets?: Record<string, string>;
};

function getEphemeralDevSecret(slot: string): string {
  if (!globalForSecrets.__captenlyEphemeralSecrets) {
    globalForSecrets.__captenlyEphemeralSecrets = {};
  }
  if (!globalForSecrets.__captenlyEphemeralSecrets[slot]) {
    globalForSecrets.__captenlyEphemeralSecrets[slot] = crypto.randomBytes(32).toString("hex");
  }
  return globalForSecrets.__captenlyEphemeralSecrets[slot];
}

function getMemberSigningSecret(): string | null {
  const configured = getAuthSecret() || (process.env.CAPTENLY_ADMIN_KEY || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return getEphemeralDevSecret("member_session");
}

function getAdminSigningSecret(): string | null {
  const configured = (process.env.AUTH_SECRET || process.env.CAPTENLY_ADMIN_KEY || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return getEphemeralDevSecret("admin_session");
}

function signValue(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function sanitizeFilterToken(raw: string): string {
  return raw
    .replace(/[,()*%'"\\;\r\n]/g, "")
    .trim()
    .slice(0, 120);
}

export function buildMemberSessionCookieValue(
  input: Omit<MemberSessionPayload, "exp">
): string {
  const secret = getMemberSigningSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET_MISSING_IN_PRODUCTION");
  }
  const payload: MemberSessionPayload = {
    memberCode: input.memberCode.trim().toUpperCase(),
    role: input.role,
    ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
    ...(input.phone ? { phone: input.phone.trim() } : {}),
    ...(input.linkedFacilityId ? { linkedFacilityId: input.linkedFacilityId.trim() } : {}),
    ...(input.linkedCoachId ? { linkedCoachId: input.linkedCoachId.trim() } : {}),
    exp: Date.now() + MEMBER_SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signValue(encoded, secret);
  return `${encoded}.${sig}`;
}

export function attachMemberSessionCookie(
  response: NextResponse,
  input: Omit<MemberSessionPayload, "exp">
): NextResponse {
  if (!input.memberCode.trim()) return response;
  const secret = getMemberSigningSecret();
  if (!secret) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "auth_secret_not_configured",
        messageAr: "مفتاح توقيع الجلسة غير مضبوط على الخادم.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    ) as unknown as NextResponse;
  }
  response.cookies.set(MEMBER_COOKIE_NAME, buildMemberSessionCookieValue(input), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(MEMBER_SESSION_TTL_MS / 1000),
  });
  return response;
}

export function clearMemberSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(MEMBER_COOKIE_NAME);
  return response;
}

function verifyMemberToken(token: string): MemberSessionPayload | null {
  const secret = getMemberSigningSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = signValue(encoded, secret);
  if (!constantTimeEquals(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as MemberSessionPayload;
    if (!parsed || typeof parsed.memberCode !== "string" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    if (parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function lookupProfileClaims(criteria: {
  email?: string;
  memberCode?: string;
}): Promise<{
  memberCode?: string;
  role?: AccountRole;
  email?: string;
  phone?: string;
  linkedFacilityId?: string;
  linkedCoachId?: string;
} | null> {
  const cleanEmail = criteria.email?.trim().toLowerCase();
  const cleanCode = criteria.memberCode?.trim().toUpperCase();
  if (!cleanEmail && !cleanCode) return null;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin
        .from("captenly_profiles")
        .select("member_code, role, email, phone, social_links")
        .limit(1);
      query = cleanEmail ? query.eq("email", cleanEmail) : query.eq("member_code", cleanCode!);
      const { data, error } = await query;
      const row = !error && Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
      if (row) {
        const socialLinks = (row.social_links || {}) as Record<string, unknown>;
        return {
          memberCode: typeof row.member_code === "string" ? row.member_code : undefined,
          role: row.role as AccountRole | undefined,
          email: typeof row.email === "string" ? row.email.toLowerCase() : undefined,
          phone: typeof row.phone === "string" ? row.phone : undefined,
          linkedFacilityId:
            typeof socialLinks._linkedFacilityId === "string"
              ? socialLinks._linkedFacilityId
              : typeof socialLinks.linkedFacilityId === "string"
                ? socialLinks.linkedFacilityId
                : undefined,
          linkedCoachId:
            typeof socialLinks._linkedCoachId === "string"
              ? socialLinks._linkedCoachId
              : typeof socialLinks.linkedCoachId === "string"
                ? socialLinks.linkedCoachId
                : undefined,
        };
      }
    } catch {
      // fall back to pg
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const sql = cleanEmail
      ? `select member_code, role, email, phone, social_links from public.captenly_profiles where lower(email) = lower($1) limit 1`
      : `select member_code, role, email, phone, social_links from public.captenly_profiles where upper(member_code) = upper($1) limit 1`;
    const { rows } = await client.query(sql, [cleanEmail || cleanCode]);
    return rows[0] as Record<string, unknown> | undefined;
  });

  if (pgRes.ok && pgRes.value) {
    const row = pgRes.value;
    const socialLinks = (row.social_links || {}) as Record<string, unknown>;
    return {
      memberCode: typeof row.member_code === "string" ? row.member_code : undefined,
      role: row.role as AccountRole | undefined,
      email: typeof row.email === "string" ? row.email.toLowerCase() : undefined,
      phone: typeof row.phone === "string" ? row.phone : undefined,
      linkedFacilityId:
        typeof socialLinks._linkedFacilityId === "string"
          ? socialLinks._linkedFacilityId
          : typeof socialLinks.linkedFacilityId === "string"
            ? socialLinks.linkedFacilityId
            : undefined,
      linkedCoachId:
        typeof socialLinks._linkedCoachId === "string"
          ? socialLinks._linkedCoachId
          : typeof socialLinks.linkedCoachId === "string"
            ? socialLinks.linkedCoachId
            : undefined,
    };
  }

  return null;
}

export async function isCallerAdmin(): Promise<boolean> {
  const expectedKey = (process.env.CAPTENLY_ADMIN_KEY || "").trim();
  const allowedEmails = (process.env.CAPTENLY_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length > 0) {
    try {
      const authInstance = getAuthInstance();
      const session = authInstance ? await authInstance.auth() : null;
      const email = session?.user?.email?.toLowerCase();
      if (email && allowedEmails.includes(email)) {
        return true;
      }
    } catch {
      // ignore NextAuth lookup failure
    }
  }

  if (expectedKey.length > 0) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
      const parts = token.split(".");
      if (parts.length === 2) {
        const [expStr, sig] = parts;
        const exp = Number(expStr);
        const adminSecret = getAdminSigningSecret();
        if (adminSecret && Number.isFinite(exp) && exp > Date.now()) {
          const expectedSig = signValue(`admin:${exp}`, adminSecret);
          if (constantTimeEquals(sig, expectedSig)) {
            return true;
          }
        }
      }
    } catch {
      // cookies() outside request scope
    }
  }

  return false;
}

export async function getServerCaller(): Promise<ServerCallerContext> {
  const isAdmin = await isCallerAdmin();

  let cookiePayload: MemberSessionPayload | null = null;
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(MEMBER_COOKIE_NAME)?.value || "";
    if (rawCookie) {
      cookiePayload = verifyMemberToken(rawCookie);
    }
  } catch {
    // ignore cookie errors outside request context
  }

  let googleEmail: string | undefined;
  try {
    const authInstance = getAuthInstance();
    const session = authInstance ? await authInstance.auth() : null;
    const rawEmail = session?.user?.email?.trim().toLowerCase();
    if (rawEmail) googleEmail = rawEmail;
  } catch {
    // ignore NextAuth errors
  }

  if (cookiePayload) {
    const dbClaims = await lookupProfileClaims({ memberCode: cookiePayload.memberCode });
    return {
      authenticated: true,
      isAdmin,
      memberCode: cookiePayload.memberCode,
      role: dbClaims?.role || cookiePayload.role,
      email: dbClaims?.email || cookiePayload.email || googleEmail,
      phone: dbClaims?.phone || cookiePayload.phone,
      linkedFacilityId: dbClaims?.linkedFacilityId || cookiePayload.linkedFacilityId,
      linkedCoachId: dbClaims?.linkedCoachId || cookiePayload.linkedCoachId,
    };
  }

  if (googleEmail) {
    const dbClaims = await lookupProfileClaims({ email: googleEmail });
    return {
      authenticated: true,
      isAdmin,
      memberCode: dbClaims?.memberCode,
      role: dbClaims?.role || "adult_athlete",
      email: googleEmail,
      phone: dbClaims?.phone,
      linkedFacilityId: dbClaims?.linkedFacilityId,
      linkedCoachId: dbClaims?.linkedCoachId,
    };
  }

  if (isAdmin) {
    return {
      authenticated: true,
      isAdmin: true,
      role: "super_admin",
    };
  }

  return { authenticated: false, isAdmin: false };
}

type StoredStaffEntry = {
  linkedMemberCode?: string;
  role?: FacilityStaffRole;
  isActive?: boolean;
  invitationStatus?: "pending" | "accepted" | "declined" | "revoked";
};

function isAcceptedStaffMatch(st: StoredStaffEntry, callerCode: string): boolean {
  if (!callerCode || st.isActive === false) return false;
  if (st.invitationStatus && st.invitationStatus !== "accepted") return false;
  return Boolean(st.linkedMemberCode && st.linkedMemberCode.trim().toUpperCase() === callerCode);
}

async function fetchFacilityStaffMembers(facilityId: string): Promise<StoredStaffEntry[]> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("captenly_facilities")
        .select("payload")
        .eq("id", facilityId)
        .limit(1);
      const row = Array.isArray(data)
        ? (data[0] as { payload?: { staffMembers?: StoredStaffEntry[] } } | undefined)
        : undefined;
      if (row?.payload && Array.isArray(row.payload.staffMembers)) {
        return row.payload.staffMembers;
      }
    } catch {
      // fall through
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select payload from public.captenly_facilities where id = $1 limit 1`,
      [facilityId]
    );
    return rows[0] as { payload?: { staffMembers?: StoredStaffEntry[] } } | undefined;
  });
  if (pgRes.ok && pgRes.value?.payload && Array.isArray(pgRes.value.payload.staffMembers)) {
    return pgRes.value.payload.staffMembers;
  }
  return [];
}

export async function getCallerFacilityAccessRole(
  facilityId: string,
  caller: ServerCallerContext
): Promise<FacilityStaffRole | "owner" | "admin" | null> {
  if (!caller.authenticated || !facilityId) return null;
  if (caller.isAdmin) return "admin";
  if (caller.linkedFacilityId && caller.linkedFacilityId === facilityId) return "owner";

  const callerCode = (caller.memberCode || "").trim().toUpperCase();
  if (!callerCode) return null;

  const staffMembers = await fetchFacilityStaffMembers(facilityId);
  const matched = staffMembers.find((st) => isAcceptedStaffMatch(st, callerCode));
  return matched?.role || (matched ? "general_staff" : null);
}

export async function hasFacilityStaffAccess(
  facilityId: string,
  caller: ServerCallerContext,
  allowedStaffRoles?: FacilityStaffRole[]
): Promise<boolean> {
  const accessRole = await getCallerFacilityAccessRole(facilityId, caller);
  if (!accessRole) return false;
  if (accessRole === "admin" || accessRole === "owner") return true;
  if (!allowedStaffRoles || allowedStaffRoles.length === 0) return true;
  return allowedStaffRoles.includes(accessRole);
}

export async function callerHasAnyStaffRole(
  caller: ServerCallerContext,
  allowedStaffRoles?: FacilityStaffRole[]
): Promise<boolean> {
  if (!caller.authenticated) return false;
  if (caller.isAdmin || caller.role === "coach" || caller.role === "facility_manager" || caller.linkedFacilityId) {
    return true;
  }

  const callerCode = (caller.memberCode || "").trim().toUpperCase();
  if (!callerCode) return false;

  const inspectFacilities = (rows: Array<{ payload?: unknown }>) =>
    rows.some((r) => {
      const p = (r.payload || {}) as { staffMembers?: StoredStaffEntry[] };
      const staff = Array.isArray(p.staffMembers) ? p.staffMembers : [];
      return staff.some((st) => {
        if (!isAcceptedStaffMatch(st, callerCode)) return false;
        if (!allowedStaffRoles || allowedStaffRoles.length === 0) return true;
        return Boolean(st.role && allowedStaffRoles.includes(st.role));
      });
    });

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data } = await admin.from("captenly_facilities").select("payload").limit(80);
      if (Array.isArray(data) && inspectFacilities(data)) return true;
    } catch {
      // fall through
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(`select payload from public.captenly_facilities limit 80`);
    return rows as Array<{ payload?: unknown }>;
  });
  return pgRes.ok && inspectFacilities(pgRes.value);
}
