import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import type { Facility, FacilityLinkedEntity } from "@/types/captenly";

let linksTableBootstrapped = false;

const CREATE_LINKS_STATEMENTS = [
  `create table if not exists public.captenly_facility_links (
    id text primary key,
    facility_id text not null,
    linked_coach_id text,
    linked_facility_id text,
    linked_member_code text,
    direction text not null default 'added_by_facility',
    status text not null default 'pending',
    can_scan_group_qr boolean not null default false,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists idx_captenly_facility_links_fac on public.captenly_facility_links (facility_id)`,
  `create index if not exists idx_captenly_facility_links_coach on public.captenly_facility_links (linked_coach_id)`,
  `create index if not exists idx_captenly_facility_links_code on public.captenly_facility_links (linked_member_code)`,
  `alter table public.captenly_facility_links enable row level security`,
];

export async function ensureFacilityLinksTable(): Promise<{ ok: boolean; errorCode?: string }> {
  if (linksTableBootstrapped) return { ok: true };
  const res = await withPgClient(async (client) => {
    for (const stmt of CREATE_LINKS_STATEMENTS) {
      await client.query(stmt);
    }
    linksTableBootstrapped = true;
    return true;
  });
  return res.ok ? { ok: true } : { ok: false, errorCode: res.errorCode };
}

export async function withFacilityLinksPg<T>(
  fn: (client: import("pg").Client) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; errorCode: string }> {
  const first = await withPgClient(fn);
  if (first.ok || first.errorCode !== "42P01") return first;
  await ensureFacilityLinksTable();
  return withPgClient(fn);
}

export function rowToFacilityLink(row: Record<string, unknown>): FacilityLinkedEntity | null {
  const payload = (row.payload || {}) as Partial<FacilityLinkedEntity>;
  const id = String(row.id || payload.id || "");
  const facilityId = String(row.facility_id || payload.facilityId || "");
  if (!id || !facilityId) return null;

  return {
    id,
    facilityId,
    facilityNameAr: payload.facilityNameAr || "",
    entityKind: payload.entityKind === "academy" ? "academy" : "coach",
    linkedCoachId: (row.linked_coach_id as string) || payload.linkedCoachId || undefined,
    linkedFacilityId: (row.linked_facility_id as string) || payload.linkedFacilityId || undefined,
    linkedMemberCode: (row.linked_member_code as string) || payload.linkedMemberCode || undefined,
    displayNameAr: payload.displayNameAr || "أكاديمية / كابتن",
    ownerNameAr: payload.ownerNameAr,
    phone: payload.phone,
    agreementType: payload.agreementType === "fixed_monthly" ? "fixed_monthly" : "per_swimmer_water",
    fixedMonthlyAmountEgp: payload.fixedMonthlyAmountEgp,
    customWaterFeePerSessionEgp: payload.customWaterFeePerSessionEgp,
    direction:
      (row.direction as FacilityLinkedEntity["direction"]) ||
      payload.direction ||
      "added_by_facility",
    status:
      (row.status as FacilityLinkedEntity["status"]) || payload.status || "pending",
    canScanGroupQr: Boolean(row.can_scan_group_qr ?? payload.canScanGroupQr),
    groupLabelAr: payload.groupLabelAr,
    swimmersCountEstimate: payload.swimmersCountEstimate,
    collectedMonthlyEgp: payload.collectedMonthlyEgp,
    createdAtAr: payload.createdAtAr || "اليوم",
    createdAtIso: payload.createdAtIso || new Date().toISOString(),
  };
}

export async function fetchFacilityLinksByFacilityId(
  facilityId: string
): Promise<FacilityLinkedEntity[]> {
  if (!facilityId) return [];
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_facility_links")
        .select("*")
        .eq("facility_id", facilityId)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!error && Array.isArray(data)) {
        return data
          .map((r) => rowToFacilityLink(r as Record<string, unknown>))
          .filter((x): x is FacilityLinkedEntity => Boolean(x));
      }
    } catch {
      // fall through
    }
  }

  const pgRes = await withFacilityLinksPg(async (client) => {
    const { rows } = await client.query(
      `select * from public.captenly_facility_links where facility_id = $1 order by updated_at desc limit 100`,
      [facilityId]
    );
    return (rows || [])
      .map((r) => rowToFacilityLink(r as Record<string, unknown>))
      .filter((x): x is FacilityLinkedEntity => Boolean(x));
  });
  return pgRes.ok ? pgRes.value : [];
}

/**
 * Checks authoritative delegated QR scan governance for a coach operating within a facility.
 * Returns `{ governed: false, canScan: true }` only if the coach is NOT tied under any host link
 * (e.g. standalone coach private ledger outside host-club restriction).
 */
export async function checkCoachDelegatedQrAccess(params: {
  facilityId: string;
  coachId?: string;
  memberCode?: string;
  ledgerLinkedEntityId?: string;
}): Promise<{ governed: boolean; canScan: boolean; matchedLink?: FacilityLinkedEntity }> {
  if (!params.facilityId) return { governed: false, canScan: true };

  const links = await fetchFacilityLinksByFacilityId(params.facilityId);
  let facilityLinks: FacilityLinkedEntity[] = links;

  if (facilityLinks.length === 0) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      try {
        const { data } = await admin
          .from("captenly_facilities")
          .select("payload")
          .eq("id", params.facilityId)
          .limit(1);
        const row = Array.isArray(data) ? (data[0] as { payload?: Partial<Facility> } | undefined) : undefined;
        facilityLinks = row?.payload?.poolDeskConfig?.linkedEntities || [];
      } catch {
        // ignore
      }
    }
  }

  const codeUpper = (params.memberCode || "").trim().toUpperCase();
  const matched = facilityLinks.find((l) => {
    if (params.ledgerLinkedEntityId && l.id === params.ledgerLinkedEntityId) return true;
    if (params.coachId && l.linkedCoachId && l.linkedCoachId === params.coachId) return true;
    if (codeUpper && l.linkedMemberCode && l.linkedMemberCode.toUpperCase() === codeUpper) return true;
    return false;
  });

  if (!matched) {
    // If ledger explicitly specifies a linkedEntityId belonging to a different group, block!
    if (params.ledgerLinkedEntityId && facilityLinks.some((l) => l.id === params.ledgerLinkedEntityId)) {
      return { governed: true, canScan: false };
    }
    return { governed: false, canScan: true };
  }

  return {
    governed: true,
    canScan: matched.status === "approved" && Boolean(matched.canScanGroupQr),
    matchedLink: matched,
  };
}
