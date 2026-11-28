import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller, sanitizeFilterToken } from "@/lib/memberSession";
import type { Facility, FacilityStaffMember } from "@/types/captenly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvitationDecision = "accepted" | "declined";

type StoredStaffRecord = FacilityStaffMember & {
  userId?: string;
  respondedAtIso?: string;
  expiresAtIso?: string;
  expiresAt?: string;
};

async function fetchFacilityPayload(facilityId: string): Promise<{
  dbAvailable: boolean;
  facility: (Partial<Facility> & Record<string, unknown>) | null;
}> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_facilities")
        .select("id, payload")
        .eq("id", facilityId)
        .limit(1);
      if (!error) {
        const row = Array.isArray(data)
          ? (data[0] as { id?: string; payload?: Partial<Facility> & Record<string, unknown> } | undefined)
          : undefined;
        return {
          dbAvailable: true,
          facility: row?.payload ? { ...row.payload, id: String(row.id || facilityId) } : null,
        };
      }
    } catch {
      // fall through to PostgreSQL fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select id, payload from public.captenly_facilities where id = $1 limit 1`,
      [facilityId]
    );
    const row = rows[0] as
      | { id?: string; payload?: Partial<Facility> & Record<string, unknown> }
      | undefined;
    return row?.payload ? { ...row.payload, id: String(row.id || facilityId) } : null;
  });

  if (pgRes.ok) {
    return { dbAvailable: true, facility: pgRes.value };
  }
  return { dbAvailable: false, facility: null };
}

async function lookupCallerProfileId(params: {
  memberCode?: string;
  email?: string;
}): Promise<string | null> {
  const cleanCode = params.memberCode?.trim().toUpperCase();
  const cleanEmail = params.email?.trim().toLowerCase();
  if (!cleanCode && !cleanEmail) return null;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin.from("captenly_profiles").select("id").limit(1);
      query = cleanCode ? query.eq("member_code", cleanCode) : query.eq("email", cleanEmail!);
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data[0] && (data[0] as { id?: unknown }).id) {
        return String((data[0] as { id: unknown }).id);
      }
    } catch {
      // fall through to PostgreSQL fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const sql = cleanCode
      ? `select id from public.captenly_profiles where upper(member_code) = upper($1) limit 1`
      : `select id from public.captenly_profiles where lower(email) = lower($1) limit 1`;
    const { rows } = await client.query(sql, [cleanCode || cleanEmail]);
    const row = rows[0] as { id?: unknown } | undefined;
    return row?.id ? String(row.id) : null;
  });

  return pgRes.ok ? pgRes.value : null;
}

async function persistFacilityPayload(
  facilityId: string,
  payload: Partial<Facility> & Record<string, unknown>
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { error } = await admin
        .from("captenly_facilities")
        .update({ payload, updated_at: nowIso })
        .eq("id", facilityId);
      if (!error) return true;
    } catch {
      // fall through to PostgreSQL fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rowCount } = await client.query(
      `update public.captenly_facilities set payload = $2::jsonb, updated_at = now() where id = $1`,
      [facilityId, JSON.stringify(payload)]
    );
    return (rowCount ?? 0) > 0;
  });

  return pgRes.ok && Boolean(pgRes.value);
}

