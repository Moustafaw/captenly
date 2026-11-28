"use client";

import { useMemo, useState } from "react";
import type {
  Coach,
  Facility,
  FacilityStaffMember,
  FacilityStaffRole,
  MemberRegistryEntry,
  MemberRoleClaim,
  NotificationItem,
  PersonaAccount,
  WorkspaceContextMode,
} from "@/types/captenly";
import { PROHIBITED_MEDICAL_KEYWORDS } from "@/data/seedData";
import {
  formatEgyptianWhatsapp,
  getDefaultWorkspaceContextForPersona,
} from "./storageHelpers";
import type { CaptenlyContextType, SubmitRoleClaimPayload } from "./types";

export interface RoleClaimsAndStaffDeps {
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  allPersonas: PersonaAccount[];
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  memberRegistry: MemberRegistryEntry[];
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  setCoaches: React.Dispatch<React.SetStateAction<Coach[]>>;
  updateFacilityAndSync: (facilityId: string, updater: (f: Facility) => Facility) => void;
  pushNotification: (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => void;
}

export function useRoleClaimsAndStaff({
  isAuthenticated,
  currentPersona,
  facilities,
  depsRef,
}: {
  isAuthenticated: boolean;
  currentPersona: PersonaAccount;
  facilities: Facility[];
  depsRef: React.MutableRefObject<RoleClaimsAndStaffDeps>;
}) {
  const [roleClaims, setRoleClaims] = useState<MemberRoleClaim[]>([]);
  const [activeStaffAssignmentId, setActiveStaffAssignmentId] = useState<string | null>(null);
  const [activeWorkspaceContext, setActiveWorkspaceContextState] =
    useState<WorkspaceContextMode>("member");

  const refreshRoleClaims = async (adminMode = false) => {
    if (typeof window === "undefined") return;
    const { currentPersona } = depsRef.current;
    if (!adminMode && (currentPersona.role === "guest" || currentPersona.id === "persona-guest")) {
      setRoleClaims([]);
      return;
    }
    try {
      const res = await fetch(
        adminMode ? "/api/supabase/role-claims?scope=admin" : "/api/supabase/role-claims",
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.claims)) {
        setRoleClaims(data.claims as MemberRoleClaim[]);
      }
    } catch {
      // Ignore offline/network failures
    }
  };

