import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";

export const OWNER_EMAIL = (process.env.CAPTENLY_OWNER_EMAIL || "").trim().toLowerCase();
export const PURGE_CUTOFF_ISO = "2026-11-15T17:35:00.000Z";

function isManualPurgeAuthorized(): boolean {
  return process.env.CAPTENLY_ENABLE_OWNER_PURGE === "true" && OWNER_EMAIL.includes("@");
}

function isEligibleForPurge(createdAtRaw: unknown, forceAll: boolean): boolean {
  if (!isManualPurgeAuthorized()) return false;
  if (forceAll) return true;
  if (typeof createdAtRaw !== "string" && !(createdAtRaw instanceof Date)) {
    return true;
  }
  const ts = new Date(createdAtRaw as string | Date).getTime();
  const cutoffTs = new Date(PURGE_CUTOFF_ISO).getTime();
  if (!Number.isFinite(ts) || !Number.isFinite(cutoffTs)) return false;
  return ts <= cutoffTs;
}

export async function purgeNonOwnerAccountsInDb(options?: {
  forceAll?: boolean;
}): Promise<{ ok: boolean; purgedProfiles: number }> {
  // Security remediation (F-002): fail closed unless explicit admin purge env guard is enabled.
  if (!isManualPurgeAuthorized()) {
    return { ok: false, purgedProfiles: 0 };
  }
  const forceAll = Boolean(options?.forceAll);
  let purgedCount = 0;
  let ranAny = false;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data: allProfiles, error: listErr } = await admin
        .from("captenly_profiles")
        .select("id, member_code, email, social_links, created_at");

      if (!listErr && Array.isArray(allProfiles)) {
        ranAny = true;
        let ownerCode = "";
        let ownerCoachId = "";
        const purgeCodes = new Set<string>();
        const purgeEmails = new Set<string>();
        const athleteIds = new Set<string>();
        const purgeCoachIds = new Set<string>();

        for (const row of allProfiles as Array<Record<string, unknown>>) {
          const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
          const code = typeof row.member_code === "string" ? row.member_code.trim().toUpperCase() : "";
          const social = (row.social_links || {}) as Record<string, unknown>;
          const linkedCoach =
            typeof social._linkedCoachId === "string" ? social._linkedCoachId.trim() : "";

          if (email === OWNER_EMAIL) {
            ownerCode = code;
            ownerCoachId = linkedCoach || (code ? getDeterministicCoachId(code) : "");
            continue;
          }

          if (!isEligibleForPurge(row.created_at, forceAll)) {
            continue;
          }

          purgedCount += 1;
          if (code) purgeCodes.add(code);
          if (email) purgeEmails.add(email);
          if (row.id) athleteIds.add(String(row.id));
          if (linkedCoach) purgeCoachIds.add(linkedCoach);
          if (code) purgeCoachIds.add(getDeterministicCoachId(code));
        }

        const codesArr = Array.from(purgeCodes);
        const emailsArr = Array.from(purgeEmails);

        if (codesArr.length > 0) {
          const { data: children } = await admin
            .from("captenly_minor_athletes")
            .select("id")
            .in("parent_member_code", codesArr);
          if (Array.isArray(children)) {
            for (const c of children) {
              if (c?.id) athleteIds.add(String(c.id));
            }
          }
        }

        const athleteArr = Array.from(athleteIds);

        if (codesArr.length > 0) {
          await admin.from("captenly_pb_records").delete().in("member_code", codesArr);
          await admin.from("captenly_skill_evaluations").delete().in("member_code", codesArr);
          await admin.from("captenly_minor_athletes").delete().in("parent_member_code", codesArr);
          await admin.from("captenly_user_prefs").delete().in("member_code", codesArr);
          await admin.from("captenly_notifications").delete().in("member_code", codesArr);
          await admin.from("captenly_role_claims").delete().in("applicant_member_code", codesArr);
          await admin.from("captenly_session_ledgers").delete().in("member_code", codesArr);
          await admin.from("captenly_leads").delete().in("member_code", codesArr);
          await admin.from("captenly_profiles").delete().in("member_code", codesArr);
        }
        if (athleteArr.length > 0) {
          await admin.from("captenly_pb_records").delete().in("athlete_id", athleteArr);
          await admin.from("captenly_skill_evaluations").delete().in("athlete_id", athleteArr);
          await admin.from("captenly_session_ledgers").delete().in("athlete_id", athleteArr);
        }
        if (emailsArr.length > 0) {
          await admin.from("captenly_role_claims").delete().in("applicant_email", emailsArr);
          await admin.from("captenly_profiles").delete().in("email", emailsArr);
        }

        // Also clean any non-owner coach rows up to cutoff (or all when forceAll)
        const { data: coachRows } = await admin
          .from("captenly_coaches")
          .select("id, payload, created_at");
        if (Array.isArray(coachRows)) {
          for (const cr of coachRows as Array<Record<string, unknown>>) {
            const cid = typeof cr.id === "string" ? cr.id : "";
            const payload = (cr.payload || {}) as Record<string, unknown>;
            const singleId =
              typeof payload.SingleCoachId === "string"
                ? payload.SingleCoachId.trim().toUpperCase()
                : "";
            const isOwnerCoach =
              (ownerCoachId && cid === ownerCoachId) || (ownerCode && singleId === ownerCode);
            if (isOwnerCoach) continue;

            if (purgeCoachIds.has(cid) || (singleId && purgeCodes.has(singleId)) || isEligibleForPurge(cr.created_at, forceAll)) {
              purgeCoachIds.add(cid);
            }
          }
          const coachIdsArr = Array.from(purgeCoachIds).filter(
            (id) => Boolean(id) && id !== ownerCoachId
          );
          if (coachIdsArr.length > 0) {
            await admin.from("captenly_coaches").delete().in("id", coachIdsArr);
          }
        }

        // Clean orphaned claims/prefs from deleted accounts up to cutoff (or all on forceAll)
        const { data: claimsRows } = await admin
          .from("captenly_role_claims")
          .select("id, applicant_member_code, applicant_email, created_at");
        if (Array.isArray(claimsRows)) {
          const orphanClaimIds = (claimsRows as Array<Record<string, unknown>>)
            .filter((r) => {
              const em = typeof r.applicant_email === "string" ? r.applicant_email.trim().toLowerCase() : "";
              const mc = typeof r.applicant_member_code === "string" ? r.applicant_member_code.trim().toUpperCase() : "";
              if (em === OWNER_EMAIL || (ownerCode && mc === ownerCode)) return false;
              return isEligibleForPurge(r.created_at, forceAll);
            })
            .map((r) => String(r.id));
          if (orphanClaimIds.length > 0) {
            await admin.from("captenly_role_claims").delete().in("id", orphanClaimIds);
          }
        }
      }
    } catch {
      // Fall through to PG client
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const safeExec = async (sql: string, params: unknown[]) => {
      try {
        return await client.query(sql, params);
      } catch {
        return null;
      }
    };

    const ownerLookup = await safeExec(
      `select member_code, social_links from public.captenly_profiles where lower(coalesce(email, '')) = $1 limit 1`,
      [OWNER_EMAIL]
    );
    const ownerRow = ownerLookup?.rows?.[0] as Record<string, unknown> | undefined;
    const ownerCode =
      typeof ownerRow?.member_code === "string" ? ownerRow.member_code.trim().toUpperCase() : "";
    const ownerSocial = (ownerRow?.social_links || {}) as Record<string, unknown>;
    const ownerCoachId =
      typeof ownerSocial._linkedCoachId === "string"
        ? ownerSocial._linkedCoachId.trim()
        : ownerCode
          ? getDeterministicCoachId(ownerCode)
          : "";

    const targetProfiles = await safeExec(
      forceAll
        ? `select id, member_code, email, social_links from public.captenly_profiles where lower(coalesce(email, '')) <> $1`
        : `select id, member_code, email, social_links from public.captenly_profiles where lower(coalesce(email, '')) <> $1 and (created_at is null or created_at <= $2::timestamptz)`,
      forceAll ? [OWNER_EMAIL] : [OWNER_EMAIL, PURGE_CUTOFF_ISO]
    );

    if (targetProfiles && targetProfiles.rows.length > 0) {
      const codes: string[] = [];
      const emails: string[] = [];
      const athleteIds: string[] = [];
      const coachIds: string[] = [];

      for (const r of targetProfiles.rows as Array<Record<string, unknown>>) {
        const mc = typeof r.member_code === "string" ? r.member_code.trim().toUpperCase() : "";
        const em = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
        const soc = (r.social_links || {}) as Record<string, unknown>;
        if (mc) {
          codes.push(mc);
          coachIds.push(getDeterministicCoachId(mc));
        }
        if (em) emails.push(em);
        if (r.id) athleteIds.push(String(r.id));
        if (typeof soc._linkedCoachId === "string" && soc._linkedCoachId.trim()) {
          coachIds.push(soc._linkedCoachId.trim());
        }
      }

      if (codes.length > 0) {
        const childRes = await safeExec(
          `select id from public.captenly_minor_athletes where upper(parent_member_code) = any($1::text[])`,
          [codes]
        );
        for (const cr of (childRes?.rows || []) as Array<Record<string, unknown>>) {
          if (cr.id) athleteIds.push(String(cr.id));
        }

        await safeExec(`delete from public.captenly_pb_records where upper(member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_skill_evaluations where upper(member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_minor_athletes where upper(parent_member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_user_prefs where upper(member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_notifications where upper(member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_role_claims where upper(applicant_member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_session_ledgers where upper(member_code) = any($1::text[])`, [codes]);
        await safeExec(`delete from public.captenly_leads where upper(member_code) = any($1::text[])`, [codes]);
      }

      if (athleteIds.length > 0) {
        await safeExec(`delete from public.captenly_pb_records where athlete_id = any($1::text[])`, [athleteIds]);
        await safeExec(`delete from public.captenly_skill_evaluations where athlete_id = any($1::text[])`, [athleteIds]);
        await safeExec(`delete from public.captenly_session_ledgers where athlete_id = any($1::text[])`, [athleteIds]);
      }

      if (emails.length > 0) {
        await safeExec(`delete from public.captenly_role_claims where lower(applicant_email) = any($1::text[])`, [emails]);
      }

      const filteredCoachIds = coachIds.filter((id) => id && id !== ownerCoachId);
      if (filteredCoachIds.length > 0) {
        await safeExec(`delete from public.captenly_coaches where id = any($1::text[])`, [filteredCoachIds]);
      }

      const delProfiles = await safeExec(
        forceAll
          ? `delete from public.captenly_profiles where lower(coalesce(email, '')) <> $1`
          : `delete from public.captenly_profiles where lower(coalesce(email, '')) <> $1 and (created_at is null or created_at <= $2::timestamptz)`,
        forceAll ? [OWNER_EMAIL] : [OWNER_EMAIL, PURGE_CUTOFF_ISO]
      );
      if (delProfiles && typeof delProfiles.rowCount === "number") {
        purgedCount = Math.max(purgedCount, delProfiles.rowCount);
      }
    }

    // Remove any non-owner coach rows & orphaned role claims up to cutoff (or all on forceAll)
    if (forceAll) {
      await safeExec(
        `delete from public.captenly_coaches where ($1 = '' or id <> $1) and ($2 = '' or upper(coalesce(payload->>'SingleCoachId', '')) <> $2)`,
        [ownerCoachId, ownerCode]
      );
      await safeExec(
        `delete from public.captenly_role_claims where lower(coalesce(applicant_email, '')) <> $1 and ($2 = '' or upper(coalesce(applicant_member_code, '')) <> $2)`,
        [OWNER_EMAIL, ownerCode]
      );
      await safeExec(
        `delete from public.captenly_user_prefs where ($1 = '' or upper(member_code) <> $1)`,
        [ownerCode]
      );
    } else {
      await safeExec(
        `delete from public.captenly_coaches where ($1 = '' or id <> $1) and ($2 = '' or upper(coalesce(payload->>'SingleCoachId', '')) <> $2) and (created_at is null or created_at <= $3::timestamptz)`,
        [ownerCoachId, ownerCode, PURGE_CUTOFF_ISO]
      );
      await safeExec(
        `delete from public.captenly_role_claims where lower(coalesce(applicant_email, '')) <> $1 and ($2 = '' or upper(coalesce(applicant_member_code, '')) <> $2) and (created_at is null or created_at <= $3::timestamptz)`,
        [OWNER_EMAIL, ownerCode, PURGE_CUTOFF_ISO]
      );
      await safeExec(
        `delete from public.captenly_user_prefs where ($1 = '' or upper(member_code) <> $1) and (updated_at is null or updated_at <= $2::timestamptz)`,
        [ownerCode, PURGE_CUTOFF_ISO]
      );
    }

    return true;
  });

  if (pgRes.ok) ranAny = true;
  return { ok: ranAny, purgedProfiles: purgedCount };
}

export async function ensureSingleOwnerAccountBaseline(): Promise<void> {
  // Security remediation (F-002): automatic purge on requests is permanently disabled.
  return;
}
