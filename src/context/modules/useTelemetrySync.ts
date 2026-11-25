"use client";

import { useEffect } from "react";
import type {
  MinorAthleteProfile,
  NotificationItem,
  PersonaAccount,
  PersonalBestRecord,
  SkillEvaluation5Point,
  UserLocation,
  VerifiedLeadItem,
} from "@/types/captenly";
import {
  DEFAULT_USER_SETTINGS,
  generateChildSubCode,
  getProfileSyncKey,
  postSupabaseSync,
} from "./storageHelpers";
import type { UserSettingsState } from "./payloadTypes";

export interface TelemetrySyncInput {
  currentPersona: PersonaAccount;
  minorAthletes: MinorAthleteProfile[];
  setMinorAthletes: React.Dispatch<React.SetStateAction<MinorAthleteProfile[]>>;
  setPbRecords: React.Dispatch<React.SetStateAction<PersonalBestRecord[]>>;
  setSkillEvaluationsByAthlete: React.Dispatch<
    React.SetStateAction<Record<string, SkillEvaluation5Point>>
  >;
  setVerifiedLeads: React.Dispatch<React.SetStateAction<VerifiedLeadItem[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettingsState>>;
  setSavedFavoriteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCompareFacilityIds: React.Dispatch<React.SetStateAction<string[]>>;
  setUserLocation: React.Dispatch<React.SetStateAction<UserLocation>>;
}

export function useTelemetrySyncEffects(input: TelemetrySyncInput) {
  const {
    currentPersona,
    minorAthletes,
    setMinorAthletes,
    setPbRecords,
    setSkillEvaluationsByAthlete,
    setVerifiedLeads,
    setNotifications,
    setUserSettings,
    setSavedFavoriteIds,
    setCompareFacilityIds,
    setUserLocation,
  } = input;

  // Hydrate persisted remote notifications for active memberCode when available
  useEffect(() => {
    const memberCode = currentPersona.memberCode;
    if (!memberCode || currentPersona.needsOnboarding) return;
    let cancelled = false;
    fetch(`/api/supabase/notifications?memberCode=${encodeURIComponent(memberCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.persisted || !Array.isArray(data.items) || data.items.length === 0) {
          return;
        }
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const existingSignatures = new Set(prev.map((n) => `${n.titleAr}::${n.messageAr}`));
          const mapped: NotificationItem[] = [];
          for (const row of data.items) {
            const sig = `${row.title_ar}::${row.message_ar}`;
            if (existingIds.has(row.id) || existingSignatures.has(sig)) continue;
            mapped.push({
              id: row.id,
              titleAr: row.title_ar,
              messageAr: row.message_ar,
              type: (row.notif_type || "system") as NotificationItem["type"],
              actionLabelAr: row.action_label_ar || undefined,
              actionHref: row.action_href || undefined,
              isRead: Boolean(row.is_read),
              timeAr: "سحابي",
            });
          }
          return mapped.length > 0 ? [...mapped, ...prev] : prev;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentPersona.memberCode, currentPersona.needsOnboarding, setNotifications]);

  // Hydrate PB records, 5-point evaluations, family minor children, saved prefs, and leads from Supabase
  useEffect(() => {
    const profileKey = getProfileSyncKey(currentPersona);
    if (!profileKey || currentPersona.needsOnboarding) return;
    let cancelled = false;
    const athleteIds = [currentPersona.id, ...minorAthletes.map((m) => m.id)]
      .filter(Boolean)
      .join(",");

    fetch(
      `/api/supabase/user-state?memberCode=${encodeURIComponent(profileKey)}&athleteIds=${encodeURIComponent(athleteIds)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        if (Array.isArray(data.pbRecords) && data.pbRecords.length > 0) {
          setPbRecords((prev) => {
            const byId = new Map(prev.map((r) => [r.id, r]));
            for (const rec of data.pbRecords as PersonalBestRecord[]) {
              if (rec?.id) byId.set(rec.id, rec);
            }
            return Array.from(byId.values());
          });
        }
        if (data.skillEvaluations && typeof data.skillEvaluations === "object") {
          setSkillEvaluationsByAthlete((prev) => ({
            ...prev,
            ...(data.skillEvaluations as Record<string, SkillEvaluation5Point>),
          }));
        }
        if (Array.isArray(data.minorAthletes) && data.minorAthletes.length > 0) {
          setMinorAthletes((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]));
            let seq = 0;
            for (const child of data.minorAthletes as MinorAthleteProfile[]) {
              if (!child?.id) continue;
              seq += 1;
              byId.set(child.id, {
                ...child,
                childMemberCode:
                  child.childMemberCode || generateChildSubCode(currentPersona.memberCode, seq),
                parentMemberCode: child.parentMemberCode || currentPersona.memberCode || undefined,
              });
            }
            return Array.from(byId.values());
          });
        }
        if (data.prefs) {
          if (Array.isArray(data.prefs.favorites)) {
            setSavedFavoriteIds(data.prefs.favorites as string[]);
          }
          if (Array.isArray(data.prefs.compareIds)) {
            setCompareFacilityIds(data.prefs.compareIds as string[]);
          }
          if (data.prefs.userSettings && typeof data.prefs.userSettings === "object") {
            setUserSettings({ ...DEFAULT_USER_SETTINGS, ...data.prefs.userSettings });
          } else {
            setUserSettings(DEFAULT_USER_SETTINGS);
          }
          if (data.prefs.userLocation && data.prefs.userLocation.isSpecified) {
            setUserLocation(data.prefs.userLocation as UserLocation);
          }
        }
      })
      .catch(() => undefined);