  const submitRoleClaimApplication = async (payload: SubmitRoleClaimPayload) => {
    const { isAuthenticated, currentPersona, facilities, pushNotification } = depsRef.current;
    if (!isAuthenticated || currentPersona.role === "guest" || currentPersona.id === "persona-guest") {
      return {
        ok: false,
        messageAr: "يجب تسجيل الدخول أولاً بحساب كابتنلي لتقديم طلب التوثيق.",
      };
    }

    const cleanWa = (payload.whatsappNumber || "").replace(/\D/g, "");
    const cleanFb = (payload.facebookUrl || payload.socialLinks?.facebook || "").trim();
    const cleanIg = (payload.instagramUrl || payload.socialLinks?.instagram || "").trim();
    const cleanPhone = (payload.phone || currentPersona.phone || "").replace(/\D/g, "");

    if (!cleanWa && !cleanFb && !cleanIg && !cleanPhone) {
      return {
        ok: false,
        messageAr:
          "يرجى إدخال وسيلة تواصل واحدة على الأقل (رقم موبايل أو واتساب أو رابط حساب تواصل).",
      };
    }

    if (payload.claimType === "coach") {
      const bio = payload.bioAr || "";
      const detected = PROHIBITED_MEDICAL_KEYWORDS.find((kw) => bio.includes(kw));
      if (detected) {
        return {
          ok: false,
          detectedKeyword: detected,
          messageAr: `حظر قانوني تلقائي (قانون مزاولة مهنة العلاج الطبيعي رقم 3 لسنة 1985): يرجى إزالة مصطلح «${detected}» لغير الأطباء المرخصين.`,
        };
      }
    }

    const targetFacility =
      facilities.find((f) => f.id === payload.targetFacilityId) ||
      facilities.find((f) => f.id === payload.affiliatedFacilityId);

    const formattedWa = formatEgyptianWhatsapp(payload.whatsappNumber);
    const proposedPayload: Record<string, unknown> = {
      fullNameAr: payload.fullNameAr || currentPersona.fullNameAr,
      titleAr: payload.titleAr || "",
      sportSector: "swimming",
      governorate:
        payload.governorate || targetFacility?.governorate || currentPersona.city || "كل مصر",
      city: payload.city || targetFacility?.city || currentPersona.city || "كل مصر",
      district: payload.district || targetFacility?.district || "",
      yearsExperience: payload.yearsExperience ?? 0,
      bioAr: payload.bioAr || "",
      avatarUrl: payload.avatarUrl || currentPersona.avatarUrl || "",
      whatsappNumber: formattedWa,
      facebookUrl: cleanFb || undefined,
      instagramUrl: cleanIg || undefined,
      socialLinks: {
        ...(payload.socialLinks || {}),
        ...(cleanFb ? { facebook: cleanFb } : {}),
        ...(cleanIg ? { instagram: cleanIg } : {}),
      },
      instapayHandle: payload.instapayHandle,
      privatePackage8Egp: payload.privatePackage8Egp,
      privatePackage12Egp: payload.privatePackage12Egp,
      specialtiesAr: payload.specialtiesAr,
      syndicateCardRef: payload.syndicateCardRef,
      edlfCertRef: payload.edlfCertRef,
      affiliatedFacilityId: payload.affiliatedFacilityId || targetFacility?.id,
      managerName: payload.managerName || currentPersona.fullNameAr,
      roleTitleAr: payload.roleTitleAr,
      phone: payload.phone || currentPersona.phone,
      commercialRegRef: payload.commercialRegRef,
      updatedBasePriceEgp: payload.updatedBasePriceEgp,
    };

    try {
      const res = await fetch("/api/supabase/role-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimType: payload.claimType,
          applicantNameAr:
            payload.claimType === "facility"
              ? payload.managerName || payload.fullNameAr || currentPersona.fullNameAr
              : payload.fullNameAr || currentPersona.fullNameAr,
          applicantPhone: payload.phone || currentPersona.phone || "",
          applicantEmail: currentPersona.email || "",
          targetFacilityId: payload.targetFacilityId || targetFacility?.id || undefined,
          targetFacilityNameAr: targetFacility?.nameAr,
          cityAr: payload.city || targetFacility?.city || currentPersona.city || "كل مصر",
          governorateAr: payload.governorate || targetFacility?.governorate || "مصر",
          proofDocumentUrl: payload.proofDocumentUrl,
          proofNotesAr: payload.proofNotesAr,
          proposedPayload,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.claim) {
        return {
          ok: false,
          messageAr:
            data?.messageAr ||
            "تعذّر إرسال طلب التوثيق حالياً. تأكد من تسجيل الدخول وصحة البيانات ثم أعد المحاولة.",
        };
      }
      const savedClaim = data.claim as MemberRoleClaim;
      setRoleClaims((prev) => [savedClaim, ...prev.filter((c) => c.id !== savedClaim.id)]);
      pushNotification({
        titleAr:
          payload.claimType === "facility"
            ? `تم استلام طلب توثيق منشأة ${targetFacility?.nameAr || ""}`.trim()
            : "تم استلام طلب التوثيق ككابتن للمراجعة",
        messageAr:
          "يراجع فريق كابتنلي مستنداتك الآن. سيبقى حسابك الحالي مفعلاً بالكامل حتى صدور قرار الاعتماد.",
        type: "passport_badge",
        actionLabelAr: "متابعة حالة الطلب",
        actionHref: "/claim",
      });
      return {
        ok: true,
        claim: savedClaim,
        messageAr:
          data.messageAr ||
          "تم استلام طلب التوثيق بنجاح وهو الآن قيد المراجعة الإدارية — سيبقى حسابك الحالي فعالاً حتى الاعتماد.",
      };
    } catch {
      return { ok: false, messageAr: "تعذّر الاتصال بالخادم لإرسال طلب التوثيق. حاول مرة أخرى." };
    }
  };

