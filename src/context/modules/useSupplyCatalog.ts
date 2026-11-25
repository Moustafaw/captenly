"use client";

import type {
  Coach,
  CoachSessionOffer,
  EditorialArticle,
  Facility,
  FacilityCoachRosterEntry,
  FacilitySchoolProgram,
  NotificationItem,
  PersonaAccount,
  VerificationBadge,
} from "@/types/captenly";
import { PROHIBITED_MEDICAL_KEYWORDS } from "@/data/seedData";
import { schoolProgramToPricePackage } from "@/lib/facilityPricing";
import { postSupabaseSync } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";

function syncFacilityProgramsPricing(
  f: Facility,
  nextPrograms: FacilitySchoolProgram[]
): Facility {
  const nonProgPackages = (f.pricePackages || []).filter((p) => !p.id.startsWith("pkg_prog_"));
  return {
    ...f,
    schoolPrograms: nextPrograms,
    pricePackages: [...nextPrograms.map(schoolProgramToPricePackage), ...nonProgPackages],
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: "اليوم — محدث من الإدارة",
  };
}

export interface SupplyCatalogInput {
  facilities: Facility[];
  coaches: Coach[];
  setArticles: React.Dispatch<React.SetStateAction<EditorialArticle[]>>;
  updateCoachAndSync: (coachId: string, updater: (c: Coach) => Coach) => void;
  updateFacilityAndSync: (facilityId: string, updater: (f: Facility) => Facility) => void;
  getCurrentPersona: () => PersonaAccount;
  pushNotification: (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => void;
}

export function createSupplyCatalogActions(input: SupplyCatalogInput) {
  const {
    facilities,
    coaches,
    setArticles,
    updateCoachAndSync,
    updateFacilityAndSync,
    getCurrentPersona,
    pushNotification,
  } = input;

  const gracefulDisaffiliateCoach = (coachId: string, facilityId: string) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      affiliations: c.affiliations.map((aff) =>
        aff.facilityId === facilityId ? { ...aff, status: "gracefully_disaffiliated" } : aff
      ),
    }));
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      affiliatedCoachIds: f.affiliatedCoachIds.filter((id) => id !== coachId),
    }));
  };

  const requestMutualAffiliation = (
    coachId: string,
    facilityId: string,
    scheduleAr: string,
    roleAr: string
  ) => {
    const targetFacility = facilities.find((f) => f.id === facilityId);
    if (!targetFacility) return;
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      affiliations: [
        ...c.affiliations,
        {
          facilityId,
          facilityNameAr: targetFacility.nameAr,
          city: targetFacility.city,
          scheduleAr,
          roleAr,
          status: "pending",
        },
      ],
    }));
  };

  const approveAffiliationMutual = (coachId: string, facilityId: string) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      affiliations: c.affiliations.map((a) =>
        a.facilityId === facilityId ? { ...a, status: "active_mutual" } : a
      ),
    }));
    updateFacilityAndSync(facilityId, (f) =>
      f.affiliatedCoachIds.includes(coachId)
        ? f
        : { ...f, affiliatedCoachIds: [...f.affiliatedCoachIds, coachId] }
    );
  };

  const reviewEntityBadge = (
    kind: "coach" | "facility",
    entityId: string,
    badgeCode: VerificationBadge["code"],
    nextStatus: "active" | "expired"
  ) => {
    const todayLabel = "اليوم — اعتماد إدارة كابتنلي";
    const updateBadges = (badges: VerificationBadge[]) =>
      badges.map((b) =>
        b.code === badgeCode
          ? { ...b, status: nextStatus, verifiedDate: nextStatus === "active" ? todayLabel : b.verifiedDate }
          : b
      );
    if (kind === "coach") {
      updateCoachAndSync(entityId, (c) => ({ ...c, badges: updateBadges(c.badges) }));
    } else {
      updateFacilityAndSync(entityId, (f) => ({ ...f, badges: updateBadges(f.badges) }));
    }
  };

  const addCoachSessionOffer = (coachId: string, offer: Omit<CoachSessionOffer, "id">) => {
    const newOffer: CoachSessionOffer = { ...offer, id: `offer-${Date.now()}` };
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: [newOffer, ...(c.sessionOffers || [])],
    }));
    return { ok: true, messageAr: `تم نشر عرض التدريب «${offer.titleAr}» بنجاح!` };
  };

  const updateCoachSessionOffer = (
    coachId: string,
    offerId: string,
    patch: Partial<Omit<CoachSessionOffer, "id">>
  ) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: (c.sessionOffers || []).map((o) => (o.id === offerId ? { ...o, ...patch } : o)),
    }));
    return { ok: true, messageAr: "تم تحديث بطاقة الحصة التدريبية بنجاح." };
  };

  const removeCoachSessionOffer = (coachId: string, offerId: string) => {
    updateCoachAndSync(coachId, (c) => ({
      ...c,
      sessionOffers: (c.sessionOffers || []).filter((o) => o.id !== offerId),
    }));
  };

  const addFacilitySchoolProgram = (
    facilityId: string,
    program: Omit<FacilitySchoolProgram, "id">
  ) => {
    const newProgram: FacilitySchoolProgram = {
      ...program,
      id: `prog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(f, [newProgram, ...(f.schoolPrograms || [])])
    );
    return { ok: true, messageAr: `تم نشر بطاقة «${program.titleAr}» بنجاح!` };
  };

  const updateFacilitySchoolProgram = (
    facilityId: string,
    programId: string,
    patch: Partial<Omit<FacilitySchoolProgram, "id">>
  ) => {
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(
        f,
        (f.schoolPrograms || []).map((p) => (p.id === programId ? { ...p, ...patch } : p))
      )
    );
    return { ok: true, messageAr: "تم تحديث تفاصيل البطاقة بنجاح." };
  };

  const removeFacilitySchoolProgram = (facilityId: string, programId: string) => {
    updateFacilityAndSync(facilityId, (f) =>
      syncFacilityProgramsPricing(f, (f.schoolPrograms || []).filter((p) => p.id !== programId))
    );
  };

  const addFacilityCoachRosterEntry: CaptenlyContextType["addFacilityCoachRosterEntry"] = (
    facilityId,
    payload
  ) => {
    const cleanName = payload.fullNameAr.trim();
    if (!cleanName) return { ok: false, messageAr: "يرجى إدخال اسم الكابتن." };
    const fac = facilities.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, messageAr: "لم يتم العثور على المنشأة." };
    const codeQuery = (payload.coachIdOrCode || "").trim();
    const matchedCoach = coaches.find(
      (c) =>
        (codeQuery &&
          (c.id === codeQuery ||
            c.SingleCoachId.toUpperCase() === codeQuery.toUpperCase() ||
            c.fullNameAr.includes(codeQuery))) ||
        c.fullNameAr.trim() === cleanName
    );
    const cleanCerts = payload.certificatesAr.map((c) => c.trim()).filter(Boolean);
    const hayCheck = `${cleanName} ${payload.roleTitleAr || ""} ${payload.specialtyAr || ""} ${cleanCerts.join(" ")}`.toLowerCase();
    const detectedMedical = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => hayCheck.includes(kw.toLowerCase()));
    if (detectedMedical) {
      return {
        ok: false,
        messageAr: `مخالف لقانون 3 لسنة 1985: يُمنع إدراج مصطلح "${detectedMedical}" ضمن بيانات أو شهادات المدربين بدون ترخيص علاج طبيعي موثق.`,
      };
    }
    const newEntry: FacilityCoachRosterEntry = {
      id: `roster-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: fac.id,
      fullNameAr: matchedCoach ? matchedCoach.fullNameAr : cleanName,
      roleTitleAr: payload.roleTitleAr.trim() || "مدرب سباحة بالأكاديمية",
      specialtyAr: payload.specialtyAr.trim() || "تأسيس وتدريب سباحة",
      certificatesAr: cleanCerts.length > 0 ? cleanCerts : ["مسجّل عبر إدارة المنشأة (قيد التحقق)"],
      scheduleAr: payload.scheduleAr?.trim() || "حسب جدول الأكاديمية",
      linkedCoachId: matchedCoach?.id,
      linkedCoachSlug: matchedCoach?.slug,
      linkedSingleCoachId: matchedCoach?.SingleCoachId,
      avatarUrl: matchedCoach?.avatarUrl,
      addedDateAr: matchedCoach?.isVerifiedCoach ? "كابتن موثق بالمنصة" : "مُضاف من إدارة المنشأة — قيد المراجعة",
    };
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      affiliatedCoachIds:
        matchedCoach && !f.affiliatedCoachIds.includes(matchedCoach.id)
          ? [...f.affiliatedCoachIds, matchedCoach.id]
          : f.affiliatedCoachIds,
      coachRoster: [newEntry, ...(f.coachRoster || [])],
    }));
    if (matchedCoach) {
      updateCoachAndSync(matchedCoach.id, (c) =>
        c.affiliations.some((a) => a.facilityId === fac.id)
          ? c
          : {
              ...c,
              affiliations: [
                ...c.affiliations,
                {
                  facilityId: fac.id,
                  facilityNameAr: fac.nameAr,
                  city: fac.city,
                  scheduleAr: newEntry.scheduleAr || "حسب الجدول المعلن",
                  roleAr: newEntry.roleTitleAr,
                  status: "active_mutual",
                },
              ],
            }
      );
      pushNotification({
        titleAr: `إشعار للكابتن: تم تسجيل اسمك في «${fac.nameAr}»`,
        messageAr: `قامت إدارة «${fac.nameAr}» بتسجيل اسمك وشهاداتك ضمن الكباتن الموثقين بالمنشأة (${newEntry.roleTitleAr}).`,
        type: "affiliation_update",
        actionLabelAr: "عرض صفحة المنشأة",
        actionHref: `/f/${fac.slug}`,
      });
    }
    return {
      ok: true,
      entry: newEntry,
      messageAr: matchedCoach
        ? `تم تسجيل «${newEntry.fullNameAr}» وربط ملفه الشخصي وإرسال إشعار فوري لحسابه، وأصبح ظاهراً في قسم الكباتن الموثقين بالمنشأة.`
        : `تم تسجيل «${newEntry.fullNameAr}» مع شهاداته وأصبح ظاهراً تلقائياً في قسم الكباتن الموثقين بصفحة المنشأة.`,
    };
  };

  const removeFacilityCoachRosterEntry = (facilityId: string, entryId: string) => {
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      coachRoster: (f.coachRoster || []).filter((e) => e.id !== entryId),
    }));
  };

  const saveEditorialArticle: CaptenlyContextType["saveEditorialArticle"] = (payload) => {
    const currentPersona = getCurrentPersona();
    const cleanTitle = payload.titleAr.trim();
    const rawParas =
      payload.bodyParagraphsAr && payload.bodyParagraphsAr.length > 0
        ? payload.bodyParagraphsAr
        : (payload.contentMarkdownAr || "").split("\n");
    const cleanParagraphs = rawParas.map((p) => p.trim()).filter(Boolean);
    if (!cleanTitle || cleanParagraphs.length === 0) {
      return { ok: false, messageAr: "يرجى إدخال عنوان المقال ومحتوى النص الأساسي على الأقل." };
    }
    const cleanTakeaways = (payload.keyTakeawaysAr || []).map((t) => t.trim()).filter(Boolean);
    const cleanExcerpt =
      payload.excerptAr.trim() ||
      cleanParagraphs[0].slice(0, 160) + (cleanParagraphs[0].length > 160 ? "..." : "");
    const cleanImage = payload.imageUrl ? payload.imageUrl.trim() : "";
    const computedMinutes =
      payload.readTimeMinutes ||
      payload.readingMinutes ||
      Math.max(2, Math.ceil(cleanParagraphs.join(" ").split(/\s+/).length / 130));
    const markdownBody = payload.contentMarkdownAr?.trim() || cleanParagraphs.join("\n\n");

    if (payload.id) {
      let updatedArticle: EditorialArticle | undefined;
      setArticles((prev) =>
        prev.map((art): EditorialArticle => {
          if (art.id !== payload.id) return art;
          const nextArt: EditorialArticle = {
            ...art,
            titleAr: cleanTitle,
            categoryAr: payload.categoryAr.trim() || art.categoryAr,
            readingMinutes: computedMinutes,
            readTimeMinutes: computedMinutes,
            excerptAr: cleanExcerpt,
            contentMarkdownAr: markdownBody,
            keyTakeawaysAr: cleanTakeaways.length > 0 ? cleanTakeaways : [cleanExcerpt],
            bodyParagraphsAr: cleanParagraphs,
            imageUrl: cleanImage || undefined,
          };
          updatedArticle = nextArt;
          return nextArt;
        })
      );
      if (updatedArticle) postSupabaseSync("/api/supabase/public-supply", { article: updatedArticle });
      return { ok: true, article: updatedArticle, messageAr: "تم حفظ التعديلات وتحديث المقال بنجاح." };
    }

    const slugBase = cleanTitle
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 45);
    const newArticle: EditorialArticle = {
      id: `art-${Date.now()}`,
      slug: `${slugBase || "article"}-${Math.floor(100 + Math.random() * 899)}`,
      titleAr: cleanTitle,
      categoryAr: payload.categoryAr.trim() || "تدريب وتكنيك السباحة",
      readingMinutes: computedMinutes,
      readTimeMinutes: computedMinutes,
      publishedDateAr: "اليوم — منشور موثق",
      authorNameAr: payload.authorNameAr || currentPersona.fullNameAr,
      authorRoleAr: payload.authorRoleAr || currentPersona.personaTitleAr,
      authorPersonaId: currentPersona.id,
      authorType:
        payload.authorType ||
        (currentPersona.role === "coach"
          ? "coach"
          : currentPersona.role === "facility_manager"
            ? "facility"
            : "editorial"),
      authorEntityId:
        payload.authorEntityId || currentPersona.linkedCoachId || currentPersona.linkedFacilityId,
      authorSlug: payload.authorSlug,
      excerptAr: cleanExcerpt,
      imageUrl: cleanImage || undefined,
      contentMarkdownAr: markdownBody,
      keyTakeawaysAr: cleanTakeaways.length > 0 ? cleanTakeaways : [cleanExcerpt],
      bodyParagraphsAr: cleanParagraphs,
      recommendedFacilitySlugs: [],
      recommendedCoachSlugs: [],
    };
    setArticles((prev) => [newArticle, ...prev]);
    postSupabaseSync("/api/supabase/public-supply", { article: newArticle });
    pushNotification({
      titleAr: "تم نشر مقالك الرياضي بنجاح!",
      messageAr: `أصبح مقال «${newArticle.titleAr}» متاحاً الآن للقراء في مجلة كابتنلي وفي صفحتك العامة.`,
      type: "passport_badge",
      actionLabelAr: "قراءة المقال",
      actionHref: `/magazine/${newArticle.slug}`,
    });
    return { ok: true, article: newArticle, messageAr: "تم نشر المقال بنجاح في مجلة كابتنلي وفي بروفايلك!" };
  };

  const deleteEditorialArticle = (articleId: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    postSupabaseSync("/api/supabase/public-supply", { deleteArticleId: articleId });
  };

  return {
    gracefulDisaffiliateCoach,
    requestMutualAffiliation,
    approveAffiliationMutual,
    reviewEntityBadge,
    addCoachSessionOffer,
    updateCoachSessionOffer,
    removeCoachSessionOffer,
    addFacilitySchoolProgram,
    updateFacilitySchoolProgram,
    removeFacilitySchoolProgram,
    addFacilityCoachRosterEntry,
    removeFacilityCoachRosterEntry,
    saveEditorialArticle,
    deleteEditorialArticle,
  };
}
