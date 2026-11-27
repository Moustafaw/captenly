"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Facility, PersonaAccount, SmartFiltersState, UserLocation } from "@/types/captenly";
import { EGYPT_CITY_PRESETS, calculateDistanceKm } from "@/lib/maps";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";
import {
  DEFAULT_EGYPT_LOCATION,
  DEFAULT_SMART_FILTERS,
  postSupabaseSync,
} from "./storageHelpers";

function isPlacesDiscoveryPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/explore") ||
    pathname.startsWith("/pools") ||
    pathname.startsWith("/location") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/academy") ||
    pathname.startsWith("/f/") ||
    pathname.startsWith("/claim")
  );
}

export interface DiscoveryDomainDeps {
  isAuthenticated: boolean;
  openAuthGateModal: (featureNameAr?: string) => void;
  persistPrefsToRemote: (
    prefs: {
      favorites?: string[];
      compareIds?: string[];
      userSettings?: Record<string, unknown>;
      userLocation?: Record<string, unknown>;
    },
    overrideMemberCode?: string
  ) => void;
  setCurrentPersona: React.Dispatch<React.SetStateAction<PersonaAccount>>;
  setAllPersonas: React.Dispatch<React.SetStateAction<PersonaAccount[]>>;
  syncRegistryCity: (athleteId: string, city: string) => void;
}

