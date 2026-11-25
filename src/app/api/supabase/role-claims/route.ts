import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller } from "@/lib/memberSession";
import { findExistingCoachById } from "@/lib/server/coachDb";
import { enforceRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/server/rateLimit";
import type { Coach, Facility, MemberRoleClaim, RoleClaimStatus } from "@/types/captenly";

export const dynamic = "force-dynamic";

const MEDICAL_KEYWORDS = [
  "علاج طبيعي",
  "علاج طبي",
  "تأهيل طبي",
  "تشخيص",
  "وصفة طبية",
  "إصابات ملاعب طبي",
  "استشفاء طبي",
  "علاج الديسك",
  "علاج العمود الفقري",
  "rehabilitation therapy",
  "medical therapy",
];

function containsProhibitedMedicalWording(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function mapClaimRow(row: Record<string, unknown>): MemberRoleClaim {
  return {
    id: String(row.id || ""),
    applicantMemberCode: String(row.applicant_member_code || ""),
    applicantNameAr: String(row.applicant_name_ar || ""),
    applicantPhone: String(row.applicant_phone || ""),
    applicantEmail: typeof row.applicant_email === "string" && row.applicant_email ? row.applicant_email : undefined,
    claimType: row.claim_type === "facility" ? "facility" : "coach",
    targetFacilityId: typeof row.target_facility_id === "string" && row.target_facility_id ? row.target_facility_id : undefined,
    targetFacilityNameAr:
      typeof row.target_facility_name_ar === "string" && row.target_facility_name_ar
        ? row.target_facility_name_ar
        : undefined,
    cityAr: typeof row.city_ar === "string" && row.city_ar ? row.city_ar : undefined,
    governorateAr: typeof row.governorate_ar === "string" && row.governorate_ar ? row.governorate_ar : undefined,
    proofDocumentUrl:
      typeof row.proof_document_url === "string" && row.proof_document_url ? row.proof_document_url : undefined,
    proofNotesAr: typeof row.proof_notes_ar === "string" && row.proof_notes_ar ? row.proof_notes_ar : undefined,
    proposedPayload:
      row.proposed_payload && typeof row.proposed_payload === "object"
        ? (row.proposed_payload as Record<string, unknown>)
        : {},
    status: (row.status as RoleClaimStatus) || "pending_review",
    reviewerNoteAr: typeof row.reviewer_note_ar === "string" ? row.reviewer_note_ar : undefined,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function slugifyAscii(raw: string, fallbackPrefix: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = Math.floor(1000 + Math.random() * 8999);
  return cleaned ? `${cleaned}-${rand}` : `${fallbackPrefix}-${rand}`;
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ claims: [], error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "";
  const mineOnly = searchParams.get("mine") === "1" || !caller.isAdmin;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin
        .from("captenly_role_claims")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      if (mineOnly) {
        if (!caller.memberCode) return NextResponse.json({ claims: [], source: "supabase" });
        query = query.eq("applicant_member_code", caller.memberCode);
      }
      if (statusFilter && ["pending_review", "approved", "rejected", "withdrawn"].includes(statusFilter)) {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return NextResponse.json({
          claims: data.map((r) => mapClaimRow(r as Record<string, unknown>)),
          source: "supabase",
        });
      }
    } catch {
      // fallback to pg
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const params: unknown[] = [];
    const where: string[] = [];
    if (mineOnly) {
      if (!caller.memberCode) return [] as MemberRoleClaim[];
      params.push(caller.memberCode);
      where.push(`upper(applicant_member_code) = upper($${params.length})`);
    }
    if (statusFilter && ["pending_review", "approved", "rejected", "withdrawn"].includes(statusFilter)) {
      params.push(statusFilter);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
    const { rows } = await client.query(
      `select * from public.captenly_role_claims ${whereSql} order by created_at desc limit 120`,
      params
    );
    return rows.map((r) => mapClaimRow(r as Record<string, unknown>));
  });

  if (pgRes.ok) {
    return NextResponse.json({ claims: pgRes.value, source: "pg" });
  }

  return NextResponse.json({ claims: [], source: "local_fallback" });
}

export async function POST(request: Request) {
  const rl = await enforceRateLimit({
    bucket: "supabase:role-claims",
    identifier: getClientIp(request),
    limit: 20,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSec);
  }

  const caller = await getServerCaller();
  if (!caller.authenticated || !caller.memberCode) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", messageAr: "يجب تسجيل الدخول بحساب كابتنلي لتقديم طلب التوثيق." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const claimType = body.claimType === "facility" ? "facility" : "coach";
    const applicantNameAr = String(body.applicantNameAr || "").trim().slice(0, 120) || "عضو كابتنلي";
    const applicantPhone = String(body.applicantPhone || caller.phone || "").trim().slice(0, 40);
    const applicantEmail = String(body.applicantEmail || caller.email || "").trim().toLowerCase().slice(0, 120);
    const targetFacilityId =
      typeof body.targetFacilityId === "string" && body.targetFacilityId.trim()
        ? body.targetFacilityId.trim()
        : null;
    const targetFacilityNameAr =
      typeof body.targetFacilityNameAr === "string" && body.targetFacilityNameAr.trim()
        ? body.targetFacilityNameAr.trim().slice(0, 140)
        : null;
    const cityAr = typeof body.cityAr === "string" ? body.cityAr.trim().slice(0, 80) : "";
    const governorateAr = typeof body.governorateAr === "string" ? body.governorateAr.trim().slice(0, 80) : "";
    const rawDocUrl = typeof body.proofDocumentUrl === "string" ? body.proofDocumentUrl.trim() : "";
    const proofDocumentUrl =
      rawDocUrl.startsWith("https://") ||
      rawDocUrl.startsWith("http://") ||
      rawDocUrl.startsWith("data:image/")
        ? rawDocUrl.slice(0, 1_500_000)
        : null;
    const proofNotesAr = typeof body.proofNotesAr === "string" ? body.proofNotesAr.trim().slice(0, 1200) : null;
    const proposedPayload =
      body.proposedPayload && typeof body.proposedPayload === "object"
        ? (body.proposedPayload as Record<string, unknown>)
        : {};

    if (claimType === "coach") {
      const bio = typeof proposedPayload.bioAr === "string" ? proposedPayload.bioAr : "";
      if (containsProhibitedMedicalWording(bio)) {
        return NextResponse.json(
          {
            ok: false,
            error: "law_3_1985_prohibited_medical_claims",
            messageAr: "مخالف لقانون 3 لسنة 1985: يُمنع إدراج مصطلحات العلاج الطبي أو التأهيل الطبي بدون ترخيص علاج طبيعي موثق.",
          },
          { status: 400 }
        );
      }
    }

    const id =
      typeof body.id === "string" && body.id.trim().startsWith("claim-")
        ? body.id.trim()
        : `claim-${claimType}-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;

    const rowPayload = {
      id,
      applicant_member_code: caller.memberCode,
      applicant_name_ar: applicantNameAr,
      applicant_phone: applicantPhone,
      applicant_email: applicantEmail,
      claim_type: claimType,
      target_facility_id: targetFacilityId,
      target_facility_name_ar: targetFacilityNameAr,
      city_ar: cityAr || null,
      governorate_ar: governorateAr || null,
      proof_document_url: proofDocumentUrl,
      proof_notes_ar: proofNotesAr,
      proposed_payload: proposedPayload,
      status: "pending_review" as const,
      updated_at: new Date().toISOString(),
    };

    const admin = getSupabaseAdminClient();
    if (admin) {
      // Avoid stacking multiple identical open pending claims per type for the same member
      const { data: existingPending } = await admin
        .from("captenly_role_claims")
        .select("id")
        .eq("applicant_member_code", caller.memberCode)
        .eq("claim_type", claimType)
        .eq("status", "pending_review")
        .limit(1);

      const targetId =
        Array.isArray(existingPending) && existingPending[0] && typeof existingPending[0].id === "string"
          ? existingPending[0].id
          : id;

      const { data, error } = await admin
        .from("captenly_role_claims")
        .upsert({ ...rowPayload, id: targetId }, { onConflict: "id" })
        .select("*")
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) {
        return NextResponse.json({
          ok: true,
          persisted: true,
          claim: mapClaimRow(data[0] as Record<string, unknown>),
        });
      }
    }

    const pgRes = await withPgClient(async (client) => {
      const existing = await client.query(
        `select id from public.captenly_role_claims
         where upper(applicant_member_code) = upper($1) and claim_type = $2 and status = 'pending_review'
         limit 1`,
        [caller.memberCode, claimType]
      );
      const targetId = existing.rows[0]?.id ? String(existing.rows[0].id) : id;
      const { rows } = await client.query(
        `insert into public.captenly_role_claims (
          id, applicant_member_code, applicant_name_ar, applicant_phone, applicant_email,
          claim_type, target_facility_id, target_facility_name_ar, city_ar, governorate_ar,
          proof_document_url, proof_notes_ar, proposed_payload, status, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,'pending_review',now())
        on conflict (id) do update set
          applicant_name_ar = excluded.applicant_name_ar,
          applicant_phone = excluded.applicant_phone,
          applicant_email = excluded.applicant_email,
          target_facility_id = excluded.target_facility_id,
          target_facility_name_ar = excluded.target_facility_name_ar,
          city_ar = excluded.city_ar,
          governorate_ar = excluded.governorate_ar,
          proof_document_url = excluded.proof_document_url,
          proof_notes_ar = excluded.proof_notes_ar,
          proposed_payload = excluded.proposed_payload,
          status = 'pending_review',
          updated_at = now()
        returning *`,
        [
          targetId,
          caller.memberCode,
          applicantNameAr,
          applicantPhone,
          applicantEmail,
          claimType,
          targetFacilityId,
          targetFacilityNameAr,
          cityAr || null,
          governorateAr || null,
          proofDocumentUrl,
          proofNotesAr,
          JSON.stringify(proposedPayload),
        ]
      );
      return rows[0] ? mapClaimRow(rows[0] as Record<string, unknown>) : null;
    });

    if (pgRes.ok && pgRes.value) {
      return NextResponse.json({ ok: true, persisted: true, claim: pgRes.value });
    }

    return NextResponse.json({
      ok: true,
      persisted: false,
      claim: mapClaimRow({ ...rowPayload, created_at: new Date().toISOString() }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
}

async function fetchClaimById(claimId: string): Promise<MemberRoleClaim | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_role_claims")
        .select("*")
        .eq("id", claimId)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) {
        return mapClaimRow(data[0] as Record<string, unknown>);
      }
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(`select * from public.captenly_role_claims where id = $1 limit 1`, [claimId]);
    return rows[0] ? mapClaimRow(rows[0] as Record<string, unknown>) : null;
  });
  return pg.ok ? pg.value : null;
}

async function insertApplicantNotification(memberCode: string, titleAr: string, messageAr: string, actionHref: string) {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      await admin.from("captenly_notifications").insert({
        member_code: memberCode,
        title_ar: titleAr,
        message_ar: messageAr,
        notif_type: "system",
        action_label_ar: "عرض اللوحة",
        action_href: actionHref,
        is_read: false,
      });
      return;
    } catch {
      // fall through
    }
  }
  await withPgClient(async (client) => {
    await client.query(
      `insert into public.captenly_notifications (member_code, title_ar, message_ar, notif_type, action_label_ar, action_href, is_read)
       values ($1, $2, $3, 'system', 'عرض اللوحة', $4, false)`,
      [memberCode, titleAr, messageAr, actionHref]
    );
    return true;
  });
}

async function applyApprovedClaimSideEffects(claim: MemberRoleClaim): Promise<{
  approvedCoachId?: string;
  approvedFacilityId?: string;
}> {
  const p = (claim.proposedPayload || {}) as Record<string, unknown>;
  const admin = getSupabaseAdminClient();

  if (claim.claimType === "coach") {
    const fullNameAr = String(p.fullNameAr || claim.applicantNameAr || "كابتن سباحة").trim();
    const coachId =
      typeof p.coachId === "string" && p.coachId.trim()
        ? p.coachId.trim()
        : `coach-${claim.applicantMemberCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const existingCoach = await findExistingCoachById(coachId);
    const singleCoachId =
      existingCoach?.SingleCoachId ||
      (typeof p.singleCoachId === "string" && p.singleCoachId.trim()
        ? p.singleCoachId.trim()
        : claim.applicantMemberCode || `CAP-ID-${Math.floor(1000 + Math.random() * 8999)}`);
    const slug =
      existingCoach?.slug ||
      (typeof p.slug === "string" && p.slug.trim() ? p.slug.trim() : slugifyAscii("coach", "coach"));

    const verifiedBadge: Coach["badges"][number] = {
      code: "BADGE_01_IDENTITY",
      titleAr: "هوية مدرب موثقة",
      authorityAr: "مراجعة فريق كابتنلي",
      verifiedDate: new Date().toISOString().slice(0, 10),
      status: "active",
      descriptionAr: "تم التحقق من بطاقة الهوية ومستندات التدريب.",
    };
    const mergedBadges = existingCoach?.badges?.some((b) => b.code === "BADGE_01_IDENTITY")
      ? existingCoach.badges
      : [verifiedBadge, ...(existingCoach?.badges || [])];

    const coachPayload: Coach = {
      id: coachId,
      slug,
      SingleCoachId: singleCoachId,
      fullNameAr: fullNameAr || existingCoach?.fullNameAr || "كابتن سباحة",
      titleAr: String(p.titleAr || existingCoach?.titleAr || "كابتن سباحة موثق"),
      sportSector: "swimming",
      governorate: claim.governorateAr || String(p.governorate || existingCoach?.governorate || "مصر"),
      city: claim.cityAr || String(p.city || existingCoach?.city || "كل مصر"),
      district: String(p.district || existingCoach?.district || ""),
      yearsExperience: Number(p.yearsExperience ?? existingCoach?.yearsExperience ?? 0),
      bioAr: String(p.bioAr || existingCoach?.bioAr || ""),
      avatarUrl: String(p.avatarUrl || existingCoach?.avatarUrl || ""),
      whatsappNumber: claim.applicantPhone || String(p.whatsappNumber || existingCoach?.whatsappNumber || ""),
      facebookUrl: existingCoach?.facebookUrl,
      instagramUrl: existingCoach?.instagramUrl,
      socialLinks: existingCoach?.socialLinks,
      sessionOffers: existingCoach?.sessionOffers,
      instapayHandle: String(p.instapayHandle || existingCoach?.instapayHandle || ""),
      privatePackage8Egp: Number(p.privatePackage8Egp ?? existingCoach?.privatePackage8Egp ?? 0),
      privatePackage12Egp: Number(p.privatePackage12Egp ?? existingCoach?.privatePackage12Egp ?? 0),
      subscriptionTier: existingCoach?.subscriptionTier || "free_founding",
      commissionRate: 0,
      qrCodeToken: existingCoach?.qrCodeToken || `CAP-COACH-${singleCoachId}`,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "موثق عبر كابتنلي",
      rating: existingCoach?.rating ?? 0,
      verifiedReviewsCount: existingCoach?.verifiedReviewsCount ?? 0,
      activeAthletesCount: existingCoach?.activeAthletesCount ?? 0,
      isVerifiedCoach: true,
      badges: mergedBadges,
      specialties: Array.isArray(p.specialties)
        ? (p.specialties as Coach["specialties"])
        : existingCoach?.specialties?.length
          ? existingCoach.specialties
          : [{ nameAr: "تعليم السباحة", credibilityTier: "reviewed_qualification" }],
      affiliations: existingCoach?.affiliations || [],
    };

    if (admin) {
      await admin.from("captenly_coaches").upsert(
        {
          id: coachId,
          slug: coachPayload.slug,
          full_name_ar: coachPayload.fullNameAr,
          city: coachPayload.city,
          sport_sector: "swimming",
          trust_tier: "verified_coach",
          rating: Number(coachPayload.rating ?? 0),
          reviews_count: Number(coachPayload.verifiedReviewsCount ?? 0),
          payload: coachPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      const { data: profRows } = await admin
        .from("captenly_profiles")
        .select("role, social_links")
        .eq("member_code", claim.applicantMemberCode)
        .limit(1);
      const existingProf = Array.isArray(profRows) ? (profRows[0] as Record<string, unknown> | undefined) : undefined;
      const existingLinks =
        existingProf?.social_links && typeof existingProf.social_links === "object"
          ? (existingProf.social_links as Record<string, unknown>)
          : {};
      await admin
        .from("captenly_profiles")
        .update({
          role: existingProf?.role === "super_admin" ? "super_admin" : "coach",
          social_links: { ...existingLinks, _linkedCoachId: coachId },
          updated_at: new Date().toISOString(),
        })
        .eq("member_code", claim.applicantMemberCode);
    } else {
      await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_coaches
            (id, slug, full_name_ar, city, sport_sector, trust_tier, rating, reviews_count, payload, updated_at)
           values ($1,$2,$3,$4,'swimming','verified_coach',$5,$6,$7::jsonb,now())
           on conflict (id) do update set
            full_name_ar = excluded.full_name_ar,
            city = excluded.city,
            trust_tier = excluded.trust_tier,
            rating = excluded.rating,
            reviews_count = excluded.reviews_count,
            payload = excluded.payload,
            updated_at = now()`,
          [
            coachId,
            coachPayload.slug,
            coachPayload.fullNameAr,
            coachPayload.city,
            Number(coachPayload.rating ?? 0),
            Number(coachPayload.verifiedReviewsCount ?? 0),
            JSON.stringify(coachPayload),
          ]
        );
        await client.query(
          `update public.captenly_profiles set
             role = case when role = 'super_admin' then 'super_admin' else 'coach' end,
             social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object('_linkedCoachId', $2::text),
             updated_at = now()
           where upper(member_code) = upper($1)`,
          [claim.applicantMemberCode, coachId]
        );
        return true;
      });
    }

    await insertApplicantNotification(
      claim.applicantMemberCode,
      "تمت الموافقة على اعتمادك ككابتن موثق",
      "اعتمدت إدارة كابتنلي مستنداتك! يمكنك الآن التبديل إلى لوحة الكابتن من الشريط العلوي مع الحفاظ على حسابك الشخصي والعائلي.",
      "/dashboard/coach"
    );

    return { approvedCoachId: coachId };
  }

  // Facility claim approval
  const facilityId =
    claim.targetFacilityId ||
    (typeof p.facilityId === "string" && p.facilityId.trim() ? p.facilityId.trim() : `fac-${Date.now()}`);
  const facilityNameAr = claim.targetFacilityNameAr || String(p.nameAr || "أكاديمية سباحة موثقة");

  let existingFacRow: Record<string, unknown> | undefined;
  if (admin) {
    const { data } = await admin.from("captenly_facilities").select("*").eq("id", facilityId).limit(1);
    existingFacRow = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  } else {
    const pg = await withPgClient(async (client) => {
      const { rows } = await client.query(`select * from public.captenly_facilities where id = $1 limit 1`, [facilityId]);
      return rows[0] as Record<string, unknown> | undefined;
    });
    if (pg.ok) existingFacRow = pg.value;
  }

  const prevPayload =
    existingFacRow?.payload && typeof existingFacRow.payload === "object"
      ? (existingFacRow.payload as Partial<Facility>)
      : {};
  const mergedFacility: Facility = {
    ...(prevPayload as Facility),
    id: facilityId,
    slug: String(existingFacRow?.slug || prevPayload.slug || slugifyAscii("academy", "academy")),
    nameAr: facilityNameAr,
    nameEn: String(p.nameEn || prevPayload.nameEn || facilityNameAr),
    facilityType: (p.facilityType as Facility["facilityType"]) || prevPayload.facilityType || "swimming_academy",
    isAcademyInHostClubs:
      typeof p.isAcademyInHostClubs === "boolean"
        ? p.isAcademyInHostClubs
        : prevPayload.isAcademyInHostClubs,
    sportSector: "swimming",
    governorate: claim.governorateAr || String(existingFacRow?.governorate || prevPayload.governorate || "كل مصر"),
    city: claim.cityAr || String(existingFacRow?.city || prevPayload.city || "كل مصر"),
    district: String(p.district || existingFacRow?.district || prevPayload.district || ""),
    addressAr: String(p.addressAr || existingFacRow?.address_ar || prevPayload.addressAr || ""),
    coordinates:
      (p.coordinates as Facility["coordinates"] | undefined) ||
      prevPayload.coordinates ||
      { lat: 30.0444, lng: 31.2357 },
    locations: Array.isArray(p.locations)
      ? (p.locations as Facility["locations"])
      : prevPayload.locations,
    whatsappNumber: claim.applicantPhone || String(p.whatsappNumber || prevPayload.whatsappNumber || ""),
    facebookUrl: String(p.facebookUrl || prevPayload.facebookUrl || "") || undefined,
    instagramUrl: String(p.instagramUrl || prevPayload.instagramUrl || "") || undefined,
    instapayHandle: String(p.instapayHandle || prevPayload.instapayHandle || ""),
    vodafoneCashNumber: String(p.vodafoneCashNumber || prevPayload.vodafoneCashNumber || ""),
    supplyStatus: "verified_active",
    subscriptionTier: prevPayload.subscriptionTier || "free_founding",
    isSponsored: Boolean(prevPayload.isSponsored),
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: "تم التوثيق والمراجعة",
    avgReplyMinutes: prevPayload.avgReplyMinutes ?? 0,
    completenessScore: Math.max(85, prevPayload.completenessScore ?? 85),
    rating: Number(existingFacRow?.rating ?? prevPayload.rating ?? 0),
    reviewsCount: Number(existingFacRow?.reviews_count ?? prevPayload.reviewsCount ?? 0),
    heroImage: String(p.heroImage || prevPayload.heroImage || ""),
    verifiedClaimDateAr: new Date().toLocaleDateString("ar-EG"),
    badges: Array.isArray(prevPayload.badges) && prevPayload.badges.length > 0
      ? prevPayload.badges
      : [
          {
            code: "BADGE_02_FACILITY",
            titleAr: "إدارة أكاديمية موثقة",
            authorityAr: "فريق التوثيق — كابتنلي",
            verifiedDate: new Date().toISOString().slice(0, 10),
            status: "active",
            descriptionAr: "تمت مطابقة مستندات الإدارة والتواصل الرسمي مع الأكاديمية.",
          },
        ],
    specialtiesAr: Array.isArray(p.specialtiesAr)
      ? (p.specialtiesAr as string[])
      : prevPayload.specialtiesAr || ["تعليم السباحة للأطفال والبالغين"],
    pricePackages: Array.isArray(p.pricePackages)
      ? (p.pricePackages as Facility["pricePackages"])
      : prevPayload.pricePackages || [],
    affiliatedCoachIds: Array.isArray(prevPayload.affiliatedCoachIds) ? prevPayload.affiliatedCoachIds : [],
    monthlyMetrics: prevPayload.monthlyMetrics || {
      profileViews: 1,
      comparisonAppearances: 0,
      verifiedWhatsappLeads: 0,
      activeSessionLedgers: 0,
    },
  };

  if (admin) {
    await admin.from("captenly_facilities").upsert(
      {
        id: facilityId,
        slug: mergedFacility.slug,
        name_ar: mergedFacility.nameAr,
        name_en: mergedFacility.nameEn,
        sport_sector: "swimming",
        supply_status: "verified_claimed",
        city: mergedFacility.city,
        district: mergedFacility.district,
        governorate: mergedFacility.governorate,
        address_ar: mergedFacility.addressAr,
        lat: mergedFacility.coordinates.lat,
        lng: mergedFacility.coordinates.lng,
        rating: mergedFacility.rating,
        reviews_count: mergedFacility.reviewsCount,
        whatsapp_phone: mergedFacility.whatsappNumber || null,
        payload: mergedFacility,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    const { data: profRows } = await admin
      .from("captenly_profiles")
      .select("role, social_links")
      .eq("member_code", claim.applicantMemberCode)
      .limit(1);
    const existingProf = Array.isArray(profRows) ? (profRows[0] as Record<string, unknown> | undefined) : undefined;
    const existingLinks =
      existingProf?.social_links && typeof existingProf.social_links === "object"
        ? (existingProf.social_links as Record<string, unknown>)
        : {};
    await admin
      .from("captenly_profiles")
      .update({
        role: existingProf?.role === "super_admin" ? "super_admin" : "facility_manager",
        social_links: { ...existingLinks, _linkedFacilityId: facilityId },
        updated_at: new Date().toISOString(),
      })
      .eq("member_code", claim.applicantMemberCode);
  } else {
    await withPgClient(async (client) => {
      await client.query(
        `insert into public.captenly_facilities (
          id, slug, name_ar, name_en, sport_sector, supply_status, city, district, governorate,
          address_ar, lat, lng, rating, reviews_count, whatsapp_phone, payload, updated_at
        ) values ($1,$2,$3,$4,'swimming','verified_claimed',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,now())
        on conflict (id) do update set
          name_ar = excluded.name_ar,
          supply_status = 'verified_claimed',
          whatsapp_phone = excluded.whatsapp_phone,
          payload = excluded.payload,
          updated_at = now()`,
        [
          facilityId,
          mergedFacility.slug,
          mergedFacility.nameAr,
          mergedFacility.nameEn,
          mergedFacility.city,
          mergedFacility.district,
          mergedFacility.governorate,
          mergedFacility.addressAr,
          mergedFacility.coordinates.lat,
          mergedFacility.coordinates.lng,
          mergedFacility.rating,
          mergedFacility.reviewsCount,
          mergedFacility.whatsappNumber || null,
          JSON.stringify(mergedFacility),
        ]
      );
      await client.query(
        `update public.captenly_profiles set
           role = case when role = 'super_admin' then 'super_admin' else 'facility_manager' end,
           social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object('_linkedFacilityId', $2::text),
           updated_at = now()
         where upper(member_code) = upper($1)`,
        [claim.applicantMemberCode, facilityId]
      );
      return true;
    });
  }

  await insertApplicantNotification(
    claim.applicantMemberCode,
    "تم توثيق إدارتك للأكاديمية بنجاح",
    `أصبحت الإدارة الكاملة لـ «${facilityNameAr}» مفعّلة في حسابك. يمكنك التبديل بين الحساب الشخصي ولوحة الأكاديمية في أي وقت.`,
    "/dashboard/facility"
  );

  return { approvedFacilityId: facilityId };
}

export async function PATCH(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      action?: "approve" | "reject" | "withdraw";
      reviewerNoteAr?: string;
    };
    const id = String(body.id || "").trim();
    const action = body.action;
    if (!id || (action !== "approve" && action !== "reject" && action !== "withdraw")) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const existing = await fetchClaimById(id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (action === "withdraw") {
      if (!caller.memberCode || existing.applicantMemberCode.toUpperCase() !== caller.memberCode.toUpperCase()) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (existing.status !== "pending_review") {
        return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 409 });
      }
      const admin = getSupabaseAdminClient();
      if (admin) {
        await admin
          .from("captenly_role_claims")
          .update({ status: "withdrawn", updated_at: new Date().toISOString() })
          .eq("id", id);
      } else {
        await withPgClient(async (client) => {
          await client.query(
            `update public.captenly_role_claims set status = 'withdrawn', updated_at = now() where id = $1`,
            [id]
          );
          return true;
        });
      }
      return NextResponse.json({ ok: true, claim: { ...existing, status: "withdrawn" } });
    }

    if (!caller.isAdmin) {
      return NextResponse.json(
        { ok: false, error: "admin_required", messageAr: "مراجعة واعتماد طلبات الأدوار متاحة للمشرف العام فقط." },
        { status: 403 }
      );
    }

    const nextStatus: RoleClaimStatus = action === "approve" ? "approved" : "rejected";
    const reviewerNoteAr =
      typeof body.reviewerNoteAr === "string" && body.reviewerNoteAr.trim()
        ? body.reviewerNoteAr.trim().slice(0, 600)
        : nextStatus === "approved"
          ? "تمت مراجعة المستندات والاعتماد من فريق كابتنلي."
          : "لم تستوفِ المستندات شروط التوثيق الحالية، يمكنك تعديلها وإعادة الإرسال.";
    const reviewerLabel = caller.email || caller.memberCode || "super_admin";
    const nowIso = new Date().toISOString();

    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin
        .from("captenly_role_claims")
        .update({
          status: nextStatus,
          reviewer_note_ar: reviewerNoteAr,
          reviewed_by: reviewerLabel,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", id);
    } else {
      await withPgClient(async (client) => {
        await client.query(
          `update public.captenly_role_claims
           set status = $2, reviewer_note_ar = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
           where id = $1`,
          [id, nextStatus, reviewerNoteAr, reviewerLabel]
        );
        return true;
      });
    }

    let approvedIds: { approvedCoachId?: string; approvedFacilityId?: string } = {};
    if (nextStatus === "approved") {
      approvedIds = await applyApprovedClaimSideEffects(existing);
    } else {
      await insertApplicantNotification(
        existing.applicantMemberCode,
        "تحديث بخصوص طلب التوثيق",
        reviewerNoteAr,
        "/claim"
      );
    }

    return NextResponse.json({
      ok: true,
      claim: {
        ...existing,
        status: nextStatus,
        reviewerNoteAr,
        reviewedBy: reviewerLabel,
        reviewedAt: nowIso,
      },
      ...approvedIds,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
}