  const reviewRoleClaim: CaptenlyContextType["reviewRoleClaim"] = async (
    claimId,
    decision,
    reviewerNoteAr
  ) => {
    const { currentPersona, setCurrentPersona, setAllPersonas, setFacilities, setCoaches } =
      depsRef.current;
    try {
      const res = await fetch("/api/supabase/role-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId, action: decision, reviewerNoteAr }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.claim) {
        return { ok: false, messageAr: data?.messageAr || "تعذّر تنفيذ قرار المراجعة الإدارية للطلب." };
      }
      const updatedClaim = data.claim as MemberRoleClaim;
      setRoleClaims((prev) => prev.map((c) => (c.id === updatedClaim.id ? updatedClaim : c)));

      if (decision === "approve") {
        fetch("/api/supabase/public-supply", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((supply) => {
            if (!supply) return;
            if (Array.isArray(supply.facilities)) setFacilities(supply.facilities);
            if (Array.isArray(supply.coaches)) setCoaches(supply.coaches);
          })
          .catch(() => undefined);

        if (
          currentPersona.memberCode &&
          updatedClaim.applicantMemberCode.toUpperCase() === currentPersona.memberCode.toUpperCase()
        ) {
          const nextRole: PersonaAccount["role"] =
            updatedClaim.claimType === "facility" ? "facility_manager" : "coach";
          setCurrentPersona((prev) => {
            const nextPersona: PersonaAccount = {
              ...prev,
              role: nextRole,
              linkedCoachId:
                typeof data.approvedCoachId === "string"
                  ? data.approvedCoachId
                  : prev.linkedCoachId,
              linkedFacilityId:
                typeof data.approvedFacilityId === "string"
                  ? data.approvedFacilityId
                  : prev.linkedFacilityId,
            };
            setAllPersonas((list) => list.map((p) => (p.id === nextPersona.id ? nextPersona : p)));
            return nextPersona;
          });
        }
      }

      return {
        ok: true,
        claim: updatedClaim,
        messageAr:
          decision === "approve"
            ? "تم اعتماد الطلب وتفعيل الصلاحيات الرسمية في المنصة بنجاح."
            : decision === "withdraw"
              ? "تم سحب طلب التوثيق بنجاح."
              : "تم رفض الطلب وتسجيل ملاحظة المراجعة للمتقدم.",
      };
    } catch {
      return { ok: false, messageAr: "تعذّر الاتصال بالخادم لتحديث حالة الطلب." };
    }
  };

  const lookupStaffCandidatesRemote: CaptenlyContextType["lookupStaffCandidatesRemote"] = async (
    query
  ) => {
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      const res = await fetch(`/api/supabase/staff-lookup?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.candidates) ? data.candidates : [];
    } catch {
      return [];
    }
  };

  // Compute staff assignments directly from explicit props (safe during SSR/initial render)

  const myStaffAssignments: FacilityStaffMember[] = useMemo(() => {
    if (!isAuthenticated) return [];
    return facilities.flatMap((fac) =>
      (fac.staffMembers || []).filter((st) => {
        if (st.invitationStatus === "declined" || st.invitationStatus === "revoked") return false;
        if (st.linkedPersonaId && st.linkedPersonaId === currentPersona.id) return true;
        if (
          st.linkedMemberCode &&
          currentPersona.memberCode &&
          st.linkedMemberCode.trim().toUpperCase() === currentPersona.memberCode.trim().toUpperCase()
        ) {
          return true;
        }
        if (
          st.email &&
          currentPersona.email &&
          st.email.trim().toLowerCase() === currentPersona.email.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      })
    );
  }, [facilities, isAuthenticated, currentPersona.id, currentPersona.memberCode, currentPersona.email]);

  const activeStaffAssignment: FacilityStaffMember | null = useMemo(
    () =>
      myStaffAssignments.find(
        (s) => s.id === activeStaffAssignmentId && s.invitationStatus !== "pending"
      ) || null,
    [myStaffAssignments, activeStaffAssignmentId]
  );

  const resolvedActiveStaffFacilityId = useMemo(
    () =>
      activeStaffAssignmentId
        ? facilities.find((f) =>
            (f.staffMembers || []).some(
              (st) => st.id === activeStaffAssignmentId && st.invitationStatus !== "pending"
            )
          )?.id || undefined
        : undefined,
    [activeStaffAssignmentId, facilities]
  );

  const switchToStaffMode = (staffAssignmentId: string | null) => {
    const { currentPersona: persona, pushNotification } = depsRef.current;
    if (staffAssignmentId) {
      const target = myStaffAssignments.find((s) => s.id === staffAssignmentId);
      if (!target) return;
      if (target.invitationStatus === "pending") {
        pushNotification({
          titleAr: `دعوة عمل معلقة لدى ${target.facilityNameAr}`,
          messageAr: `يرجى قبول الدعوة الوظيفية كـ «${target.roleTitleAr}» أولاً لتفعيل لوحة المنشأة.`,
          type: "system",
          actionLabelAr: "إدارة الدعوات",
          actionHref: "/dashboard/athlete/settings",
        });
        return;
      }
      setActiveStaffAssignmentId(staffAssignmentId);
      setActiveWorkspaceContextState("staff");
      pushNotification({
        titleAr: `تبديل الحساب: ${target.roleTitleAr}`,
        messageAr: `أنت الآن تعمل بصلاحية «${target.roleTitleAr}» داخل ${target.facilityNameAr}.`,
        type: "passport_badge",
        actionLabelAr: "فتح لوحة المنشأة",
        actionHref: "/dashboard/facility",
      });
      return;
    }
    setActiveStaffAssignmentId(null);
    setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(persona));
  };

  const switchWorkspaceContext: CaptenlyContextType["switchWorkspaceContext"] = (
    mode,
    staffAssignmentId
  ) => {
    const persona = depsRef.current.currentPersona;
    if (mode === "member") {
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState("member");
      return;
    }
    if (mode === "coach" && (persona.linkedCoachId || persona.role === "coach")) {
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState("coach");
      return;
    }
    if (mode === "facility" && (persona.linkedFacilityId || persona.role === "facility_manager")) {
      setActiveStaffAssignmentId(null);
      setActiveWorkspaceContextState("facility");
      return;
    }
    if (mode === "staff") {
      const targetId =
        staffAssignmentId ||
        myStaffAssignments.find((s) => s.invitationStatus !== "pending")?.id ||
        null;
      if (targetId) switchToStaffMode(targetId);
    }
  };

  const respondToStaffInvitation: CaptenlyContextType["respondToStaffInvitation"] = async (
    facilityId,
    staffId,
    decision
  ) => {
    const {
      facilities: facList,
      currentPersona: persona,
      setFacilities,
      pushNotification,
    } = depsRef.current;
    const targetFac = facList.find((f) => f.id === facilityId);
    const targetStaff = targetFac?.staffMembers?.find((s) => s.id === staffId);
    if (!targetFac || !targetStaff) {
      pushNotification({
        titleAr: "تعذر العثور على الدعوة",
        messageAr: "لم يتم العثور على بيانات الدعوة أو المنشأة المطلوبة.",
        type: "system",
      });
      return;
    }

    try {
      const res = await fetch("/api/supabase/staff-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, staffId, decision }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        pushNotification({
          titleAr: `تعذر تحديث دعوة ${targetFac.nameAr}`,
          messageAr:
            data?.messageAr ||
            (res.status === 401
              ? "يرجى تسجيل الدخول أولاً للرد على دعوة العمل."
              : res.status === 403
                ? "غير مصرح لك بالرد على هذه الدعوة."
                : res.status === 409
                  ? "تم الرد على هذه الدعوة مسبقاً."
                  : res.status === 410
                    ? "انتهت صلاحية هذه الدعوة أو تم إلغاؤها."
                    : "تعذر حفظ الرد على الدعوة في الخادم حالياً. حاول مرة أخرى."),
          type: "system",
        });
        return;
      }

      const returnedStaffList = Array.isArray(data?.facility?.staffMembers)
        ? (data.facility.staffMembers as FacilityStaffMember[])
        : null;
      const updatedRemoteStaff = returnedStaffList?.find((s) => s.id === staffId);

      setFacilities((prev) =>
        prev.map((f) => {
          if (f.id !== facilityId) return f;
          return {
            ...f,
            staffMembers: (f.staffMembers || []).map((st) =>
              st.id === staffId
                ? {
                    ...st,
                    ...(updatedRemoteStaff || {}),
                    role: updatedRemoteStaff?.role || st.role,
                    invitationStatus: decision,
                    assignedDateAr:
                      updatedRemoteStaff?.assignedDateAr ||
                      (decision === "accepted" ? "اليوم — دعوة مقبولة ✓" : "تم رفض الدعوة"),
                  }
                : st
            ),
          };
        })
      );

      if (decision === "declined" && activeStaffAssignmentId === staffId) {
        setActiveStaffAssignmentId(null);
        setActiveWorkspaceContextState(getDefaultWorkspaceContextForPersona(persona));
      }

      pushNotification({
        titleAr:
          decision === "accepted"
            ? `تم قبول الانضمام لطاقم ${targetFac.nameAr}`
            : `تم رفض دعوة ${targetFac.nameAr}`,
        messageAr:
          decision === "accepted"
            ? `يمكنك الآن التبديل إلى وضع موظف (${targetStaff.roleTitleAr}) في أي وقت.`
            : `تم تحديث حالة الدعوة الخاصة بـ ${targetFac.nameAr}.`,
        type: "system",
        actionLabelAr: decision === "accepted" ? "تبديل وضع العمل" : undefined,
        actionHref: decision === "accepted" ? "/dashboard/athlete/settings" : undefined,
      });
    } catch {
      pushNotification({
        titleAr: `تعذر الاتصال بالخادم لدعوة ${targetFac.nameAr}`,
        messageAr: "تحقق من اتصال الإنترنت ثم أعد المحاولة — لم يتم تغيير حالة الدعوة.",
        type: "system",
      });
    }
  };

  const addFacilityStaffMember: CaptenlyContextType["addFacilityStaffMember"] = (
    facilityId,
    payload
  ) => {
    const { facilities: facList, allPersonas, memberRegistry, updateFacilityAndSync, pushNotification } =
      depsRef.current;
    const cleanName = payload.fullNameAr.trim();
    if (!cleanName) return { ok: false, messageAr: "يرجى إدخال اسم الموظف رباعياً أو ثلاثياً." };
    const fac = facList.find((f) => f.id === facilityId);
    if (!fac) return { ok: false, messageAr: "لم يتم العثور على المنشأة." };

    const defaultRoleTitles: Record<FacilityStaffRole, string> = {
      subscriptions_manager: "مسؤول الاشتراكات والحضور",
      accounts_manager: "مدير الحسابات والماليات",
      general_staff: "إداري بالمنشأة",
    };

    const query = (payload.memberCodeOrQuery || "").trim();
    const emailInput = (payload.email || "").trim().toLowerCase();
    const matchedPersona = allPersonas.find(
      (p) =>
        p.id !== "persona-guest" &&
        ((query &&
          ((p.memberCode && p.memberCode.toUpperCase() === query.toUpperCase()) ||
            (p.email && p.email.toLowerCase() === query.toLowerCase()))) ||
          (emailInput && p.email && p.email.toLowerCase() === emailInput) ||
          p.fullNameAr.trim() === cleanName)
    );
    const matchedRegistry = memberRegistry.find(
      (m) =>
        (query &&
          (m.memberCode.toUpperCase() === query.toUpperCase() ||
            (m.email && m.email.toLowerCase() === query.toLowerCase()))) ||
        (emailInput && m.email && m.email.toLowerCase() === emailInput) ||
        m.fullNameAr.trim() === cleanName
    );

    const hasAccount = Boolean(
      matchedPersona || matchedRegistry || query.toUpperCase().startsWith("CAP-")
    );
    const linkedMemberCode =
      matchedPersona?.memberCode ||
      matchedRegistry?.memberCode ||
      (query.toUpperCase().startsWith("CAP-") ? query.toUpperCase() : undefined);
    const resolvedEmail =
      emailInput ||
      matchedPersona?.email ||
      matchedRegistry?.email ||
      (query.includes("@") ? query.toLowerCase() : undefined);

    const newStaff: FacilityStaffMember = {
      id: `staff-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      facilityId: fac.id,
      facilityNameAr: fac.nameAr,
      fullNameAr: matchedPersona?.fullNameAr || matchedRegistry?.fullNameAr || cleanName,
      role: payload.role,
      roleTitleAr: payload.roleTitleAr?.trim() || defaultRoleTitles[payload.role],
      phone: payload.phone?.trim() || matchedPersona?.phone || matchedRegistry?.phone,
      email: resolvedEmail,
      linkedMemberCode,
      linkedPersonaId: matchedPersona?.id,
      hasAccount,
      invitationStatus: hasAccount ? "pending" : "accepted",
      assignedDateAr: hasAccount ? "اليوم — دعوة بانتظار القبول" : "اليوم — سجل داخلي",
    };

    updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: [newStaff, ...(f.staffMembers || [])],
    }));

    pushNotification({
      targetMemberCode: linkedMemberCode || undefined,
      titleAr: hasAccount
        ? `دعوة عمل جديدة لدى ${fac.nameAr}`
        : `تم تسجيل ${newStaff.fullNameAr} (${newStaff.roleTitleAr})`,
      messageAr: hasAccount
        ? `دعتك إدارة ${fac.nameAr} للانضمام بصلاحية «${newStaff.roleTitleAr}». يمكنك قبول الدعوة أو رفضها من الإعدادات أو القائمة العلوية.`
        : `تم تسجيل ${newStaff.fullNameAr} ضمن طاقم ${fac.nameAr} بدون اشتراط حساب شخصي.`,
      type: "passport_badge",
      actionLabelAr: hasAccount ? "قبول أو رفض الدعوة" : undefined,
      actionHref: hasAccount ? "/dashboard/athlete/settings" : undefined,
    });

    return {
      ok: true,
      staff: newStaff,
      messageAr: hasAccount
        ? `تم إرسال دعوة العمل لـ «${newStaff.fullNameAr}» بصلاحية (${newStaff.roleTitleAr}) بنجاح — تُفعّل فور قبوله الدعوة.`
        : `تم تسجيل «${newStaff.fullNameAr}» (${newStaff.roleTitleAr}) ضمن موظفي المنشأة بنجاح.`,
    };
  };

  const removeFacilityStaffMember = (facilityId: string, staffId: string) => {
    if (activeStaffAssignmentId === staffId) setActiveStaffAssignmentId(null);
    depsRef.current.updateFacilityAndSync(facilityId, (f) => ({
      ...f,
      staffMembers: (f.staffMembers || []).filter((s) => s.id !== staffId),
    }));
  };

  return {
    roleClaims,
    setRoleClaims,
    activeStaffAssignmentId,
    setActiveStaffAssignmentId,
    activeWorkspaceContext,
    setActiveWorkspaceContextState,
    myStaffAssignments,
    activeStaffAssignment,
    resolvedActiveStaffFacilityId,
    refreshRoleClaims,
    submitRoleClaimApplication,
    reviewRoleClaim,
    lookupStaffCandidatesRemote,
    switchToStaffMode,
    switchWorkspaceContext,
    respondToStaffInvitation,
    addFacilityStaffMember,
    removeFacilityStaffMember,
  };
}