export function useDiscoveryDomain({
  facilities,
  setFacilities,
  depsRef,
}: {
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  depsRef: React.MutableRefObject<DiscoveryDomainDeps>;
}) {
  const pathname = usePathname() || "/";
  const [placesHydrating, setPlacesHydrating] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<UserLocation>(DEFAULT_EGYPT_LOCATION);
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [smartFilters, setSmartFilters] = useState<SmartFiltersState>(DEFAULT_SMART_FILTERS);
  const [savedFavoriteIds, setSavedFavoriteIds] = useState<string[]>([]);
  const [compareFacilityIds, setCompareFacilityIds] = useState<string[]>([]);

  const facilitiesRef = useRef(facilities);
  facilitiesRef.current = facilities;
  const lastFetchedKeyRef = useRef<string | null>(null);

  // Auto-fetch live swimming pools from Places / OSM ONLY on discovery routes (deferred on /)
  useEffect(() => {
    const isDiscoveryRoute = isPlacesDiscoveryPath(pathname);
    if (!isDiscoveryRoute) {
      setPlacesHydrating(false);
      return;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const isImmediatePlacesPath =
      pathname.startsWith("/explore") ||
      pathname.startsWith("/pools") ||
      pathname.startsWith("/location") ||
      pathname.startsWith("/compare") ||
      userLocation.isSpecified;

    const queryKey = userLocation.isSpecified
      ? `${userLocation.city}|${userLocation.lat}|${userLocation.lng}|${smartFilters.maxDistanceKm}`
      : "egypt";

    if (lastFetchedKeyRef.current === queryKey && !isImmediatePlacesPath) {
      setPlacesHydrating(false);
      return;
    }

    const runPlacesSearch = () => {
      if (cancelled) return;
      lastFetchedKeyRef.current = queryKey;
      setPlacesHydrating(true);
      const params = new URLSearchParams();
      const cleanCityParam = (userLocation.city || "")
        .replace(/\s*\(GPS\)/g, "")
        .replace(/موقعك الحالي/g, "")
        .replace(/موقع محدد على الخريطة/g, "")
        .replace(/كل مصر/g, "")
        .replace(/^الكل$/g, "")
        .trim();

      if (userLocation.isSpecified) {
        if (cleanCityParam) params.set("city", cleanCityParam);
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
        params.set("radius", String(smartFilters.maxDistanceKm || 25));
      } else {
        params.set("scope", "egypt");
      }

      fetch(`/api/places/search?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (Array.isArray(data?.places)) {
            const freshExternal = data.places as Facility[];
            setFacilities((prev) => {
              const registered = prev.filter((f) => f.supplyStatus !== "seeded_unclaimed");
              const registeredPlaceIds = new Set(
                registered.map((f) => f.googlePlaceId).filter(Boolean)
              );
              const registeredIds = new Set(registered.map((f) => f.id));
              const uniqueExternal = freshExternal.filter(
                (ext) =>
                  !registeredIds.has(ext.id) &&
                  (!ext.googlePlaceId || !registeredPlaceIds.has(ext.googlePlaceId))
              );
              if (uniqueExternal.length === 0 && prev.length === registered.length) {
                return prev;
              }
              return [...registered, ...uniqueExternal];
            });
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setPlacesHydrating(false);
        });
    };

    if (isImmediatePlacesPath) {
      runPlacesSearch();
    } else if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(runPlacesSearch, { timeout: 2500 });
    } else {
      timeoutHandle = setTimeout(runPlacesSearch, 1800);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(
          idleHandle
        );
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [
    pathname,
    userLocation.isSpecified,
    userLocation.city,
    userLocation.lat,
    userLocation.lng,
    smartFilters.maxDistanceKm,
    setFacilities,
  ]);

  const getNearestFacilityDistance = useCallback((lat: number, lng: number) => {
    const list = facilitiesRef.current;
    if (list.length === 0) return 0;
    const minDist = Math.min(
      ...list.map((f) => calculateDistanceKm(lat, lng, f.coordinates.lat, f.coordinates.lng))
    );
    return Math.round(minDist * 10) / 10;
  }, []);

  const syncAccountCityFromLocation = useCallback(
    (cleanCity: string, cleanGov = "مصر") => {
      if (!cleanCity || cleanCity === "كل مصر" || cleanCity === "الكل") return;
      const normalizedCity = cleanCity.replace(/\s*\(GPS\)/g, "").trim();
      if (!normalizedCity || normalizedCity === "موقعك الحالي") return;

      const { setCurrentPersona, setAllPersonas, syncRegistryCity } = depsRef.current;
      setCurrentPersona((prev) => {
        if (prev.role === "guest" || prev.id === "persona-guest" || prev.needsOnboarding) return prev;
        if (prev.city === normalizedCity) return prev;
        const next: PersonaAccount = { ...prev, city: normalizedCity };
        setAllPersonas((list) => list.map((p) => (p.id === next.id ? next : p)));
        syncRegistryCity(next.id, normalizedCity);
        if (next.memberCode || next.email) {
          postSupabaseSync("/api/supabase/sync-profile", {
            memberCode: next.memberCode || `FAC-${next.id.slice(-6)}`,
            email: next.email,
            fullNameAr: next.fullNameAr,
            role: next.role,
            phone: next.phone,
            city: normalizedCity,
            governorate: cleanGov,
            avatarUrl: next.avatarUrl,
            bioAr: next.bioAr,
            socialLinks: next.socialLinks,
            hasParentSupervision: next.hasParentSupervision,
            needsOnboarding: false,
          });
        }
        return next;
      });
    },
    [depsRef]
  );

  const applyAccountCityToUserLocation = useCallback(
    (accountCity?: string, accountGov = "مصر") => {
      const clean = (accountCity || "").trim();
      if (!clean || clean === "مصر" || clean === "كل مصر" || clean === "الكل") {
        setUserLocation(DEFAULT_EGYPT_LOCATION);
        return;
      }
      const preset = EGYPT_CITY_PRESETS.find((p) => p.city === clean || clean.includes(p.city));
      const lat = preset?.lat ?? (clean === "طنطا" ? 30.7865 : clean === "زفتى" ? 30.7124 : 30.0444);
      const lng = preset?.lng ?? (clean === "طنطا" ? 31.0004 : clean === "زفتى" ? 31.2423 : 31.2357);
      const dist = facilitiesRef.current.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;

      setUserLocation({
        city: preset?.city || clean,
        governorate: preset?.governorate || accountGov,
        lat,
        lng,
        isAutoDetected: false,
        isSpecified: true,
        distanceKm: dist,
        isOutsideCoverage: false,
      });
    },
    [getNearestFacilityDistance]
  );

  const setUserCoordinates = useCallback(
    ({
      lat,
      lng,
      city,
      governorate = "مصر",
    }: {
      lat: number;
      lng: number;
      city: string;
      governorate?: string;
    }) => {
      const distanceKm = facilitiesRef.current.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;
      setUserLocation({
        city,
        governorate,
        lat,
        lng,
        isAutoDetected: false,
        isSpecified: true,
        distanceKm,
        isOutsideCoverage: false,
      });
      syncAccountCityFromLocation(city, governorate);
    },
    [getNearestFacilityDistance, syncAccountCityFromLocation]
  );

  const setUserCity = useCallback(
    (city: string, gov = "مصر") => {
      if (!city || city === "كل مصر" || city === "الكل") {
        setUserLocation(DEFAULT_EGYPT_LOCATION);
        depsRef.current.persistPrefsToRemote({
          userLocation: DEFAULT_EGYPT_LOCATION as unknown as Record<string, unknown>,
        });
        return;
      }
      const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
      const lat = preset?.lat ?? (city === "طنطا" ? 30.7865 : city === "زفتى" ? 30.7124 : 30.0444);
      const lng = preset?.lng ?? (city === "طنطا" ? 31.0004 : city === "زفتى" ? 31.2423 : 31.2357);
      const dist = facilitiesRef.current.length > 0 ? getNearestFacilityDistance(lat, lng) : 0;
      const resolvedGov = resolveGovernorateFromCity(city, preset?.governorate || gov);

      const nextLoc: UserLocation = {
        city,
        governorate: resolvedGov,
        lat,
        lng,
        isAutoDetected: false,
        isSpecified: true,
        distanceKm: dist,
        isOutsideCoverage: false,
      };
      setUserLocation(nextLoc);
      syncAccountCityFromLocation(city, resolvedGov);
      depsRef.current.persistPrefsToRemote({
        userLocation: nextLoc as unknown as Record<string, unknown>,
      });
    },
    [depsRef, getNearestFacilityDistance, syncAccountCityFromLocation]
  );

  const resetLocationToAllEgypt = useCallback(() => {
    setUserLocation(DEFAULT_EGYPT_LOCATION);
    setSmartFilters((prev) => ({ ...prev, maxDistanceKm: DEFAULT_SMART_FILTERS.maxDistanceKm }));
    depsRef.current.persistPrefsToRemote({
      userLocation: DEFAULT_EGYPT_LOCATION as unknown as Record<string, unknown>,
    });
  }, [depsRef]);

  const requestAutoGeolocation = useCallback(async () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat1 = pos.coords.latitude;
          const lon1 = pos.coords.longitude;
          let nearestPreset = EGYPT_CITY_PRESETS[0];
          let minPresetDist = Number.MAX_SAFE_INTEGER;
          for (const p of EGYPT_CITY_PRESETS) {
            const d = calculateDistanceKm(lat1, lon1, p.lat, p.lng);
            if (d < minPresetDist) {
              minPresetDist = d;
              nearestPreset = p;
            }
          }
          const nearPreset = minPresetDist <= 28;
          const distanceKm =
            facilitiesRef.current.length > 0 ? getNearestFacilityDistance(lat1, lon1) : 0;
          setUserLocation({
            city: nearPreset ? `${nearestPreset.city} (GPS)` : "موقعك الحالي (GPS)",
            governorate: nearPreset ? nearestPreset.governorate : "مصر",
            lat: lat1,
            lng: lon1,
            isAutoDetected: true,
            isSpecified: true,
            distanceKm,
            isOutsideCoverage: false,
          });
        },
        () => {
          setUserLocation((prev) => (prev.isSpecified ? prev : DEFAULT_EGYPT_LOCATION));
        }
      );
    }
  }, [getNearestFacilityDistance]);

  const updateSmartFilters = useCallback((patch: Partial<SmartFiltersState>) => {
    setSmartFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSmartFilters = useCallback(() => setSmartFilters(DEFAULT_SMART_FILTERS), []);

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!depsRef.current.isAuthenticated) {
        depsRef.current.openAuthGateModal("حفظ المنشآت والكباتن في المفضلة");
        return;
      }
      setSavedFavoriteIds((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        depsRef.current.persistPrefsToRemote({ favorites: next });
        return next;
      });
    },
    [depsRef]
  );

  const isFavorite = useCallback(
    (id: string) => (depsRef.current.isAuthenticated ? savedFavoriteIds.includes(id) : false),
    [depsRef, savedFavoriteIds]
  );

  const toggleCompareFacility = useCallback(
    (facilityId: string) => {
      if (compareFacilityIds.includes(facilityId)) {
        const next = compareFacilityIds.filter((id) => id !== facilityId);
        setCompareFacilityIds(next);
        depsRef.current.persistPrefsToRemote({ compareIds: next });
        return { ok: true };
      }
      if (compareFacilityIds.length >= 4) {
        return {
          ok: false,
          messageAr: "الحد الأقصى للمقارنة الجانبية هو 4 منشآت في شاشة واحدة (MVP-04).",
        };
      }
      const next = [...compareFacilityIds, facilityId];
      setCompareFacilityIds(next);
      depsRef.current.persistPrefsToRemote({ compareIds: next });
      return { ok: true };
    },
    [compareFacilityIds, depsRef]
  );

  const clearComparison = useCallback(() => {
    setCompareFacilityIds([]);
    depsRef.current.persistPrefsToRemote({ compareIds: [] });
  }, [depsRef]);

  return {
    placesHydrating,
    userLocation,
    setUserLocation,
    locationModalOpen,
    setLocationModalOpen,
    filterModalOpen,
    setFilterModalOpen,
    smartFilters,
    setSmartFilters,
    savedFavoriteIds,
    setSavedFavoriteIds,
    compareFacilityIds,
    setCompareFacilityIds,
    applyAccountCityToUserLocation,
    setUserCity,
    setUserCoordinates,
    resetLocationToAllEgypt,
    requestAutoGeolocation,
    updateSmartFilters,
    resetSmartFilters,
    toggleFavorite,
    isFavorite,
    toggleCompareFacility,
    clearComparison,
  };
}
