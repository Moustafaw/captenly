import { NextResponse } from "next/server";
import crypto from "crypto";
import type { AccountRole } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getAuthInstance } from "@/auth";
import { attachMemberSessionCookie, clearMemberSessionCookie } from "@/lib/memberSession";

export const runtime = "nodejs";

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

function sanitizeProfileRow(row: Record<string, unknown>) {
  const socialLinks = (row.social_links || {}) as Record<string, unknown>;
  const linkedFacilityId =
    typeof socialLinks._linkedFacilityId === "string" ? socialLinks._linkedFacilityId : undefined;
  const linkedCoachId =
    typeof socialLinks._linkedCoachId === "string" ? socialLinks._linkedCoachId : undefined;

  return {
    id: String(row.id || `user-${row.member_code || "member"}`),
    memberCode: String(row.member_code || ""),
    email: typeof row.email === "string" ? row.email : undefined,
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    role: String(row.role || "adult_athlete"),
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

async function ensureAuthSchemaViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_profiles (
        id uuid default gen_random_uuid() primary key,
        member_code text unique not null,
        email text unique,
        full_name_ar text not null,
        role text not null default 'adult_athlete',
        phone text,
        city text not null default 'كل مصر',
        governorate text not null default 'مصر',
        avatar_url text,
        auth_provider text default 'phone_otp',
        has_parent_supervision boolean default false,
        needs_onboarding boolean default false,
        bio_ar text,
        social_links jsonb default '{}'::jsonb,
        password_hash text,
        otp_code_hash text,
        otp_expires_at timestamptz,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
    await client.query(`
      alter table public.captenly_profiles
        add column if not exists password_hash text,
        add column if not exists otp_code_hash text,
        add column if not exists otp_expires_at timestamptz;
    `);
    return true;
  });
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

  await ensureAuthSchemaViaPg();
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

    if (action === "register") {
      const fullNameAr = String(body.fullNameAr || "").trim();
      const phone = String(body.phone || "").trim();
      const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
      const password = String(body.password || "");
      const memberCode = String(body.memberCode || "").trim().toUpperCase();
      const city = String(body.city || "").trim() || "كل مصر";
      const governorate = String(body.governorate || "").trim() || "مصر";
      const rawRole = String(body.role || "adult_athlete");
      const role: "adult_athlete" | "parent" = rawRole === "parent" ? "parent" : "adult_athlete";
      const hasParentSupervision = Boolean(body.hasParentSupervision) || role === "parent";

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
      await ensureAuthSchemaViaPg();

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
            (member_code, email, full_name_ar, role, phone, city, governorate, auth_provider, has_parent_supervision, needs_onboarding, password_hash, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,'phone_otp',$8,false,$9,now())
           on conflict (member_code) do nothing
           returning *`,
          [memberCode, email, fullNameAr, role, phone || null, city, governorate, hasParentSupervision, passwordHash]
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

      await ensureAuthSchemaViaPg();
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
        await ensureAuthSchemaViaPg();
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
