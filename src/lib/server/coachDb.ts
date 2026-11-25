import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import {
  buildSelfRegisteredCoach,
  getDeterministicCoachId,
} from "@/lib/coachProvisioning";
import type { Coach, UserSocialLinks } from "@/types/captenly";

export async function findExistingCoachById(coachId: string): Promise<Coach | undefined> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("captenly_coaches")
      .select("payload")
      .eq("id", coachId)
      .limit(1);
    if (!error && Array.isArray(data) && data[0]?.payload) {
      return data[0].payload as Coach;
    }
  }

  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select payload from public.captenly_coaches where id = $1 limit 1`,
      [coachId]
    );
    return (rows[0] as { payload?: Coach } | undefined)?.payload;
  });
  return pg.ok ? pg.value : undefined;
}

/**
 * Ensures a user who selects role === "coach" has a live coach record in captenly_coaches immediately,
 * while preserving any existing verified badges/status if they are already verified.
 */
export async function ensureSelfRegisteredCoachInDb(input: {
  memberCode: string;
  fullNameAr: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bioAr?: string;
  socialLinks?: UserSocialLinks;
  linkedCoachId?: string;
}): Promise<Coach> {
  const coachId = input.linkedCoachId || getDeterministicCoachId(input.memberCode);
  const existing = await findExistingCoachById(coachId);

  const coachPayload = buildSelfRegisteredCoach(
    {
      id: `user-${input.memberCode}`,
      memberCode: input.memberCode,
      fullNameAr: input.fullNameAr,
      city: input.city || "كل مصر",
      phone: input.phone || "",
      email: input.email,
      avatarUrl: input.avatarUrl,
      bioAr: input.bioAr,
      socialLinks: input.socialLinks,
      linkedCoachId: coachId,
    },
    existing,
    input.governorate || "مصر"
  );

  const trustTier = coachPayload.isVerifiedCoach ? "verified_coach" : "self_registered";
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { error } = await admin.from("captenly_coaches").upsert(
      {
        id: coachPayload.id,
        slug: coachPayload.slug,
        full_name_ar: coachPayload.fullNameAr,
        city: coachPayload.city,
        sport_sector: "swimming",
        trust_tier: trustTier,
        rating: Number(coachPayload.rating ?? 0),
        reviews_count: Number(coachPayload.verifiedReviewsCount ?? 0),
        payload: coachPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (!error) return coachPayload;
  }

  await withPgClient(async (client) => {
    await client.query(
      `insert into public.captenly_coaches
        (id, slug, full_name_ar, city, sport_sector, trust_tier, rating, reviews_count, payload, updated_at)
       values ($1,$2,$3,$4,'swimming',$5,$6,$7,$8::jsonb,now())
       on conflict (id) do update set
        full_name_ar = excluded.full_name_ar,
        city = excluded.city,
        sport_sector = excluded.sport_sector,
        trust_tier = excluded.trust_tier,
        payload = excluded.payload,
        updated_at = now()`,
      [
        coachPayload.id,
        coachPayload.slug,
        coachPayload.fullNameAr,
        coachPayload.city,
        trustTier,
        Number(coachPayload.rating ?? 0),
        Number(coachPayload.verifiedReviewsCount ?? 0),
        JSON.stringify(coachPayload),
      ]
    );
    return true;
  });

  return coachPayload;
}

export async function deleteCoachByMemberOrIdInDb(params: {
  memberCode?: string;
  coachId?: string;
}) {
  const candidateIds = Array.from(
    new Set(
      [
        params.coachId,
        params.memberCode ? getDeterministicCoachId(params.memberCode) : undefined,
      ].filter((v): v is string => Boolean(v && v.trim()))
    )
  );
  if (candidateIds.length === 0) return;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      await admin.from("captenly_coaches").delete().in("id", candidateIds);
    } catch {
      // fall through
    }
  }
  await withPgClient(async (client) => {
    try {
      await client.query(`delete from public.captenly_coaches where id = any($1::text[])`, [candidateIds]);
    } catch {
      // ignore if table does not exist yet
    }
    return true;
  });
}