    const leadTargetId = currentPersona.linkedFacilityId || currentPersona.linkedCoachId;
    if (leadTargetId) {
      fetch(`/api/supabase/leads?targetId=${encodeURIComponent(leadTargetId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok || !Array.isArray(data.leads) || data.leads.length === 0) return;
          setVerifiedLeads((prev) => {
            const byId = new Map(prev.map((l) => [l.id, l]));
            for (const item of data.leads as Array<{
              id: string;
              facilityId: string;
              facilityNameAr: string;
              memberNameAr: string;
              phone: string;
              packageNameAr: string;
              notes?: string;
              createdAt?: string;
            }>) {
              if (!item.id || byId.has(item.id)) continue;
              byId.set(item.id, {
                id: item.id,
                referralCode: `CAP-L-${item.id.slice(-4).toUpperCase()}`,
                targetType: currentPersona.linkedCoachId ? "coach" : "facility",
                targetId: item.facilityId,
                targetNameAr: item.facilityNameAr || currentPersona.fullNameAr,
                inquirerNameAr: item.memberNameAr || "متدرب كابتنلي",
                inquirerPhone: item.phone || "",
                athleteAge: 10,
                requestedSpecialtyAr: item.packageNameAr || "استفسار باقة تدريب",
                preferredScheduleAr: item.notes || "عبر واتساب كابتنلي",
                createdAtAr: item.createdAt ? item.createdAt.slice(0, 10) : "سحابي",
                repliedWithin2h: true,
                replyMinutes: 15,
                convertedToLedger: false,
              });
            }
            return Array.from(byId.values());
          });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPersona.id,
    currentPersona.memberCode,
    currentPersona.linkedFacilityId,
    currentPersona.linkedCoachId,
  ]);
}

export function createPushNotification(
  getCurrentPersona: () => PersonaAccount,
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>
) {
  return (
    notif: Omit<NotificationItem, "id" | "isRead" | "timeAr"> & { targetMemberCode?: string }
  ) => {
    const { targetMemberCode, ...rest } = notif;
    const selfCode = getProfileSyncKey(getCurrentPersona());
    const recipientCode = (targetMemberCode || selfCode).trim();
    const isForSelf = !targetMemberCode || targetMemberCode.trim() === selfCode;

    if (isForSelf) {
      setNotifications((prev) => [
        {
          ...rest,
          id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timeAr: "الآن",
          isRead: false,
        },
        ...prev,
      ]);
    }
    if (recipientCode) {
      postSupabaseSync("/api/supabase/notifications", {
        memberCode: recipientCode,
        titleAr: rest.titleAr,
        messageAr: rest.messageAr,
        type: rest.type,
        actionLabelAr: rest.actionLabelAr,
        actionHref: rest.actionHref,
      });
    }
  };
}
