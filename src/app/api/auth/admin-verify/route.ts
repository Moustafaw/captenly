import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getAuthInstance } from "@/auth";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "captenly_admin_session";

function signToken(payload: string): string {
  const secret = process.env.AUTH_SECRET || process.env.CAPTENLY_ADMIN_KEY || "captenly-admin-secret";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function isAuthorizedAdmin(): Promise<{
  configured: boolean;
  authorized: boolean;
  reason?: string;
}> {
  const expectedKey = (process.env.CAPTENLY_ADMIN_KEY || "").trim();
  const allowedEmails = (process.env.CAPTENLY_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const configured = expectedKey.length > 0 || allowedEmails.length > 0;
  if (!configured) {
    return { configured: false, authorized: false, reason: "admin_env_not_configured" };
  }

  if (allowedEmails.length > 0) {
    const authInstance = getAuthInstance();
    const session = authInstance ? await authInstance.auth() : null;
    const email = session?.user?.email?.toLowerCase();
    if (email && allowedEmails.includes(email)) {
      return { configured: true, authorized: true };
    }
  }

  if (expectedKey.length > 0) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
    const parts = token.split(".");
    if (parts.length === 2) {
      const [expStr, sig] = parts;
      const exp = Number(expStr);
      if (Number.isFinite(exp) && exp > Date.now()) {
        const expectedSig = signToken(`admin:${exp}`);
        if (constantTimeEquals(sig, expectedSig)) {
          return { configured: true, authorized: true };
        }
      }
    }
  }

  return { configured: true, authorized: false };
}

export async function GET() {
  const status = await isAuthorizedAdmin();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const expectedKey = (process.env.CAPTENLY_ADMIN_KEY || "").trim();
    if (!expectedKey) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          authorized: false,
          messageAr: "لم يتم ضبط متغير البيئة CAPTENLY_ADMIN_KEY أو CAPTENLY_ADMIN_EMAILS على الخادم.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { key?: string };
    const providedKey = String(body.key || "").trim();
    if (!providedKey || !constantTimeEquals(providedKey, expectedKey)) {
      return NextResponse.json(
        { ok: false, configured: true, authorized: false, messageAr: "مفتاح الإدارة غير صحيح." },
        { status: 401 }
      );
    }

    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const cookieValue = `${exp}.${signToken(`admin:${exp}`)}`;
    const response = NextResponse.json({ ok: true, configured: true, authorized: true });
    response.cookies.set(ADMIN_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, authorized: false });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
