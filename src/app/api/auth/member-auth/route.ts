import { NextResponse } from "next/server";
import crypto from "crypto";
import type { AccountRole, UserSocialLinks } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getAuthInstance } from "@/auth";
import { attachMemberSessionCookie, clearMemberSessionCookie, getServerCaller } from "@/lib/memberSession";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import { deleteCoachByMemberOrIdInDb, ensureSelfRegisteredCoachInDb } from "@/lib/server/coachDb";
import { enforceRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/server/rateLimit";
import {
  OWNER_EMAIL,
  purgeNonOwnerAccountsInDb,
} from "@/lib/server/accountPurge";

export const runtime = "nodejs";

function generateDeterministicMemberCode(email: string, attempt = 0): string {
  const clean = email.trim().toLowerCase();
  const seed = attempt === 0 ? clean : `${clean}#${attempt}`;
  const hash = crypto.createHash("sha256").update(seed).digest();
  const digits = 1000 + (hash.readUInt16BE(0) % 9000);
  return `CAP-M-${digits}`;
}

function normalizePhoneDigits(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plain: string, storedHash?: string | null): boolean {
  if (!storedHash || !plain) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hexKey] = parts;
  if (!salt || !hexKey) return false;
  try {
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(hexKey, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const globalForOtpSecret = globalThis as unknown as { __captenlyOtpDevSecret?: string };

function getOtpHmacSecret(): string | null {
  const configured = (process.env.AUTH_SECRET || process.env.CAPTENLY_OTP_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  if (!globalForOtpSecret.__captenlyOtpDevSecret) {
    globalForOtpSecret.__captenlyOtpDevSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalForOtpSecret.__captenlyOtpDevSecret;
}

function hashOtp(otp: string, targetKey: string): string | null {
  const secret = getOtpHmacSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`${targetKey}:${otp}`).digest("hex");
}

function stripInternalSocialKeys(raw?: Record<string, unknown> | null): UserSocialLinks {
  const clean: UserSocialLinks = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith("_") && typeof v === "string" && v.trim()) {
      (clean as Record<string, string>)[k] = v;
    }
  }
  return clean;
}

function sanitizeProfileRow(row: Record<string, unknown>) {
  const socialLinks = (row.social_links || {}) as Record<string, unknown>;
  const roleStr = String(row.role || "adult_athlete");
  const linkedFacilityId =
    typeof socialLinks._linkedFacilityId === "string" ? socialLinks._linkedFacilityId : undefined;
  const linkedCoachId =
    typeof socialLinks._linkedCoachId === "string"
      ? socialLinks._linkedCoachId
      : roleStr === "coach" && row.member_code
        ? getDeterministicCoachId(String(row.member_code))
        : undefined;

  return {
    id: String(row.id || `user-${row.member_code || "member"}`),
    memberCode: String(row.member_code || ""),
    email: typeof row.email === "string" ? row.email : undefined,
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    role: roleStr,
    phone: typeof row.phone === "string" ? row.phone : "",
    city: typeof row.city === "string" && row.city.trim() ? row.city : "كل مصر",
    governorate: typeof row.governorate === "string" ? row.governorate : "مصر",
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
    authProvider: (row.auth_provider === "google" ? "google" : "phone_otp") as "google" | "phone_otp",
    hasParentSupervision: Boolean(row.has_parent_supervision),
    needsOnboarding: Boolean(row.needs_onboarding),
    bioAr: typeof row.bio_ar === "string" ? row.bio_ar : undefined,
    socialLinks,
    linkedFacilityId,
    linkedCoachId,
    hasPassword: Boolean(row.password_hash),
  };
}

async function findProfileByQuery(queryRaw: string): Promise<{
  row: Record<string, unknown> | null;
  dbAvailable: boolean;
}> {
  const q = queryRaw.trim();
  const isEmail = q.includes("@");
  const isCode = /^CAP-/i.test(q);
  const phoneTail = normalizePhoneDigits(q);
  const admin = getSupabaseAdminClient();

  if (admin) {
    try {
      let dbQuery = admin.from("captenly_profiles").select("*").limit(1);
      if (isEmail) {
        dbQuery = dbQuery.eq("email", q.toLowerCase());
      } else if (isCode) {
        dbQuery = dbQuery.eq("member_code", q.toUpperCase());
      } else if (phoneTail.length >= 8) {
        dbQuery = dbQuery.ilike("phone", `%${phoneTail}`);
      } else {
        dbQuery = dbQuery.eq("member_code", q.toUpperCase());
      }
      const { data, error } = await dbQuery;
      if (!error) {
        return {
          row: Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null,
          dbAvailable: true,
        };
      }
    } catch {
      // Fall through to pg
    }
  }

  const pgRes = await withPgClient(async (client) => {
    if (isEmail) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where lower(email) = $1 limit 1`,
        [q.toLowerCase()]
      );
      return (rows[0] as Record<string, unknown>) || null;
    }
    if (isCode) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where upper(member_code) = $1 limit 1`,
        [q.toUpperCase()]
      );
      return (rows[0] as Record<string, unknown>) || null;
    }
    if (phoneTail.length >= 8) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like $1 order by updated_at desc limit 1`,
        [`%${phoneTail}`]
      );
      return (rows[0] as Record<string, unknown>) || null;
    }
    return null;
  });

  if (pgRes.ok) {
    return { row: pgRes.value, dbAvailable: true };
  }
  return { row: null, dbAvailable: false };
}

async function sendExternalOtpIfConfigured(params: {
  email?: string;
  phone?: string;
  fullNameAr: string;
  otp: string;
}): Promise<{ delivered: boolean; channel?: "email" | "sms"; detailAr?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && params.email && params.email.includes("@")) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Captenly <no-reply@captenly.com>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.email],
          subject: "رمز التحقق لاستعادة حساب كابتنلي — Captenly",
          html: `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">
            <h2>مرحباً ${params.fullNameAr}</h2>
            <p>رمز التحقق الخاص باستعادة حسابك في كابتنلي هو:</p>
            <p style="font-size:28px;font-weight:900;letter-spacing:4px">${params.otp}</p>
            <p>صلاحية الرمز 10 دقائق فقط. لا تشاركه مع أي شخص.</p>
          </div>`,
        }),
      });
      if (res.ok) {
        return {
          delivered: true,
          channel: "email",
          detailAr: `تم إرسال رمز التحقق بنجاح إلى بريدك الإلكتروني (${params.email}).`,
        };
      }
    } catch {
      // fall through
    }
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  if (twilioSid && twilioToken && twilioFrom && params.phone) {
    const cleanPhone = params.phone.replace(/\D/g, "");
    const e164 = cleanPhone.startsWith("20") ? `+${cleanPhone}` : cleanPhone.startsWith("0") ? `+2${cleanPhone}` : `+${cleanPhone}`;
    try {
      const form = new URLSearchParams({
        To: e164,
        From: twilioFrom,
        Body: `رمز التحقق الخاص بحسابك في كابتنلي (Captenly): ${params.otp} — صالح لمدة 10 دقائق.`,
      });
      const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }
      );
      if (res.ok) {
        return {
          delivered: true,
          channel: "sms",
          detailAr: "تم إرسال رسالة SMS تحتوي على رمز التحقق إلى رقم هاتفك.",
        };
      }
    } catch {
      // fall through
    }
  }

  return { delivered: false };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");

    const rl = await enforceRateLimit({
      bucket: `auth:member:${action || "unknown"}`,
      identifier: getClientIp(request),
      limit: 25,
      windowSec: 60,
    });
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSec);
    }

    if (action === "purge_non_owner_accounts") {
      const caller = await getServerCaller();
      const purgeEnabled =
        process.env.CAPTENLY_ENABLE_OWNER_PURGE === "true" && OWNER_EMAIL.includes("@");
      const isAuthorizedOwner =
        purgeEnabled &&
        (caller.isAdmin ||
          (caller.authenticated && caller.email?.toLowerCase() === OWNER_EMAIL));
      if (!isAuthorizedOwner) {
        return NextResponse.json(
          { ok: false, error: "forbidden", messageAr: "تصفية الحسابات غير مفعلة أو غير مصرح بها." },
          { status: 403 }
        );
      }
      const res = await purgeNonOwnerAccountsInDb({ forceAll: true });
      return NextResponse.json({
        ok: res.ok,
        keptEmail: OWNER_EMAIL,
        purgedProfiles: res.purgedProfiles,
      });
    }

    if (action === "register") {
      const fullNameAr = String(body.fullNameAr || "").trim();
      const phone = String(body.phone || "").trim();
      const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
      const password = String(body.password || "");
      const memberCode = String(body.memberCode || "").trim().toUpperCase();
      const city = String(body.city || "").trim() || "كل مصر";
      const governorate = String(body.governorate || "").trim() || "مصر";
      const rawRole = String(body.role || "adult_athlete");
      const allowedSignupRoles = new Set(["adult_athlete", "parent", "coach", "facility_manager"]);
      const role: AccountRole = allowedSignupRoles.has(rawRole)
        ? (rawRole as AccountRole)
        : "adult_athlete";
      const hasParentSupervision = Boolean(body.hasParentSupervision) || role === "parent";
      const linkedCoachId = role === "coach" ? getDeterministicCoachId(memberCode) : undefined;
      const initialSocialLinks: Record<string, unknown> = linkedCoachId
        ? { _linkedCoachId: linkedCoachId }
        : {};

      if (!fullNameAr || !memberCode || password.length < 6) {
        return NextResponse.json(
          { ok: false, reason: "invalid_input", messageAr: "يرجى إدخال الاسم وكلمة مرور لا تقل عن 6 أحرف." },
          { status: 400 }
        );
      }
      if (!phone && !email) {
        return NextResponse.json(
          { ok: false, reason: "missing_contact", messageAr: "يرجى إدخال رقم الهاتف أو البريد الإلكتروني." },
          { status: 400 }
        );
      }

      const existingCode = await findProfileByQuery(memberCode);
      if (existingCode.dbAvailable && existingCode.row) {
        return NextResponse.json(
          {
            ok: false,
            reason: "code_conflict",
            messageAr: "كود العضوية قيد الاستخدام بالفعل، يرجى المحاولة مرة أخرى لتوليد كود جديد.",
          },
          { status: 409 }
        );
      }

      if (phone) {
        const existingPhone = await findProfileByQuery(phone);
        if (existingPhone.dbAvailable && existingPhone.row) {
          return NextResponse.json(
            {
              ok: false,
              reason: "already_exists",
              messageAr: "رقم الهاتف مسجل بالفعل على كابتنلي. استخدم صفحة تسجيل الدخول.",
            },
            { status: 409 }
          );
        }
      }
      if (email) {
        const existingEmail = await findProfileByQuery(email);
        if (existingEmail.dbAvailable && existingEmail.row) {
          return NextResponse.json(
            {
              ok: false,
              reason: "already_exists",
              messageAr: "هذا البريد الإلكتروني مسجل بالفعل على كابتنلي. استخدم صفحة تسجيل الدخول.",
            },
            { status: 409 }
          );
        }
      }

      const passwordHash = hashPassword(password);

      const admin = getSupabaseAdminClient();
      if (admin) {
        const { data, error } = await admin
          .from("captenly_profiles")
          .insert({
            member_code: memberCode,
            email,
            full_name_ar: fullNameAr,
            role,
            phone: phone || null,
            city,
            governorate,
            auth_provider: "phone_otp",
            has_parent_supervision: hasParentSupervision,
            needs_onboarding: false,
            social_links: initialSocialLinks,
            password_hash: passwordHash,
            updated_at: new Date().toISOString(),
          })
          .select("*")
          .limit(1);

        if (error && (error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate"))) {
          return NextResponse.json(
            { ok: false, reason: "already_exists", messageAr: "الحساب أو كود العضوية مسجل بالفعل." },
            { status: 409 }
          );
        }

        if (!error && Array.isArray(data) && data.length > 0) {
          const profile = sanitizeProfileRow(data[0] as Record<string, unknown>);
          if (profile.role === "coach") {
            await ensureSelfRegisteredCoachInDb({
              memberCode: profile.memberCode,
              fullNameAr: profile.fullNameAr,
              city: profile.city,
              governorate: profile.governorate,
              phone: profile.phone,
              email: profile.email,
              linkedCoachId: profile.linkedCoachId,
            }).catch(() => {});
          }
          const res = NextResponse.json({
            ok: true,
            persisted: true,
            profile,
          });
          return attachMemberSessionCookie(res, {
            memberCode: profile.memberCode,
            role: (profile.role as AccountRole) || "adult_athlete",
            email: profile.email,
            phone: profile.phone,
            linkedFacilityId: profile.linkedFacilityId,
            linkedCoachId: profile.linkedCoachId,
          });
        }
      }

      const pgRes = await withPgClient(async (client) => {
        const { rows } = await client.query(
          `insert into public.captenly_profiles
            (member_code, email, full_name_ar, role, phone, city, governorate, auth_provider, has_parent_supervision, needs_onboarding, social_links, password_hash, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,'phone_otp',$8,false,$9::jsonb,$10,now())
           on conflict (member_code) do nothing
           returning *`,
          [
            memberCode,
            email,
            fullNameAr,
            role,
            phone || null,
            city,
            governorate,
            hasParentSupervision,
            JSON.stringify(initialSocialLinks),
            passwordHash,
          ]
        );
        return (rows[0] as Record<string, unknown>) || null;
      });

      if (pgRes.ok && pgRes.value === null) {
        return NextResponse.json(
          { ok: false, reason: "code_conflict", messageAr: "كود العضوية قيد الاستخدام بالفعل." },
          { status: 409 }
        );
      }

      if (pgRes.ok && pgRes.value) {
        const profile = sanitizeProfileRow(pgRes.value);
        if (profile.role === "coach") {
          await ensureSelfRegisteredCoachInDb({
            memberCode: profile.memberCode,
            fullNameAr: profile.fullNameAr,
            city: profile.city,
            governorate: profile.governorate,
            phone: profile.phone,
            email: profile.email,
            linkedCoachId: profile.linkedCoachId,
          }).catch(() => {});
        }
        const res = NextResponse.json({
          ok: true,
          persisted: true,
          profile,
        });
        return attachMemberSessionCookie(res, {
          memberCode: profile.memberCode,
          role: (profile.role as AccountRole) || "adult_athlete",
          email: profile.email,
          phone: profile.phone,
          linkedFacilityId: profile.linkedFacilityId,
          linkedCoachId: profile.linkedCoachId,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          reason: "database_not_configured",
          messageAr:
            "قاعدة البيانات غير متصلة حالياً لتخزين الحسابات بشكل دائم (يرجى التأكد من إعداد Supabase / Postgres في متغيرات البيئة).",
        },
        { status: 503 }
      );
    }

    if (action === "login") {
      const query = String(body.query || "").trim();
      const password = String(body.password || "");
      if (!query || !password) {
        return NextResponse.json(
          { ok: false, reason: "missing_credentials", messageAr: "يرجى إدخال كود العضوية أو الهاتف أو البريد وكلمة المرور." },
          { status: 400 }
        );
      }

      const found = await findProfileByQuery(query);
      if (!found.dbAvailable) {
        return NextResponse.json(
          {
            ok: false,
            reason: "database_not_configured",
            messageAr: "قاعدة البيانات غير متصلة حالياً للتحقق من كلمة المرور.",
          },
          { status: 503 }
        );
      }
      if (!found.row) {
        return NextResponse.json(
          {
            ok: false,
            reason: "not_found",
            messageAr: "لم يتم العثور على حساب مطابق لهذا الكود أو الهاتف أو البريد.",
          },
          { status: 404 }
        );
      }

      const storedHash = typeof found.row.password_hash === "string" ? found.row.password_hash : "";
      if (!storedHash) {
        const isGoogle = found.row.auth_provider === "google";
        return NextResponse.json(
          {
            ok: false,
            reason: isGoogle ? "google_account_no_password" : "password_not_set",
            messageAr: isGoogle
              ? "هذا الحساب مسجل عبر Google ولم تُعيّن له كلمة مرور بعد. سجّل الدخول بزر Google أو أنشئ كلمة مرور من الإعدادات."
              : "لم تُعيّن كلمة مرور لهذا الحساب بعد. يرجى إنشاء حساب بكلمة مرور أو استخدام استعادة الحساب عبر البريد المرتبط.",
          },
          { status: 401 }
        );
      }

      if (!verifyPassword(password, storedHash)) {
        return NextResponse.json(
          { ok: false, reason: "invalid_password", messageAr: "كلمة المرور غير صحيحة." },
          { status: 401 }
        );
      }

      const profile = sanitizeProfileRow(found.row);
      if (profile.role === "coach") {
        await ensureSelfRegisteredCoachInDb({
          memberCode: profile.memberCode,
          fullNameAr: profile.fullNameAr,
          city: profile.city,
          governorate: profile.governorate,
          phone: profile.phone,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          bioAr: profile.bioAr,
          socialLinks: stripInternalSocialKeys(profile.socialLinks),
          linkedCoachId: profile.linkedCoachId,
        }).catch(() => {});
      }
      const res = NextResponse.json({
        ok: true,
        profile,
      });
      return attachMemberSessionCookie(res, {
        memberCode: profile.memberCode,
        role: (profile.role as AccountRole) || "adult_athlete",
        email: profile.email,
        phone: profile.phone,
        linkedFacilityId: profile.linkedFacilityId,
        linkedCoachId: profile.linkedCoachId,
      });
    }

    if (action === "google_login") {
      // Security remediation (F-001): never trust client-supplied body.email or simulated preview flag.
      if (body.isSimulatedPreview === true) {
        return NextResponse.json(
          {
            ok: false,
            reason: "preview_disabled",
            messageAr: "وضع المعاينة غير مصرح به لتسجيل الدخول عبر Google.",
          },
          { status: 401 }
        );
      }

      const authInstance = getAuthInstance();
      const session = authInstance ? await authInstance.auth() : null;
      const sessionEmail = session?.user?.email?.trim().toLowerCase();
      if (!sessionEmail || !sessionEmail.includes("@")) {
        return NextResponse.json(
          {
            ok: false,
            reason: "oauth_session_required",
            messageAr: "تسجيل الدخول عبر Google يتطلب جلسة OAuth موثقة من الخادم.",
          },
          { status: 401 }
        );
      }
      const cleanEmail = sessionEmail;

      const incomingName =
        (typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "") ||
        session?.user?.name?.trim() ||
        cleanEmail.split("@")[0] ||
        "عضو كابتنلي";
      const incomingAvatar =
        (typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "") ||
        session?.user?.image?.trim() ||
        null;

      const existing = await findProfileByQuery(cleanEmail);
      if (!existing.dbAvailable) {
        return NextResponse.json(
          { ok: false, reason: "database_not_configured" },
          { status: 503 }
        );
      }

      if (existing.row && !Boolean(existing.row.needs_onboarding)) {
        const existingCode = String(existing.row.member_code || "").trim().toUpperCase();
        const existingRole = String(existing.row.role || "adult_athlete");
        const existingSocial = (existing.row.social_links || {}) as Record<string, unknown>;
        const needsAvatarBackfill = !existing.row.avatar_url && Boolean(incomingAvatar);
        const needsCoachLinkBackfill =
          existingRole === "coach" && typeof existingSocial._linkedCoachId !== "string" && Boolean(existingCode);
        const derivedCoachId = needsCoachLinkBackfill ? getDeterministicCoachId(existingCode) : undefined;
        const nextSocialLinks = derivedCoachId
          ? { ...existingSocial, _linkedCoachId: derivedCoachId }
          : existingSocial;

        if ((needsAvatarBackfill || needsCoachLinkBackfill) && existingCode) {
          const patchPayload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (needsAvatarBackfill) {
            patchPayload.avatar_url = incomingAvatar;
          }
          if (needsCoachLinkBackfill) {
            patchPayload.social_links = nextSocialLinks;
          }
          const admin = getSupabaseAdminClient();
          let updated = false;
          if (admin) {
            const { error } = await admin
              .from("captenly_profiles")
              .update(patchPayload)
              .eq("member_code", existingCode);
            updated = !error;
          }
          if (!updated) {
            await withPgClient(async (client) => {
              await client.query(
                `update public.captenly_profiles
                 set avatar_url = coalesce(avatar_url, $2),
                     social_links = $3::jsonb,
                     updated_at = now()
                 where upper(member_code) = upper($1)`,
                [existingCode, incomingAvatar, JSON.stringify(nextSocialLinks)]
              );
              return true;
            });
          }
        }

        const profile = sanitizeProfileRow({
          ...existing.row,
          social_links: nextSocialLinks,
          avatar_url: existing.row.avatar_url || incomingAvatar || undefined,
        });
        if (profile.role === "coach") {
          await ensureSelfRegisteredCoachInDb({
            memberCode: profile.memberCode,
            fullNameAr: profile.fullNameAr,
            city: profile.city,
            governorate: profile.governorate,
            phone: profile.phone,
            email: profile.email || cleanEmail,
            avatarUrl: profile.avatarUrl,
            bioAr: profile.bioAr,
            socialLinks: stripInternalSocialKeys(profile.socialLinks),
            linkedCoachId: profile.linkedCoachId,
          }).catch(() => {});
        }
        const res = NextResponse.json({
          ok: true,
          persisted: true,
          isNewUser: false,
          profile,
        });
        return attachMemberSessionCookie(res, {
          memberCode: profile.memberCode,
          role: (profile.role as AccountRole) || "adult_athlete",
          email: profile.email || cleanEmail,
          phone: profile.phone,
          linkedFacilityId: profile.linkedFacilityId,
          linkedCoachId: profile.linkedCoachId,
        });
      }

      // First-time Google user (or user who has not completed onboarding yet):
      // Do NOT insert into captenly_profiles until /auth/onboarding submits role selection.
      const staleRowCode =
        existing.row && typeof existing.row.member_code === "string"
          ? existing.row.member_code.trim().toUpperCase()
          : "";
      let chosenCode = staleRowCode || generateDeterministicMemberCode(cleanEmail, 0);
      if (!staleRowCode) {
        for (let attempt = 1; attempt <= 12; attempt++) {
          const codeCheck = await findProfileByQuery(chosenCode);
          if (!codeCheck.row) break;
          chosenCode = generateDeterministicMemberCode(cleanEmail, attempt);
        }
      }

      const pendingProfile = {
        id: existing.row?.id
          ? String(existing.row.id)
          : `google-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`,
        memberCode: chosenCode,
        email: cleanEmail,
        fullNameAr: incomingName,
        role: "adult_athlete",
        phone: typeof existing.row?.phone === "string" ? existing.row.phone : "",
        city: "كل مصر",
        governorate: "مصر",
        avatarUrl: incomingAvatar || undefined,
        authProvider: "google" as const,
        hasParentSupervision: false,
        needsOnboarding: true,
        socialLinks: {},
        hasPassword: Boolean(existing.row?.password_hash),
      };

      const res = NextResponse.json({
        ok: true,
        persisted: false,
        isNewUser: true,
        profile: pendingProfile,
      });
      return attachMemberSessionCookie(res, {
        memberCode: chosenCode,
        role: "adult_athlete",
        email: cleanEmail,
      });
    }

    if (action === "delete_account") {
      const caller = await getServerCaller();
      if (!caller.authenticated) {
        return NextResponse.json(
          { ok: false, error: "unauthorized", messageAr: "يرجى تسجيل الدخول أولاً لتنفيذ حذف الحساب." },
          { status: 401 }
        );
      }

      const reqCode = typeof body.memberCode === "string" ? body.memberCode.trim().toUpperCase() : "";
      const reqEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const reqAthleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";

      if (!caller.isAdmin) {
        if (reqCode && caller.memberCode && reqCode !== caller.memberCode.toUpperCase()) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        if (reqEmail && caller.email && reqEmail !== caller.email.toLowerCase()) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
      }

      const targetCode = caller.isAdmin
        ? reqCode || caller.memberCode || ""
        : caller.memberCode || reqCode || "";
      const targetEmail = caller.isAdmin
        ? reqEmail || caller.email || ""
        : caller.email || reqEmail || "";

      const lookupQuery = targetEmail || targetCode;
      if (!lookupQuery) {
        return NextResponse.json(
          { ok: false, error: "missing_identity", messageAr: "تعذر تحديد هوية الحساب للحذف." },
          { status: 400 }
        );
      }

      const found = await findProfileByQuery(lookupQuery);
      const effectiveCode = (
        (found.row?.member_code ? String(found.row.member_code) : targetCode) || ""
      )
        .trim()
        .toUpperCase();
      const effectiveEmail = (
        (found.row?.email ? String(found.row.email) : targetEmail) || ""
      )
        .trim()
        .toLowerCase();
      const profileId = found.row?.id ? String(found.row.id) : "";

      const athleteIdSet = new Set<string>(
        [profileId, reqAthleteId].filter((id) => Boolean(id && id !== "persona-guest"))
      );

      const admin = getSupabaseAdminClient();
      if (admin) {
        try {
          if (effectiveCode) {
            const { data: children } = await admin
              .from("captenly_minor_athletes")
              .select("id")
              .eq("parent_member_code", effectiveCode);
            if (Array.isArray(children)) {
              for (const c of children) {
                if (c?.id) athleteIdSet.add(String(c.id));
              }
            }
          }

          const athleteIds = Array.from(athleteIdSet);
          if (effectiveCode) {
            await admin.from("captenly_pb_records").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_skill_evaluations").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_minor_athletes").delete().eq("parent_member_code", effectiveCode);
            await admin.from("captenly_user_prefs").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_notifications").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_role_claims").delete().eq("applicant_member_code", effectiveCode);
            await admin.from("captenly_session_ledgers").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_leads").delete().eq("member_code", effectiveCode);
            await admin.from("captenly_profiles").delete().eq("member_code", effectiveCode);
          }
          if (athleteIds.length > 0) {
            await admin.from("captenly_pb_records").delete().in("athlete_id", athleteIds);
            await admin.from("captenly_skill_evaluations").delete().in("athlete_id", athleteIds);
            await admin.from("captenly_session_ledgers").delete().in("athlete_id", athleteIds);
          }
          if (effectiveEmail) {
            await admin.from("captenly_role_claims").delete().eq("applicant_email", effectiveEmail);
            await admin.from("captenly_profiles").delete().eq("email", effectiveEmail);
          }
        } catch {
          // fall through to pg cleanup as safety net
        }
      }

      await withPgClient(async (client) => {
        const safeExec = async (sql: string, params: unknown[]) => {
          try {
            await client.query(sql, params);
          } catch {
            // ignore missing optional table
          }
        };

        if (effectiveCode) {
          try {
            const { rows: childRows } = await client.query(
              `select id from public.captenly_minor_athletes where upper(parent_member_code) = upper($1)`,
              [effectiveCode]
            );
            for (const r of childRows) {
              if (r?.id) athleteIdSet.add(String(r.id));
            }
          } catch {
            // ignore if minor table not initialized
          }
        }

        const athleteIds = Array.from(athleteIdSet);
        if (effectiveCode) {
          await safeExec(`delete from public.captenly_pb_records where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_skill_evaluations where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_minor_athletes where upper(parent_member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_user_prefs where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_notifications where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_role_claims where upper(applicant_member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_session_ledgers where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_leads where upper(member_code) = upper($1)`, [effectiveCode]);
          await safeExec(`delete from public.captenly_profiles where upper(member_code) = upper($1)`, [effectiveCode]);
        }
        if (athleteIds.length > 0) {
          await safeExec(`delete from public.captenly_pb_records where athlete_id = any($1::text[])`, [athleteIds]);
          await safeExec(`delete from public.captenly_skill_evaluations where athlete_id = any($1::text[])`, [athleteIds]);
          await safeExec(`delete from public.captenly_session_ledgers where athlete_id = any($1::text[])`, [athleteIds]);
        }
        if (effectiveEmail) {
          await safeExec(`delete from public.captenly_role_claims where lower(applicant_email) = lower($1)`, [effectiveEmail]);
          await safeExec(`delete from public.captenly_profiles where lower(email) = lower($1)`, [effectiveEmail]);
        }
        return true;
      });

      const foundSocial = (found.row?.social_links || {}) as Record<string, unknown>;
      const linkedCoachId =
        typeof foundSocial._linkedCoachId === "string" ? foundSocial._linkedCoachId : undefined;
      await deleteCoachByMemberOrIdInDb({
        memberCode: effectiveCode,
        coachId: linkedCoachId,
      }).catch(() => {});

      const res = NextResponse.json({ ok: true, deleted: true, memberCode: effectiveCode || undefined });
      return clearMemberSessionCookie(res);
    }

    if (action === "logout") {
      return clearMemberSessionCookie(NextResponse.json({ ok: true }));
    }

    if (action === "verify_otp") {
      const query = String(body.query || "").trim();
      const otpCode = String(body.otpCode || "").trim();
      const clearOtp = Boolean(body.clearOtp);
      if (!query || otpCode.length < 6) {
        return NextResponse.json(
          { ok: false, messageAr: "يرجى إدخال رمز التحقق المكون من 6 أرقام." },
          { status: 400 }
        );
      }

      const found = await findProfileByQuery(query);
      if (!found.dbAvailable) {
        return NextResponse.json(
          { ok: false, messageAr: "قاعدة البيانات غير متصلة حالياً للتحقق من الرمز." },
          { status: 503 }
        );
      }
      if (!found.row) {
        return NextResponse.json(
          { ok: false, messageAr: "الحساب غير موجود." },
          { status: 404 }
        );
      }

      const memberCode = String(found.row.member_code || "");
      const storedOtpHash = typeof found.row.otp_code_hash === "string" ? found.row.otp_code_hash : "";
      const expiresAtMs = found.row.otp_expires_at ? new Date(String(found.row.otp_expires_at)).getTime() : 0;
      const expectedOtpHash = hashOtp(otpCode, memberCode);

      if (!storedOtpHash || !expectedOtpHash || expiresAtMs < Date.now() || storedOtpHash !== expectedOtpHash) {
        return NextResponse.json(
          { ok: false, messageAr: "رمز التحقق غير صحيح أو منتهي الصلاحية." },
          { status: 401 }
        );
      }

      if (clearOtp) {
        const admin = getSupabaseAdminClient();
        let cleared = false;
        if (admin) {
          const { error } = await admin
            .from("captenly_profiles")
            .update({ otp_code_hash: null, otp_expires_at: null })
            .eq("member_code", memberCode);
          cleared = !error;
        }
        if (!cleared) {
          await withPgClient(async (client) => {
            await client.query(
              `update public.captenly_profiles set otp_code_hash = null, otp_expires_at = null where member_code = $1`,
              [memberCode]
            );
            return true;
          });
        }
      }

      const profile = sanitizeProfileRow(found.row);
      const res = NextResponse.json({ ok: true, profile });
      return attachMemberSessionCookie(res, {
        memberCode: profile.memberCode,
        role: (profile.role as AccountRole) || "adult_athlete",
        email: profile.email,
        phone: profile.phone,
        linkedFacilityId: profile.linkedFacilityId,
        linkedCoachId: profile.linkedCoachId,
      });
    }

    if (action === "request_otp") {
      const query = String(body.query || "").trim();
      if (!query) {
        return NextResponse.json(
          { ok: false, messageAr: "يرجى إدخال البريد الإلكتروني أو رقم الهاتف." },
          { status: 400 }
        );
      }
      const found = await findProfileByQuery(query);
      if (!found.dbAvailable) {
        return NextResponse.json(
          { ok: false, deliveryUnavailable: true, messageAr: "قاعدة البيانات غير متصلة حالياً." },
          { status: 503 }
        );
      }
      if (!found.row) {
        return NextResponse.json(
          { ok: false, reason: "not_found", messageAr: "لم يتم العثور على حساب مرتبط بهذه البيانات." },
          { status: 404 }
        );
      }

      const memberCode = String(found.row.member_code || "");
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = hashOtp(otp, memberCode);
      if (!otpHash) {
        return NextResponse.json(
          { ok: false, deliveryUnavailable: true, messageAr: "مفتاح تشفير OTP غير مضبوط في بيئة الإنتاج." },
          { status: 503 }
        );
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const delivery = await sendExternalOtpIfConfigured({
        email: typeof found.row.email === "string" ? found.row.email : undefined,
        phone: typeof found.row.phone === "string" ? found.row.phone : undefined,
        fullNameAr: String(found.row.full_name_ar || "عضو كابتنلي"),
        otp,
      });

      if (!delivery.delivered) {
        return NextResponse.json(
          {
            ok: false,
            deliveryUnavailable: true,
            hasGoogleOption: Boolean(found.row.email),
            messageAr:
              "إرسال رمز التحقق (OTP) يتطلب تفعيل مفتاح بريد أو رسائل SMS في متغيرات البيئة (RESEND_API_KEY أو Twilio). إذا كان حسابك مرتبطاً بـ Google، سجّل الدخول عبر Google أولاً ثم عيّن كلمة مرور جديدة من صفحة الأمان.",
          },
          { status: 503 }
        );
      }

      const admin = getSupabaseAdminClient();
      let saved = false;
      if (admin) {
        const { error } = await admin
          .from("captenly_profiles")
          .update({ otp_code_hash: otpHash, otp_expires_at: expiresAt })
          .eq("member_code", memberCode);
        saved = !error;
      }
      if (!saved) {
        await withPgClient(async (client) => {
          await client.query(
            `update public.captenly_profiles set otp_code_hash = $2, otp_expires_at = $3 where member_code = $1`,
            [memberCode, otpHash, expiresAt]
          );
          return true;
        });
      }

      return NextResponse.json({
        ok: true,
        channel: delivery.channel,
        messageAr: delivery.detailAr,
      });
    }

    if (action === "reset_password") {
      const newPassword = String(body.newPassword || "");
      const query = String(body.query || "").trim();
      const otpCode = String(body.otpCode || "").trim();
      if (newPassword.length < 6) {
        return NextResponse.json(
          { ok: false, messageAr: "كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف." },
          { status: 400 }
        );
      }

      const authInstance = getAuthInstance();
      const session = authInstance ? await authInstance.auth() : null;
      const verifiedEmail = session?.user?.email?.toLowerCase();

      if (verifiedEmail && !otpCode) {
        const foundBySession = await findProfileByQuery(verifiedEmail);
        if (!foundBySession.dbAvailable || !foundBySession.row) {
          return NextResponse.json(
            { ok: false, messageAr: "لم يتم العثور على الحساب المرتبط بجلسة Google الحالية." },
            { status: 404 }
          );
        }
        const memberCode = String(foundBySession.row.member_code || "");
        const newHash = hashPassword(newPassword);
        const admin = getSupabaseAdminClient();
        let updated = false;
        if (admin) {
          const { error } = await admin
            .from("captenly_profiles")
            .update({ password_hash: newHash, otp_code_hash: null, otp_expires_at: null, updated_at: new Date().toISOString() })
            .eq("member_code", memberCode);
          updated = !error;
        }
        if (!updated) {
          const pg = await withPgClient(async (client) => {
            await client.query(
              `update public.captenly_profiles set password_hash = $2, otp_code_hash = null, otp_expires_at = null, updated_at = now() where member_code = $1`,
              [memberCode, newHash]
            );
            return true;
          });
          updated = pg.ok;
        }
        return NextResponse.json({
          ok: updated,
          messageAr: updated ? "تم تعيين كلمة المرور الجديدة بنجاح وتشفيرها في قاعدة البيانات." : "تعذر تحديث كلمة المرور حالياً.",
        });
      }

      if (!query || !otpCode) {
        return NextResponse.json(
          { ok: false, messageAr: "يرجى إدخال رمز التحقق الصحيح المرسل إليك، أو تسجيل الدخول عبر Google لتعيين كلمة مرور جديدة." },
          { status: 400 }
        );
      }

      const found = await findProfileByQuery(query);
      if (!found.dbAvailable || !found.row) {
        return NextResponse.json(
          { ok: false, messageAr: "الحساب غير موجود أو قاعدة البيانات غير متصلة." },
          { status: 404 }
        );
      }

      const memberCode = String(found.row.member_code || "");
      const storedOtpHash = typeof found.row.otp_code_hash === "string" ? found.row.otp_code_hash : "";
      const expiresAtMs = found.row.otp_expires_at ? new Date(String(found.row.otp_expires_at)).getTime() : 0;
      const expectedOtpHash = hashOtp(otpCode, memberCode);

      if (!storedOtpHash || !expectedOtpHash || expiresAtMs < Date.now() || storedOtpHash !== expectedOtpHash) {
        return NextResponse.json(
          { ok: false, messageAr: "رمز التحقق غير صحيح أو منتهي الصلاحية." },
          { status: 401 }
        );
      }

      const newHash = hashPassword(newPassword);
      const admin = getSupabaseAdminClient();
      let updated = false;
      if (admin) {
        const { error } = await admin
          .from("captenly_profiles")
          .update({ password_hash: newHash, otp_code_hash: null, otp_expires_at: null, updated_at: new Date().toISOString() })
          .eq("member_code", memberCode);
        updated = !error;
      }
      if (!updated) {
        const pg = await withPgClient(async (client) => {
          await client.query(
            `update public.captenly_profiles set password_hash = $2, otp_code_hash = null, otp_expires_at = null, updated_at = now() where member_code = $1`,
            [memberCode, newHash]
          );
          return true;
        });
        updated = pg.ok;
      }

      return NextResponse.json({
        ok: updated,
        messageAr: updated ? "تم تغيير كلمة المرور بنجاح." : "حدث خطأ أثناء تحديث كلمة المرور.",
      });
    }

    return NextResponse.json({ ok: false, reason: "unknown_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
  }
}
