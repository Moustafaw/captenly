import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getCallerFacilityAccessRole,
  getServerCaller,
  hasFacilityStaffAccess,
  sanitizeFilterToken,
} from "@/lib/memberSession";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import {
  fetchFacilityLinksByFacilityId,
  rowToFacilityLink,
  withFacilityLinksPg,
} from "@/lib/server/facilityLinksDb";
import type { AcademyAgreementType, Facility, FacilityLinkedEntity } from "@/types/captenly";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

async function upsertFacilityLinkRow(link: FacilityLinkedEntity): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  const row = {
    id: link.id,
    facility_id: link.facilityId,
    linked_coach_id: link.linkedCoachId || null,
    linked_facility_id: link.linkedFacilityId || null,
    linked_member_code: link.linkedMemberCode ? link.linkedMemberCode.toUpperCase() : null,
    direction: link.direction,
    status: link.status,
    can_scan_group_qr: Boolean(link.canScanGroupQr),
    payload: link,
    updated_at: new Date().toISOString(),
  };

  if (admin) {
    const { error } = await admin.from("captenly_facility_links").upsert(row, { onConflict: "id" });
    if (!error) return { ok: true };
  }

  const pgRes = await withFacilityLinksPg(async (client) => {
    await client.query(
      `insert into public.captenly_facility_links
        (id, facility_id, linked_coach_id, linked_facility_id, linked_member_code, direction, status, can_scan_group_qr, payload, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
       on conflict (id) do update set
         linked_coach_id = excluded.linked_coach_id,
         linked_facility_id = excluded.linked_facility_id,
         linked_member_code = excluded.linked_member_code,
         status = excluded.status,
         can_scan_group_qr = excluded.can_scan_group_qr,
         payload = excluded.payload,
         updated_at = now()`,
      [
        row.id,
        row.facility_id,
        row.linked_coach_id,
        row.linked_facility_id,
        row.linked_member_code,
        row.direction,
        row.status,
        row.can_scan_group_qr,
        JSON.stringify(link),
      ]
    );
    return true;
  });

  return pgRes.ok ? { ok: true } : { ok: false, error: pgRes.errorCode };
}

