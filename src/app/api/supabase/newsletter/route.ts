import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller } from "@/lib/memberSession";
import { enforceRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rl = await enforceRateLimit({
    bucket: "public:newsletter",
    identifier: getClientIp(request),
    limit: 10,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSec);
  }

  try {
    const body = (await request.json().catch(() => null)) as { email?: string; source?: string } | null;
    const email = (body?.email || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || email.length > 180) {
      return NextResponse.json(
        { ok: false, persisted: false, messageAr: "يرجى إدخال بريد إلكتروني صحيح." },
        { status: 400 }
      );
    }

    const caller = await getServerCaller().catch(() => null);
    const memberCode = caller?.authenticated && caller.memberCode ? caller.memberCode : null;
    const source = body?.source ? String(body.source).slice(0, 40) : "magazine";

    const admin = getSupabaseAdminClient();
    if (admin) {
      try {
        const { error } = await admin.from("captenly_newsletter_subscribers").upsert(
          {
            email,
            member_code: memberCode,
            status: "active",
            source,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );
        if (!error) {
          return NextResponse.json({
            ok: true,
            persisted: true,
            messageAr: "تم تسجيل بريدك الإلكتروني بنجاح في قائمة نشرة كابتنلي الرياضية ✓",
          });
        }
      } catch {
        // fall through to PG
      }
    }

    const pg = await withPgClient(async (client) => {
      await client.query(
        `insert into public.captenly_newsletter_subscribers (email, member_code, status, source, updated_at)
         values ($1, $2, 'active', $3, now())
         on conflict (email) do update set
           member_code = coalesce(excluded.member_code, public.captenly_newsletter_subscribers.member_code),
           status = 'active',
           updated_at = now()`,
        [email, memberCode, source]
      );
      return true;
    });

    if (pg.ok) {
      return NextResponse.json({
        ok: true,
        persisted: true,
        messageAr: "تم تسجيل بريدك الإلكتروني بنجاح في قائمة نشرة كابتنلي الرياضية ✓",
      });
    }

    return NextResponse.json(
      { ok: false, persisted: false, messageAr: "تعذر حفظ البريد الإلكتروني في قاعدة البيانات حالياً." },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, persisted: false, messageAr: "بيانات غير صالحة." },
      { status: 400 }
    );
  }
}