function isExpiredTimestamp(raw?: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) && ms <= Date.now();
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        messageAr: "يجب تسجيل الدخول أولاً للرد على دعوة العمل.",
      },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", messageAr: "صيغة الطلب غير صالحة." },
      { status: 400 }
    );
  }

  const facilityId = sanitizeFilterToken(String(body?.facilityId || ""));
  const staffId = sanitizeFilterToken(String(body?.staffId || ""));
  const decision = body?.decision;

  if (
    !facilityId ||
    !staffId ||
    (decision !== "accepted" && decision !== "declined")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_input",
        messageAr: "يرجى تحديد معرف المنشأة ومعرف الدعوة وقرار القبول أو الرفض.",
      },
      { status: 400 }
    );
  }

  const fetched = await fetchFacilityPayload(facilityId);
  if (!fetched.dbAvailable) {
    return NextResponse.json(
      {
        ok: false,
        error: "database_unavailable",
        messageAr: "قاعدة البيانات غير متاحة حالياً لتحديث الدعوة.",
      },
      { status: 503 }
    );
  }

  if (!fetched.facility) {
    return NextResponse.json(
      {
        ok: false,
        error: "facility_not_found",
        messageAr: "لم يتم العثور على المنشأة المطلوبة.",
      },
      { status: 404 }
    );
  }

  const existingPayload = fetched.facility;
  const staffMembers = Array.isArray(existingPayload.staffMembers)
    ? (existingPayload.staffMembers as StoredStaffRecord[])
    : [];
  const targetIndex = staffMembers.findIndex((st) => st && st.id === staffId);
  if (targetIndex === -1) {
    return NextResponse.json(
      {
        ok: false,
        error: "invitation_not_found",
        messageAr: "لم يتم العثور على دعوة العمل المطلوبة.",
      },
      { status: 404 }
    );
  }

  const targetStaff = staffMembers[targetIndex];
  const callerCode = (caller.memberCode || "").trim().toUpperCase();
  const callerEmail = (caller.email || "").trim().toLowerCase();

  const codeMatch = Boolean(
    callerCode &&
      targetStaff.linkedMemberCode &&
      targetStaff.linkedMemberCode.trim().toUpperCase() === callerCode
  );
  const emailMatch = Boolean(
    callerEmail &&
      targetStaff.email &&
      targetStaff.email.trim().toLowerCase() === callerEmail
  );

  let userIdMatch = false;
  if (!codeMatch && !emailMatch && (targetStaff.linkedPersonaId || targetStaff.userId)) {
    const callerProfileId = await lookupCallerProfileId({
      memberCode: caller.memberCode,
      email: caller.email,
    });
    if (callerProfileId) {
      userIdMatch =
        targetStaff.linkedPersonaId === callerProfileId ||
        targetStaff.userId === callerProfileId;
    }
  }

  if (!codeMatch && !emailMatch && !userIdMatch) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden_not_invitee",
        messageAr: "غير مصرح لك بالرد على دعوة عمل تخص حساباً آخر.",
      },
      { status: 403 }
    );
  }

  const currentStatus = targetStaff.invitationStatus as string | undefined;
  if (currentStatus === "accepted" || currentStatus === "declined") {
    return NextResponse.json(
      {
        ok: false,
        error: "already_responded",
        messageAr: "تم الرد على هذه الدعوة مسبقاً.",
      },
      { status: 409 }
    );
  }

  if (
    currentStatus === "expired" ||
    currentStatus === "revoked" ||
    targetStaff.isActive === false ||
    isExpiredTimestamp(targetStaff.expiresAtIso) ||
    isExpiredTimestamp(targetStaff.expiresAt)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "invitation_inactive",
        messageAr: "هذه الدعوة منتهية الصلاحية أو ملغاة من إدارة المنشأة.",
      },
      { status: 410 }
    );
  }

  if (currentStatus !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error: "invitation_not_pending",
        messageAr: "لا يمكن الرد على هذه الدعوة لأنها ليست في حالة انتظار.",
      },
      { status: 409 }
    );
  }

  const typedDecision: InvitationDecision = decision;
  const nowIso = new Date().toISOString();

  // Strictly preserve server-assigned role; never accept role overrides from request body.
  const updatedStaff: StoredStaffRecord = {
    ...targetStaff,
    role: targetStaff.role,
    invitationStatus: typedDecision,
    respondedAtIso: nowIso,
    assignedDateAr:
      typedDecision === "accepted" ? "اليوم — دعوة مقبولة ✓" : "تم رفض الدعوة",
    ...(typedDecision === "accepted" ? { isActive: true } : {}),
    ...(!targetStaff.linkedMemberCode && callerCode
      ? { linkedMemberCode: callerCode }
      : {}),
  };

  const nextStaffMembers = staffMembers.map((st, idx) =>
    idx === targetIndex ? updatedStaff : st
  );

  const nextPayload: Partial<Facility> & Record<string, unknown> = {
    ...existingPayload,
    staffMembers: nextStaffMembers,
  };

  const persisted = await persistFacilityPayload(facilityId, nextPayload);
  if (!persisted) {
    return NextResponse.json(
      {
        ok: false,
        error: "persist_failed",
        messageAr: "تعذر حفظ الرد على الدعوة في قاعدة البيانات حالياً.",
      },
      { status: 500 }
    );
  }

  const safeFacilityResponse: Partial<Facility> & Record<string, unknown> = {
    ...nextPayload,
    staffMembers:
      caller.isAdmin || caller.linkedFacilityId === facilityId
        ? nextStaffMembers
        : [updatedStaff],
  };
  if (!caller.isAdmin && caller.linkedFacilityId !== facilityId) {
    delete safeFacilityResponse.ownerMemberCode;
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    facilityId,
    staffId,
    invitationStatus: typedDecision,
    facility: safeFacilityResponse,
  });
}