async function mirrorLinksIntoFacilityPayload(facilityId: string): Promise<void> {
  const links = await fetchFacilityLinksByFacilityId(facilityId);
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("captenly_facilities")
        .select("payload")
        .eq("id", facilityId)
        .limit(1);
      const row = Array.isArray(data)
        ? (data[0] as { payload?: Facility } | undefined)
        : undefined;
      if (row?.payload) {
        const nextPayload: Facility = {
          ...row.payload,
          poolDeskConfig: {
            waterFeePerSessionEgp: row.payload.poolDeskConfig?.waterFeePerSessionEgp ?? 0,
            allowOpenManualDiscount: row.payload.poolDeskConfig?.allowOpenManualDiscount ?? true,
            openDiscountReasonsAr: row.payload.poolDeskConfig?.openDiscountReasonsAr,
            promoCodes: row.payload.poolDeskConfig?.promoCodes || [],
            linkedEntities: links,
            lastUpdatedIso: new Date().toISOString(),
            lastShiftPreppedAtIso: row.payload.poolDeskConfig?.lastShiftPreppedAtIso,
          },
        };
        await admin
          .from("captenly_facilities")
          .update({ payload: nextPayload, updated_at: new Date().toISOString() })
          .eq("id", facilityId);
      }
      return;
    } catch {
      // ignore mirror failures
    }
  }
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, links: [], reason: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const facilityId = sanitizeFilterToken(searchParams.get("facilityId") || "");
  const coachId = sanitizeFilterToken(searchParams.get("coachId") || "");
  const memberCode = sanitizeFilterToken(searchParams.get("memberCode") || "").toUpperCase();
  const linkedFacilityId = sanitizeFilterToken(searchParams.get("linkedFacilityId") || "");

  if (!caller.isAdmin) {
    if (facilityId && !(await hasFacilityStaffAccess(facilityId, caller))) {
      return NextResponse.json({ ok: false, links: [], reason: "forbidden" }, { status: 403 });
    }
    const callerCoachId =
      caller.linkedCoachId || (caller.memberCode ? getDeterministicCoachId(caller.memberCode) : "");
    if (coachId && coachId !== callerCoachId) {
      return NextResponse.json({ ok: false, links: [], reason: "forbidden" }, { status: 403 });
    }
    if (memberCode && (!caller.memberCode || caller.memberCode.toUpperCase() !== memberCode)) {
      return NextResponse.json({ ok: false, links: [], reason: "forbidden" }, { status: 403 });
    }
    if (linkedFacilityId && !(await hasFacilityStaffAccess(linkedFacilityId, caller))) {
      return NextResponse.json({ ok: false, links: [], reason: "forbidden" }, { status: 403 });
    }
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const orClauses: string[] = [];
      if (facilityId) orClauses.push(`facility_id.eq.${facilityId}`);
      if (coachId) orClauses.push(`linked_coach_id.eq.${coachId}`);
      if (memberCode) orClauses.push(`linked_member_code.ilike.${memberCode}`);
      if (linkedFacilityId) orClauses.push(`linked_facility_id.eq.${linkedFacilityId}`);

      let q = admin
        .from("captenly_facility_links")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (orClauses.length > 0) {
        q = q.or(orClauses.join(","));
      }
      const { data, error } = await q;
      if (!error && Array.isArray(data)) {
        const links = data
          .map((r) => rowToFacilityLink(r as Record<string, unknown>))
          .filter((x): x is FacilityLinkedEntity => Boolean(x));
        return NextResponse.json({ ok: true, links }, { headers: NO_STORE_HEADERS });
      }
    } catch {
      // fall through
    }
  }

  const pgRes = await withFacilityLinksPg(async (client) => {
    const conds: string[] = [];
    const vals: string[] = [];
    if (facilityId) {
      vals.push(facilityId);
      conds.push(`facility_id = $${vals.length}`);
    }
    if (coachId) {
      vals.push(coachId);
      conds.push(`linked_coach_id = $${vals.length}`);
    }
    if (memberCode) {
      vals.push(memberCode);
      conds.push(`upper(linked_member_code) = upper($${vals.length})`);
    }
    if (linkedFacilityId) {
      vals.push(linkedFacilityId);
      conds.push(`linked_facility_id = $${vals.length}`);
    }
    const where = conds.length > 0 ? `where ${conds.join(" or ")}` : "";
    const { rows } = await client.query(
      `select * from public.captenly_facility_links ${where} order by updated_at desc limit 100`,
      vals
    );
    return (rows || [])
      .map((r) => rowToFacilityLink(r as Record<string, unknown>))
      .filter((x): x is FacilityLinkedEntity => Boolean(x));
  });

  return NextResponse.json(
    { ok: pgRes.ok, links: pgRes.ok ? pgRes.value : [] },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || "request_link");
    const facilityId = sanitizeFilterToken(String(body?.facilityId || ""));
    if (!facilityId) {
      return NextResponse.json({ ok: false, error: "missing_facility" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (action === "request_link") {
      const entityKind = body?.entityKind === "academy" ? "academy" : "coach";
      const displayNameAr = String(body?.displayNameAr || "").trim();
      if (!displayNameAr) {
        return NextResponse.json(
          { ok: false, messageAr: "يرجى كتابة اسم الأكاديمية أو الكابتن في طلب الربط." },
          { status: 400 }
        );
      }

      const derivedCoachId =
        caller.linkedCoachId ||
        (caller.role === "coach" && caller.memberCode
          ? getDeterministicCoachId(caller.memberCode)
          : undefined);
      const link: FacilityLinkedEntity = {
        id: `link-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
        facilityId,
        facilityNameAr: String(body?.facilityNameAr || "").trim(),
        entityKind,
        linkedCoachId: entityKind === "coach" ? derivedCoachId : undefined,
        linkedFacilityId: entityKind === "academy" ? caller.linkedFacilityId : undefined,
        linkedMemberCode: caller.memberCode ? caller.memberCode.toUpperCase() : undefined,
        displayNameAr,
        ownerNameAr: String(body?.ownerNameAr || "").trim() || undefined,
        phone: String(body?.phone || caller.phone || "").trim() || undefined,
        agreementType:
          body?.agreementType === "fixed_monthly" ? "fixed_monthly" : "per_swimmer_water",
        fixedMonthlyAmountEgp:
          body?.agreementType === "fixed_monthly"
            ? Math.max(0, Number(body?.fixedMonthlyAmountEgp || 0))
            : undefined,
        direction: "requested_by_entity",
        status: "pending", // Server-forced safe default
        canScanGroupQr: false, // Server-forced safe default
        groupLabelAr: String(body?.groupLabelAr || "").trim() || undefined,
        swimmersCountEstimate: Math.max(0, Number(body?.swimmersCountEstimate || 0)) || undefined,
        createdAtAr: "اليوم — طلب ربط جديد",
        createdAtIso: nowIso,
      };

      const saved = await upsertFacilityLinkRow(link);
      if (!saved.ok) {
        return NextResponse.json(
          { ok: false, error: saved.error, messageAr: "تعذر إرسال طلب الربط حالياً." },
          { status: 500 }
        );
      }
      await mirrorLinksIntoFacilityPayload(facilityId);
      return NextResponse.json({
        ok: true,
        link,
        messageAr: `تم إرسال طلب الربط إلى «${link.facilityNameAr || "النادي المضيف"}» بنجاح وفي انتظار موافقة الإدارة ✓`,
      });
    }

    if (action === "add_direct") {
      const accessRole = await getCallerFacilityAccessRole(facilityId, caller);
      if (
        !caller.isAdmin &&
        accessRole !== "owner" &&
        accessRole !== "general_staff" &&
        accessRole !== "accounts_manager"
      ) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const displayNameAr = String(body?.displayNameAr || "").trim();
      if (!displayNameAr) {
        return NextResponse.json(
          { ok: false, messageAr: "يرجى إدخال اسم الأكاديمية أو الكابتن." },
          { status: 400 }
        );
      }

      const agreementType: AcademyAgreementType =
        body?.agreementType === "fixed_monthly" ? "fixed_monthly" : "per_swimmer_water";

      const link: FacilityLinkedEntity = {
        id: String(body?.id || `link-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`),
        facilityId,
        facilityNameAr: String(body?.facilityNameAr || "").trim(),
        entityKind: body?.entityKind === "coach" ? "coach" : "academy",
        linkedCoachId: body?.linkedCoachId ? String(body.linkedCoachId) : undefined,
        linkedFacilityId: body?.linkedFacilityId ? String(body.linkedFacilityId) : undefined,
        linkedMemberCode: body?.linkedMemberCode
          ? String(body.linkedMemberCode).trim().toUpperCase()
          : undefined,
        displayNameAr,
        ownerNameAr: String(body?.ownerNameAr || "").trim() || undefined,
        phone: String(body?.phone || "").trim() || undefined,
        agreementType,
        fixedMonthlyAmountEgp:
          agreementType === "fixed_monthly"
            ? Math.max(0, Number(body?.fixedMonthlyAmountEgp || 0))
            : undefined,
        customWaterFeePerSessionEgp:
          body?.customWaterFeePerSessionEgp !== undefined && body?.customWaterFeePerSessionEgp !== ""
            ? Math.max(0, Number(body.customWaterFeePerSessionEgp))
            : undefined,
        direction: "added_by_facility",
        status: "approved",
        canScanGroupQr: Boolean(body?.canScanGroupQr),
        groupLabelAr: String(body?.groupLabelAr || "").trim() || undefined,
        swimmersCountEstimate: Math.max(0, Number(body?.swimmersCountEstimate || 0)) || undefined,
        createdAtAr: "اليوم — مضاف من المنشأة",
        createdAtIso: nowIso,
      };

      const saved = await upsertFacilityLinkRow(link);
      if (!saved.ok) {
        return NextResponse.json(
          { ok: false, error: saved.error, messageAr: "تعذر حفظ بيانات الأكاديمية / الكابتن." },
          { status: 500 }
        );
      }
      await mirrorLinksIntoFacilityPayload(facilityId);
      return NextResponse.json({
        ok: true,
        link,
        messageAr: `تمت إضافة وربط «${displayNameAr}» بالمنشأة بنجاح ✓`,
      });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const linkId = sanitizeFilterToken(String(body?.id || ""));
    const facilityId = sanitizeFilterToken(String(body?.facilityId || ""));
    if (!linkId || !facilityId) {
      return NextResponse.json({ ok: false, error: "missing_ids" }, { status: 400 });
    }

    const accessRole = await getCallerFacilityAccessRole(facilityId, caller);
    if (!caller.isAdmin && accessRole !== "owner" && accessRole !== "general_staff") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const existingList = await fetchFacilityLinksByFacilityId(facilityId);
    const existing = existingList.find((l) => l.id === linkId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const nextStatus =
      body?.status === "approved" || body?.status === "rejected" || body?.status === "pending"
        ? body.status
        : existing.status;
    const nextAgreement: AcademyAgreementType =
      body?.agreementType === "fixed_monthly" || body?.agreementType === "per_swimmer_water"
        ? body.agreementType
        : existing.agreementType;

    const updated: FacilityLinkedEntity = {
      ...existing,
      status: nextStatus,
      agreementType: nextAgreement,
      fixedMonthlyAmountEgp:
        nextAgreement === "fixed_monthly"
          ? Math.max(0, Number(body?.fixedMonthlyAmountEgp ?? existing.fixedMonthlyAmountEgp ?? 0))
          : undefined,
      customWaterFeePerSessionEgp:
        body?.customWaterFeePerSessionEgp !== undefined
          ? Math.max(0, Number(body.customWaterFeePerSessionEgp))
          : existing.customWaterFeePerSessionEgp,
      canScanGroupQr:
        typeof body?.canScanGroupQr === "boolean"
          ? nextStatus === "approved" && body.canScanGroupQr
          : existing.canScanGroupQr,
      collectedMonthlyEgp:
        body?.collectedMonthlyEgp !== undefined
          ? Math.max(0, Number(body.collectedMonthlyEgp))
          : existing.collectedMonthlyEgp,
    };

    const saved = await upsertFacilityLinkRow(updated);
    if (!saved.ok) {
      return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
    }
    await mirrorLinksIntoFacilityPayload(facilityId);

    return NextResponse.json({
      ok: true,
      link: updated,
      messageAr:
        typeof body?.canScanGroupQr === "boolean"
          ? updated.canScanGroupQr
            ? `تم تفويض «${updated.displayNameAr}» بمسح QR سبّاحي مجموعته فقط ✓`
            : `تم قصر المسح على بوابة المنشأة لـ «${updated.displayNameAr}»`
          : updated.status === "approved"
          ? `تم قبول واعتماد ربط «${updated.displayNameAr}» ✓`
          : `تم تحديث حالة «${updated.displayNameAr}»`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
}
