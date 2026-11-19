import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { attachMemberSessionCookie, getServerCaller } from "@/lib/memberSession";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import type { AccountRole, Facility, FacilityLocation, MemberRoleClaim } from "@/types/captenly";

export const dynamic = "force-dynamic";

function slugifyAscii(input: string, fallback = "facility"): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${ascii || fallback}-${Date.now().toString(36)}-${suffix}`;
}

function normalizePhoneWa(raw?: string): string | undefined {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `2${digits}`;
  return `20${digits}`;
}

function sanitizeLocations(raw: unknown): FacilityLocation[] {
  if (!Array.isArray(raw)) return [];
  const out: FacilityLocation[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object") continue;
    const coords = item.coordinates as { lat?: unknown; lng?: unknown } | undefined;
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const city = String(item.city || "").trim() || "القاهرة";
    const governorate =
      String(item.governorate || "").trim() || resolveGovernorateFromCity(city, "مصر");
    const district = String(item.district || "").trim();
    const streetAr = String(item.streetAr || "").trim();
    const addressAr =
      String(item.addressAr || "").trim() ||
      [streetAr, district, city, governorate].filter(Boolean).join("، ");
    const labelAr = String(item.labelAr || "").trim();
    out.push({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : `loc-${Date.now()}-${i + 1}`,
      labelAr: labelAr || undefined,
      governorate,
      city,
      district,
      streetAr: streetAr || undefined,
      addressAr,
      coordinates: { lat, lng },
      googlePlaceId:
        typeof item.googlePlaceId === "string" && item.googlePlaceId.trim()
          ? item.googlePlaceId.trim()
          : undefined,
    });
  }
  return out;
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  const callerMemberCode = (caller.memberCode || "").trim().toUpperCase();
  if (!caller.authenticated || !callerMemberCode) {
    return NextResponse.json(
      { ok: false, messageAr: "يجب تسجيل الدخول أولاً لإضافة منشأتك أو أكاديميتك." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nameAr = String(body.nameAr || "").trim();
    const isAcademyInHostClubs = Boolean(body.isAcademyInHostClubs);
    const locations = sanitizeLocations(body.locations);

    if (nameAr.length < 2) {
      return NextResponse.json(
        { ok: false, messageAr: "يرجى إدخال اسم المنشأة أو الأكاديمية بشكل واضح." },
        { status: 400 }
      );
    }

    if (locations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          messageAr:
            "تحديد الموقع الجغرافي إجباري (لتفريق الفروع والأسماء المتشابهة حسب الشارع والمدينة). حدد الموقع على الخريطة أو عبر البحث ثم أعد المحاولة.",
        },
        { status: 400 }
      );
    }

    const phone = String(body.phone || caller.phone || "").trim();
    const whatsappNumber = normalizePhoneWa(String(body.whatsappNumber || ""));
    const facebookUrl = String(body.facebookUrl || "").trim() || undefined;
    const instagramUrl = String(body.instagramUrl || "").trim() || undefined;

    if (!phone && !whatsappNumber && !facebookUrl && !instagramUrl) {
      return NextResponse.json(
        {
          ok: false,
          messageAr:
            "يرجى إدخال وسيلة تواصل واحدة على الأقل (رقم موبايل أو واتساب أو فيسبوك أو إنستاجرام).",
        },
        { status: 400 }
      );
    }

    const managerName = String(body.managerName || "").trim() || "مسؤول المنشأة";
    const roleTitleAr = String(body.roleTitleAr || "").trim() || "إدارة المنشأة";
    const publicDescriptionAr = String(body.publicDescriptionAr || "").trim() || undefined;
    const instapayHandle = String(body.instapayHandle || "").trim();
    const heroImageInput = String(body.heroImage || "").trim();
    const updatedBasePriceEgp = Number(body.updatedBasePriceEgp) || 0;
    const commercialRegRef = String(body.commercialRegRef || "").trim() || undefined;
    const proofDocumentUrl = String(body.proofDocumentUrl || "").trim() || undefined;
    const proofNotesAr = String(body.proofNotesAr || "").trim() || undefined;

    const admin = getSupabaseAdminClient();
    const facilityId =
      caller.linkedFacilityId && caller.linkedFacilityId.trim()
        ? caller.linkedFacilityId.trim()
        : `fac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let existingFacPayload: Partial<Facility> | null = null;
    let existingFacSlug = "";
    if (caller.linkedFacilityId) {
      if (admin) {
        const { data } = await admin
          .from("captenly_facilities")
          .select("slug, payload")
          .eq("id", facilityId)
          .limit(1);
        const row = Array.isArray(data) ? (data[0] as { slug?: string; payload?: Partial<Facility> } | undefined) : undefined;
        if (row) {
          existingFacSlug = row.slug || "";
          existingFacPayload = row.payload || null;
        }
      }
      if (!existingFacPayload) {
        const pg = await withPgClient(async (client) => {
          const { rows } = await client.query(
            `select slug, payload from public.captenly_facilities where id = $1 limit 1`,
            [facilityId]
          );
          return rows[0] as { slug?: string; payload?: Partial<Facility> } | undefined;
        });
        if (pg.ok && pg.value) {
          existingFacSlug = pg.value.slug || "";
          existingFacPayload = pg.value.payload || null;
        }
      }
    }

    const primaryLoc = locations[0];
    const slug = existingFacSlug || existingFacPayload?.slug || slugifyAscii("swimming-academy", "fac");
    const existingPricePackages = Array.isArray(existingFacPayload?.pricePackages)
      ? existingFacPayload.pricePackages
      : [];
    const pricePackages =
      updatedBasePriceEgp > 0
        ? existingPricePackages.length > 0
          ? [
              { ...existingPricePackages[0], baseMonthlyEgp: updatedBasePriceEgp },
              ...existingPricePackages.slice(1),
            ]
          : [
              {
                id: `pkg-${Date.now()}`,
                nameAr: "الباقة الشهرية الأساسية (8 حصص)",
                sessionsPerWeek: 2,
                sessionsCount: 8,
                durationMinutes: 60,
                baseMonthlyEgp: updatedBasePriceEgp,
                assessmentFeeEgp: 0,
                membershipCardFeeEgp: 0,
                mandatoryKitFeeEgp: 0,
                companionFeeEgp: 0,
              },
            ]
        : existingPricePackages;

    const existingStaff = Array.isArray(existingFacPayload?.staffMembers)
      ? existingFacPayload.staffMembers
      : [];
    const hasOwnerStaff = existingStaff.some(
      (st) => st.linkedMemberCode?.toUpperCase() === callerMemberCode
    );
    const mergedStaff = hasOwnerStaff
      ? existingStaff
      : [
          {
            id: `staff-owner-${Date.now()}`,
            facilityId,
            facilityNameAr: nameAr,
            fullNameAr: managerName,
            role: "general_staff" as const,
            roleTitleAr,
            hasAccount: true,
            linkedMemberCode: callerMemberCode,
            phone: phone || caller.phone || "",
            assignedDateAr: new Date().toLocaleDateString("ar-EG"),
            isActive: true,
            invitationStatus: "accepted" as const,
          },
          ...existingStaff,
        ];

    const isAlreadyVerified = existingFacPayload?.supplyStatus === "verified_active";
    const facility: Facility = {
      ...(existingFacPayload || {}),
      id: facilityId,
      slug,
      nameAr,
      nameEn: existingFacPayload?.nameEn || nameAr,
      facilityType: isAcademyInHostClubs ? "swimming_academy" : "club_pool",
      isAcademyInHostClubs,
      sportSector: "swimming",
      governorate: primaryLoc.governorate,
      city: primaryLoc.city,
      district: primaryLoc.district,
      addressAr: primaryLoc.addressAr,
      coordinates: primaryLoc.coordinates,
      locations,
      googlePlaceId: primaryLoc.googlePlaceId || existingFacPayload?.googlePlaceId,
      whatsappNumber: whatsappNumber || existingFacPayload?.whatsappNumber,
      facebookUrl: facebookUrl || existingFacPayload?.facebookUrl,
      instagramUrl: instagramUrl || existingFacPayload?.instagramUrl,
      publicDescriptionAr: publicDescriptionAr || existingFacPayload?.publicDescriptionAr,
      instapayHandle: instapayHandle || existingFacPayload?.instapayHandle || "",
      vodafoneCashNumber: existingFacPayload?.vodafoneCashNumber || "",
      supplyStatus: isAlreadyVerified ? "verified_active" : "self_listed_pending",
      subscriptionTier: existingFacPayload?.subscriptionTier || "free_founding",
      isSponsored: Boolean(existingFacPayload?.isSponsored),
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: isAlreadyVerified ? "موثقة رسمياً" : "مضافة مباشرة على كابتنلي",
      avgReplyMinutes: existingFacPayload?.avgReplyMinutes ?? 0,
      completenessScore: Math.max(85, existingFacPayload?.completenessScore ?? 85),
      rating: existingFacPayload?.rating ?? 0,
      reviewsCount: existingFacPayload?.reviewsCount ?? 0,
      heroImage: heroImageInput || existingFacPayload?.heroImage || "",
      badges: Array.isArray(existingFacPayload?.badges) ? existingFacPayload.badges : [],
      specialtiesAr:
        Array.isArray(existingFacPayload?.specialtiesAr) && existingFacPayload.specialtiesAr.length > 0
          ? existingFacPayload.specialtiesAr
          : ["تعليم السباحة للأطفال والبالغين"],
      pricePackages,
      schoolPrograms: existingFacPayload?.schoolPrograms || [],
      staffMembers: mergedStaff,
      coachRoster: existingFacPayload?.coachRoster || [],
      affiliatedCoachIds: Array.isArray(existingFacPayload?.affiliatedCoachIds)
        ? existingFacPayload.affiliatedCoachIds
        : [],
      monthlyMetrics: existingFacPayload?.monthlyMetrics || {
        profileViews: 1,
        comparisonAppearances: 0,
        verifiedWhatsappLeads: 0,
        activeSessionLedgers: 0,
      },
    };

    // 1. Persist Facility immediately in captenly_facilities
    const dbRow = {
      id: facility.id,
      slug: facility.slug,
      name_ar: facility.nameAr,
      name_en: facility.nameEn,
      sport_sector: "swimming",
      supply_status: "verified_claimed",
      city: facility.city,
      district: facility.district || "عام",
      governorate: facility.governorate,
      address_ar: facility.addressAr,
      lat: facility.coordinates.lat,
      lng: facility.coordinates.lng,
      rating: Number(facility.rating ?? 0),
      reviews_count: Number(facility.reviewsCount ?? 0),
      whatsapp_phone: facility.whatsappNumber || null,
      payload: facility,
      updated_at: new Date().toISOString(),
    };

    let facilityPersisted = false;
    if (admin) {
      const { error } = await admin.from("captenly_facilities").upsert(dbRow, { onConflict: "id" });
      if (!error) facilityPersisted = true;
    }

    if (!facilityPersisted) {
      const pg = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_facilities
            (id, slug, name_ar, name_en, sport_sector, supply_status, city, district, governorate, address_ar, lat, lng, rating, reviews_count, whatsapp_phone, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,now())
           on conflict (id) do update set
            slug = excluded.slug,
            name_ar = excluded.name_ar,
            name_en = excluded.name_en,
            city = excluded.city,
            district = excluded.district,
            governorate = excluded.governorate,
            address_ar = excluded.address_ar,
            lat = excluded.lat,
            lng = excluded.lng,
            whatsapp_phone = excluded.whatsapp_phone,
            payload = excluded.payload,
            updated_at = now()`,
          [
            dbRow.id,
            dbRow.slug,
            dbRow.name_ar,
            dbRow.name_en,
            dbRow.sport_sector,
            dbRow.supply_status,
            dbRow.city,
            dbRow.district,
            dbRow.governorate,
            dbRow.address_ar,
            dbRow.lat,
            dbRow.lng,
            dbRow.rating,
            dbRow.reviews_count,
            dbRow.whatsapp_phone,
            JSON.stringify(facility),
          ]
        );
        return true;
      });
      facilityPersisted = pg.ok;
    }

    // 2. Link facility to member profile and promote role to facility_manager (unless super_admin)
    const nextRole: AccountRole =
      caller.role === "super_admin" ? "super_admin" : "facility_manager";

    if (admin) {
      let { data: profRows } = await admin
        .from("captenly_profiles")
        .select("member_code, role, social_links")
        .eq("member_code", callerMemberCode)
        .limit(1);
      if ((!Array.isArray(profRows) || profRows.length === 0) && caller.email) {
        const emailLookup = await admin
          .from("captenly_profiles")
          .select("member_code, role, social_links")
          .ilike("email", caller.email)
          .limit(1);
        if (Array.isArray(emailLookup.data) && emailLookup.data.length > 0) {
          profRows = emailLookup.data;
        }
      }
      const existingProf = Array.isArray(profRows)
        ? (profRows[0] as Record<string, unknown> | undefined)
        : undefined;
      const targetCode =
        typeof existingProf?.member_code === "string" && existingProf.member_code.trim()
          ? existingProf.member_code.trim().toUpperCase()
          : callerMemberCode;
      const existingLinks =
        existingProf?.social_links && typeof existingProf.social_links === "object"
          ? (existingProf.social_links as Record<string, unknown>)
          : {};
      await admin
        .from("captenly_profiles")
        .update({
          role: "facility_manager",
          needs_onboarding: false,
          social_links: { ...existingLinks, _linkedFacilityId: facility.id },
          updated_at: new Date().toISOString(),
        })
        .eq("member_code", targetCode);
    } else {
      await withPgClient(async (client) => {
        await client.query(
          `update public.captenly_profiles set
             role = case when role = 'super_admin' then 'super_admin' else 'facility_manager' end,
             needs_onboarding = false,
             social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object('_linkedFacilityId', $2::text),
             updated_at = now()
           where upper(member_code) = upper($1)`,
          [callerMemberCode, facility.id]
        );
        return true;
      });
    }

    // 3. Optional verification badge request if documents/commercial ref were supplied
    let optionalClaim: MemberRoleClaim | null = null;
    if ((commercialRegRef || proofDocumentUrl) && !isAlreadyVerified) {
      const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const claimRow = {
        id: claimId,
        applicant_member_code: callerMemberCode,
        applicant_name_ar: managerName,
        applicant_phone: phone || caller.phone || "",
        applicant_email: caller.email || null,
        claim_type: "facility" as const,
        target_facility_id: facility.id,
        target_facility_name_ar: facility.nameAr,
        city_ar: facility.city,
        governorate_ar: facility.governorate,
        proof_document_url: proofDocumentUrl || null,
        proof_notes_ar:
          proofNotesAr ||
          `طلب شارة التوثيق الخضراء للمنشأة المسجّلة: ${facility.nameAr}${commercialRegRef ? ` | سجل/ترخيص: ${commercialRegRef}` : ""}`,
        proposed_payload: {
          facilityId: facility.id,
          slug: facility.slug,
          nameAr: facility.nameAr,
          nameEn: facility.nameEn,
          facilityType: facility.facilityType,
          isAcademyInHostClubs,
          governorate: facility.governorate,
          city: facility.city,
          district: facility.district,
          addressAr: facility.addressAr,
          coordinates: facility.coordinates,
          locations,
          whatsappNumber: facility.whatsappNumber,
          facebookUrl: facility.facebookUrl,
          instagramUrl: facility.instagramUrl,
          instapayHandle: facility.instapayHandle,
          heroImage: facility.heroImage,
          commercialRegRef,
        },
        status: "pending_review" as const,
        updated_at: new Date().toISOString(),
      };

      if (admin) {
        const { data } = await admin
          .from("captenly_role_claims")
          .upsert(claimRow, { onConflict: "id" })
          .select("*")
          .limit(1);
        if (Array.isArray(data) && data[0]) {
          optionalClaim = {
            id: String(data[0].id),
            applicantMemberCode: String(data[0].applicant_member_code),
            applicantNameAr: String(data[0].applicant_name_ar),
            applicantPhone: String(data[0].applicant_phone || ""),
            claimType: "facility",
            targetFacilityId: facility.id,
            targetFacilityNameAr: facility.nameAr,
            cityAr: facility.city,
            governorateAr: facility.governorate,
            proofDocumentUrl,
            proofNotesAr: claimRow.proof_notes_ar,
            status: "pending_review",
            createdAt: String(data[0].created_at || new Date().toISOString()),
          };
        }
      } else {
        await withPgClient(async (client) => {
          await client.query(
            `insert into public.captenly_role_claims (
              id, applicant_member_code, applicant_name_ar, applicant_phone, applicant_email,
              claim_type, target_facility_id, target_facility_name_ar, city_ar, governorate_ar,
              proof_document_url, proof_notes_ar, proposed_payload, status, updated_at
            ) values ($1,$2,$3,$4,$5,'facility',$6,$7,$8,$9,$10,$11,$12::jsonb,'pending_review',now())`,
            [
              claimRow.id,
              claimRow.applicant_member_code,
              claimRow.applicant_name_ar,
              claimRow.applicant_phone,
              claimRow.applicant_email,
              claimRow.target_facility_id,
              claimRow.target_facility_name_ar,
              claimRow.city_ar,
              claimRow.governorate_ar,
              claimRow.proof_document_url,
              claimRow.proof_notes_ar,
              JSON.stringify(claimRow.proposed_payload),
            ]
          );
          return true;
        });
      }
    }

    if (!facilityPersisted) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          messageAr: "تعذر حفظ بيانات المنشأة في قاعدة البيانات حالياً، يرجى المحاولة مجدداً.",
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      persisted: facilityPersisted,
      facility,
      linkedFacilityId: facility.id,
      role: nextRole,
      optionalClaim,
      messageAr: optionalClaim
        ? `تم نشر صفحة «${facility.nameAr}» فوراً للسبّاحين! وتتم مراجعة مستندات الشارة الخضراء في الخلفية.`
        : `تم إنشاء ونشر صفحة «${facility.nameAr}» فوراً! أصبحت ظاهرة للسبّاحين في البحث، ويمكنك إدارتها الآن من لوحة المنشأة.`,
    });

    await attachMemberSessionCookie(response, {
      memberCode: callerMemberCode,
      role: nextRole,
      email: caller.email,
      phone: phone || caller.phone,
      linkedFacilityId: facility.id,
      linkedCoachId: caller.linkedCoachId,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, messageAr: "تعذر حفظ بيانات المنشأة حالياً، يرجى المحاولة مرة أخرى." },
      { status: 500 }
    );
  }
}
