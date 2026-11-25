"use client";

import type {
  Coach,
  Facility,
  FacilityLinkedEntity,
  FacilityPoolDeskConfig,
  FacilityPromoCode,
  PersonaAccount,
} from "@/types/captenly";
import { getFacilityPoolDeskConfig } from "@/lib/poolDeskPricing";
import { postSupabaseSync } from "./storageHelpers";
import type { CaptenlyContextType } from "./types";

export interface PoolDeskLinksInput {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  coaches: Coach[];
  facilityLinks: FacilityLinkedEntity[];
  setFacilityLinks: React.Dispatch<React.SetStateAction<FacilityLinkedEntity[]>>;
  updateFacilityAndSync: (facilityId: string, updater: (f: Facility) => Facility) => void;
  effectiveOffline: boolean;
  getAuthContext: () => {
    isAuthenticated: boolean;
    currentPersona: PersonaAccount;
    resolvedActiveStaffFacilityId?: string;
  };
}

export function createPoolDeskLinksAndConfigActions(input: PoolDeskLinksInput) {
  const {
    facilities,
    setFacilities,
    coaches,
    facilityLinks,
    setFacilityLinks,
    updateFacilityAndSync,
    effectiveOffline,
    getAuthContext,
  } = input;

  const refreshFacilityLinks = async () => {
    const { isAuthenticated, currentPersona, resolvedActiveStaffFacilityId } = getAuthContext();
    if (!isAuthenticated || effectiveOffline) return;
    const facId = currentPersona.linkedFacilityId || resolvedActiveStaffFacilityId;
    const coachId =
      currentPersona.linkedCoachId ||
      (currentPersona.role === "coach" ? currentPersona.id : undefined);
    const params = new URLSearchParams();
    if (facId) params.set("facilityId", facId);
    else if (coachId) params.set("coachId", coachId);
    else if (currentPersona.memberCode) params.set("memberCode", currentPersona.memberCode);
    if (!params.toString()) return;

    try {
      const res = await fetch(`/api/supabase/facility-links?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.links)) {
        const incoming = data.links as FacilityLinkedEntity[];
        setFacilityLinks((prev) => {
          const byId = new Map(prev.map((l) => [l.id, l]));
          for (const item of incoming) {
            if (item?.id) byId.set(item.id, item);
          }
          return Array.from(byId.values());
        });
        if (facId) {
          setFacilities((prev) =>
            prev.map((f) => {
              if (f.id !== facId) return f;
              const facLinks = incoming.filter((l) => l.facilityId === facId);
              if (facLinks.length === 0) return f;
              const cfg = getFacilityPoolDeskConfig(f);
              const merged = new Map(cfg.linkedEntities.map((e) => [e.id, e]));
              for (const l of facLinks) merged.set(l.id, l);
              return {
                ...f,
                poolDeskConfig: { ...cfg, linkedEntities: Array.from(merged.values()) },
              };
            })
          );
        }
      }
    } catch {
      // ignore offline
    }
  };

  const updateFacilityPoolDeskConfig: CaptenlyContextType["updateFacilityPoolDeskConfig"] = (
    facilityId,
    patch
  ) => {
    const target = facilities.find((f) => f.id === facilityId);
    if (!target) return { ok: false, messageAr: "لم يتم العثور على المنشأة لتحديث الإعدادات." };
    const prevCfg = getFacilityPoolDeskConfig(target);
    const nextCfg: FacilityPoolDeskConfig = {
      ...prevCfg,
      ...patch,
      waterFeePerSessionEgp:
        patch.waterFeePerSessionEgp !== undefined
          ? Math.max(0, Number(patch.waterFeePerSessionEgp || 0))
          : prevCfg.waterFeePerSessionEgp,
      promoCodes: patch.promoCodes !== undefined ? patch.promoCodes : prevCfg.promoCodes,
      linkedEntities:
        patch.linkedEntities !== undefined ? patch.linkedEntities : prevCfg.linkedEntities,
      lastUpdatedIso: new Date().toISOString(),
    };
    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      poolDeskConfig: nextCfg,
      priceLastVerifiedDaysAgo: 0,
      priceLastVerifiedDate: "اليوم — محدث من الإدارة",
    }));
    return {
      ok: true,
      messageAr:
        "تم حفظ إعدادات الأسعار والخصومات والصلاحيات بنجاح (تُطبق على الاشتراكات الجديدة فقط) ✓",
    };
  };

  const saveFacilityPromoCode: CaptenlyContextType["saveFacilityPromoCode"] = (
    facilityId,
    promoInput
  ) => {
    const target = facilities.find((f) => f.id === facilityId);
    if (!target) return { ok: false, messageAr: "لم يتم العثور على المنشأة." };
    const cleanCode = promoInput.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!cleanCode || promoInput.value <= 0) {
      return { ok: false, messageAr: "يرجى إدخال اسم كود الخصم وقيمة خصم أكبر من صفر." };
    }
    const cfg = getFacilityPoolDeskConfig(target);
    const existing = promoInput.id
      ? cfg.promoCodes.find((p) => p.id === promoInput.id)
      : cfg.promoCodes.find((p) => p.code.toUpperCase() === cleanCode);
    const nextPromo: FacilityPromoCode = {
      id: existing?.id || `promo-${Date.now()}`,
      code: cleanCode,
      discountType: promoInput.discountType,
      value: Math.max(1, Number(promoInput.value)),
      maxUses: promoInput.maxUses && promoInput.maxUses > 0 ? Number(promoInput.maxUses) : undefined,
      usedCount: existing?.usedCount ?? 0,
      expiresAtIso: promoInput.expiresAtIso || undefined,
      expiresLabelAr: promoInput.expiresLabelAr || promoInput.expiresAtIso || "مفتوح المدة",
      isActive: promoInput.isActive,
      notesAr: promoInput.notesAr,
      createdAtIso: existing?.createdAtIso || new Date().toISOString(),
    };
    const nextList = existing
      ? cfg.promoCodes.map((p) => (p.id === existing.id ? nextPromo : p))
      : [nextPromo, ...cfg.promoCodes];
    updateFacilityPoolDeskConfig(facilityId, { promoCodes: nextList });
    return { ok: true, messageAr: `تم حفظ وتفعيل كود الخصم (${cleanCode}) بنجاح ✓` };
  };

  const toggleFacilityPromoCode = (facilityId: string, promoId: string) => {
    const target = facilities.find((f) => f.id === facilityId);
    if (!target) return;
    const cfg = getFacilityPoolDeskConfig(target);
    updateFacilityPoolDeskConfig(facilityId, {
      promoCodes: cfg.promoCodes.map((p) => (p.id === promoId ? { ...p, isActive: !p.isActive } : p)),
    });
  };

  const removeFacilityPromoCode = (facilityId: string, promoId: string) => {
    const target = facilities.find((f) => f.id === facilityId);
    if (!target) return;
    const cfg = getFacilityPoolDeskConfig(target);
    updateFacilityPoolDeskConfig(facilityId, {
      promoCodes: cfg.promoCodes.filter((p) => p.id !== promoId),
    });
  };

  const syncEntityLinkIntoFacilityState = (link: FacilityLinkedEntity) => {
    setFacilityLinks((prev) => [link, ...prev.filter((l) => l.id !== link.id)]);
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id !== link.facilityId) return f;
        const cfg = getFacilityPoolDeskConfig(f);
        return {
          ...f,
          poolDeskConfig: {
            ...cfg,
            linkedEntities: [link, ...cfg.linkedEntities.filter((e) => e.id !== link.id)],
            lastUpdatedIso: new Date().toISOString(),
          },
        };
      })
    );
  };

  const addDirectFacilityLinkedEntity: CaptenlyContextType["addDirectFacilityLinkedEntity"] = async (
    facilityId,
    payload
  ) => {
    const fac = facilities.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, messageAr: "لم يتم العثور على المنشأة." };
    const cleanName = payload.displayNameAr.trim();
    if (!cleanName) return { ok: false, messageAr: "يرجى إدخال اسم الأكاديمية أو الكابتن." };
    const codeUpper = (payload.linkedMemberCode || "").trim().toUpperCase();
    const matchedCoach = coaches.find(
      (c) =>
        (codeUpper && c.SingleCoachId?.toUpperCase() === codeUpper) ||
        c.fullNameAr.trim() === cleanName
    );
    const matchedFac = facilities.find((f) => f.id !== facilityId && f.nameAr.trim() === cleanName);

    const localDraft: FacilityLinkedEntity = {
      id: `link-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId,
      facilityNameAr: fac.nameAr,
      entityKind: payload.entityKind,
      linkedCoachId: matchedCoach?.id,
      linkedFacilityId: matchedFac?.id,
      linkedMemberCode: codeUpper || matchedCoach?.SingleCoachId,
      displayNameAr: cleanName,
      ownerNameAr: payload.ownerNameAr?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      agreementType: payload.agreementType,
      fixedMonthlyAmountEgp:
        payload.agreementType === "fixed_monthly"
          ? Math.max(0, Number(payload.fixedMonthlyAmountEgp || 0))
          : undefined,
      customWaterFeePerSessionEgp:
        payload.customWaterFeePerSessionEgp !== undefined
          ? Math.max(0, Number(payload.customWaterFeePerSessionEgp))
          : undefined,
      direction: "added_by_facility",
      status: "approved",
      canScanGroupQr: Boolean(payload.canScanGroupQr),
      groupLabelAr: payload.groupLabelAr?.trim() || undefined,
      swimmersCountEstimate: payload.swimmersCountEstimate,
      createdAtAr: "اليوم — مضاف من المنشأة",
      createdAtIso: new Date().toISOString(),
    };

    if (!effectiveOffline) {
      try {
        const res = await fetch("/api/supabase/facility-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_direct", ...localDraft }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.link) {
          const saved = data.link as FacilityLinkedEntity;
          syncEntityLinkIntoFacilityState(saved);
          return { ok: true, link: saved, messageAr: data.messageAr };
        }
      } catch {
        // Fallback optimistic update
      }
    }

    syncEntityLinkIntoFacilityState(localDraft);
    const cfg = getFacilityPoolDeskConfig(fac);
    updateFacilityPoolDeskConfig(facilityId, {
      linkedEntities: [localDraft, ...cfg.linkedEntities.filter((e) => e.id !== localDraft.id)],
    });
    return { ok: true, link: localDraft, messageAr: `تمت إضافة وربط «${cleanName}» بالمنشأة بنجاح ✓` };
  };

  const requestCoachHostClubLink: CaptenlyContextType["requestCoachHostClubLink"] = async (
    payload
  ) => {
    const { isAuthenticated, currentPersona } = getAuthContext();
    if (!isAuthenticated) return { ok: false, messageAr: "يرجى تسجيل الدخول أولاً لإرسال طلب الربط." };
    const localCoachId =
      currentPersona.linkedCoachId ||
      (currentPersona.role === "coach" ? currentPersona.id : undefined);
    const displayNameAr = payload.displayNameAr?.trim() || currentPersona.fullNameAr;
    const localReq: FacilityLinkedEntity = {
      id: `link-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: payload.facilityId,
      facilityNameAr: payload.facilityNameAr,
      entityKind: payload.entityKind || "coach",
      linkedCoachId: localCoachId,
      linkedFacilityId:
        payload.entityKind === "academy" ? currentPersona.linkedFacilityId : undefined,
      linkedMemberCode: currentPersona.memberCode,
      displayNameAr,
      phone: currentPersona.phone,
      agreementType: payload.agreementType || "per_swimmer_water",
      fixedMonthlyAmountEgp: payload.fixedMonthlyAmountEgp,
      direction: "requested_by_entity",
      status: "pending",
      canScanGroupQr: false,
      groupLabelAr: payload.groupLabelAr,
      swimmersCountEstimate: payload.swimmersCountEstimate,
      createdAtAr: "اليوم — قيد مراجعة النادي",
      createdAtIso: new Date().toISOString(),
    };

    if (!effectiveOffline) {
      try {
        const res = await fetch("/api/supabase/facility-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request_link",
            facilityId: payload.facilityId,
            facilityNameAr: payload.facilityNameAr,
            entityKind: localReq.entityKind,
            displayNameAr,
            agreementType: localReq.agreementType,
            fixedMonthlyAmountEgp: localReq.fixedMonthlyAmountEgp,
            groupLabelAr: localReq.groupLabelAr,
            swimmersCountEstimate: localReq.swimmersCountEstimate,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.link) {
          const saved = data.link as FacilityLinkedEntity;
          syncEntityLinkIntoFacilityState(saved);
          return { ok: true, link: saved, messageAr: data.messageAr };
        }
      } catch {
        // Fallback local request
      }
    }

    syncEntityLinkIntoFacilityState(localReq);
    return {
      ok: true,
      link: localReq,
      messageAr: `تم إرسال طلب الربط إلى «${payload.facilityNameAr}» وفي انتظار اعتماد إدارة النادي.`,
    };
  };

  const reviewFacilityLinkedEntity: CaptenlyContextType["reviewFacilityLinkedEntity"] = async (
    facilityId,
    linkId,
    patch
  ) => {
    const fac = facilities.find((f) => f.id === facilityId);
    const existing =
      facilityLinks.find((l) => l.id === linkId) ||
      getFacilityPoolDeskConfig(fac).linkedEntities.find((l) => l.id === linkId);
    if (!existing) return { ok: false, messageAr: "طلب الربط غير موجود." };

    const updated: FacilityLinkedEntity = {
      ...existing,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.agreementType !== undefined ? { agreementType: patch.agreementType } : {}),
      ...(patch.fixedMonthlyAmountEgp !== undefined
        ? { fixedMonthlyAmountEgp: patch.fixedMonthlyAmountEgp }
        : {}),
      ...(patch.customWaterFeePerSessionEgp !== undefined
        ? { customWaterFeePerSessionEgp: patch.customWaterFeePerSessionEgp }
        : {}),
      ...(patch.canScanGroupQr !== undefined ? { canScanGroupQr: patch.canScanGroupQr } : {}),
      ...(patch.collectedMonthlyEgp !== undefined
        ? { collectedMonthlyEgp: patch.collectedMonthlyEgp }
        : {}),
    };

    if (!effectiveOffline) {
      try {
        const res = await fetch("/api/supabase/facility-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: linkId, facilityId, ...patch }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.link) {
          const saved = data.link as FacilityLinkedEntity;
          syncEntityLinkIntoFacilityState(saved);
          if (saved.linkedMemberCode) {
            postSupabaseSync("/api/supabase/notifications", {
              memberCode: saved.linkedMemberCode,
              titleAr:
                patch.canScanGroupQr !== undefined
                  ? patch.canScanGroupQr
                    ? `تم تفويضك بمسح QR سبّاحيك لدى ${fac?.nameAr || saved.facilityNameAr}`
                    : `تم قصر مسح الـ QR على بوابة ${fac?.nameAr || saved.facilityNameAr}`
                  : `تحديث ربطك مع ${fac?.nameAr || saved.facilityNameAr}`,
              messageAr: data.messageAr,
              type: "affiliation_update",
              actionHref: "/dashboard/coach",
            });
          }
          return { ok: true, link: saved, messageAr: data.messageAr };
        }
      } catch {
        // Fallback local update
      }
    }

    syncEntityLinkIntoFacilityState(updated);
    if (fac) {
      const cfg = getFacilityPoolDeskConfig(fac);
      updateFacilityPoolDeskConfig(facilityId, {
        linkedEntities: [updated, ...cfg.linkedEntities.filter((e) => e.id !== updated.id)],
      });
    }
    return {
      ok: true,
      link: updated,
      messageAr:
        patch.canScanGroupQr !== undefined
          ? updated.canScanGroupQr
            ? `تم تفويض «${updated.displayNameAr}» بمسح QR سبّاحي مجموعته فقط ✓`
            : `تم قصر المسح على بوابة المنشأة لـ «${updated.displayNameAr}»`
          : `تم تحديث حالة «${updated.displayNameAr}» بنجاح ✓`,
    };
  };

  return {
    refreshFacilityLinks,
    updateFacilityPoolDeskConfig,
    saveFacilityPromoCode,
    toggleFacilityPromoCode,
    removeFacilityPromoCode,
    addDirectFacilityLinkedEntity,
    requestCoachHostClubLink,
    reviewFacilityLinkedEntity,
  };
}
