import type { FacilityPoolDeskConfig, SessionLedger } from "@/types/captenly";

const DB_NAME = "captenly_pool_desk_db";
const DB_VERSION = 1;
const STORE_SHIFTS = "shift_snapshots";

export interface OfflineShiftSnapshot {
  facilityId: string;
  facilityNameAr: string;
  preparedAtIso: string;
  preparedByAr: string;
  waterFeePerSessionEgp: number;
  poolDeskConfig?: FacilityPoolDeskConfig;
  ledgers: SessionLedger[];
  totalActiveCount: number;
}

const FALLBACK_KEY_PREFIX = "captenly_shift_snapshot_";

function openShiftDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SHIFTS)) {
          db.createObjectStore(STORE_SHIFTS, { keyPath: "facilityId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Caches active facility subscribers & pool desk pricing inside IndexedDB so
 * the gate scanner & poolside tablets work seamlessly without WiFi.
 */
export async function saveOfflineShiftSnapshot(
  snapshot: OfflineShiftSnapshot
): Promise<{ ok: boolean; storage: "indexeddb" | "localstorage" }> {
  const db = await openShiftDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SHIFTS, "readwrite");
        tx.objectStore(STORE_SHIFTS).put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return { ok: true, storage: "indexeddb" };
    } catch {
      db.close();
    }
  }

  try {
    localStorage.setItem(`${FALLBACK_KEY_PREFIX}${snapshot.facilityId}`, JSON.stringify(snapshot));
    return { ok: true, storage: "localstorage" };
  } catch {
    return { ok: false, storage: "localstorage" };
  }
}

export async function loadOfflineShiftSnapshot(
  facilityId: string
): Promise<OfflineShiftSnapshot | null> {
  if (!facilityId) return null;
  const db = await openShiftDb();
  if (db) {
    try {
      const item = await new Promise<OfflineShiftSnapshot | null>((resolve) => {
        const tx = db.transaction(STORE_SHIFTS, "readonly");
        const req = tx.objectStore(STORE_SHIFTS).get(facilityId);
        req.onsuccess = () => resolve((req.result as OfflineShiftSnapshot) || null);
        req.onerror = () => resolve(null);
      });
      db.close();
      if (item) return item;
    } catch {
      db.close();
    }
  }

  try {
    const raw = localStorage.getItem(`${FALLBACK_KEY_PREFIX}${facilityId}`);
    return raw ? (JSON.parse(raw) as OfflineShiftSnapshot) : null;
  } catch {
    return null;
  }
}

/** Canonical alias for reading a facility's offline shift snapshot from IndexedDB / fallback storage. */
export async function readOfflineShiftSnapshot(
  facilityId: string
): Promise<OfflineShiftSnapshot | null> {
  return loadOfflineShiftSnapshot(facilityId);
}

/** Reads all persisted offline shift snapshots across facilities (for mount hydration). */
export async function readAllOfflineShiftSnapshots(): Promise<OfflineShiftSnapshot[]> {
  if (typeof window === "undefined") return [];
  const byFacility = new Map<string, OfflineShiftSnapshot>();

  const db = await openShiftDb();
  if (db) {
    try {
      const items = await new Promise<OfflineShiftSnapshot[]>((resolve) => {
        const tx = db.transaction(STORE_SHIFTS, "readonly");
        const req = tx.objectStore(STORE_SHIFTS).getAll();
        req.onsuccess = () =>
          resolve(Array.isArray(req.result) ? (req.result as OfflineShiftSnapshot[]) : []);
        req.onerror = () => resolve([]);
      });
      db.close();
      for (const snap of items) {
        if (snap?.facilityId) byFacility.set(snap.facilityId, snap);
      }
    } catch {
      db.close();
    }
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(FALLBACK_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as OfflineShiftSnapshot;
      if (parsed?.facilityId && !byFacility.has(parsed.facilityId)) {
        byFacility.set(parsed.facilityId, parsed);
      }
    }
  } catch {
    // Ignore localStorage read errors
  }

  return Array.from(byFacility.values());
}

/**
 * Pure merge helper for SessionLedger arrays.
 * Preserves whichever version has higher session/receipt/checkin progress (or incoming when equal).
 */
export function mergeSessionLedgers(
  existing: SessionLedger[],
  incoming: SessionLedger[],
  prefer: "higher_progress" | "incoming" = "higher_progress"
): SessionLedger[] {
  const byId = new Map(existing.map((l) => [l.id, l]));
  for (const next of incoming) {
    if (!next?.id) continue;
    const prev = byId.get(next.id);
    if (!prev) {
      byId.set(next.id, next);
      continue;
    }
    if (prefer === "incoming") {
      byId.set(next.id, next);
      continue;
    }
    const prevScore =
      prev.completedSessions * 100 + prev.checkins.length * 10 + prev.receipts.length;
    const nextScore =
      next.completedSessions * 100 + next.checkins.length * 10 + next.receipts.length;
    byId.set(next.id, prevScore > nextScore ? prev : next);
  }
  return Array.from(byId.values());
}

/**
 * Atomically merges/upserts a single SessionLedger into the facility's IndexedDB shift snapshot
 * so poolside offline check-ins and enrollments never drift from the canonical snapshot.
 */
export async function upsertLedgerInOfflineShiftSnapshot(
  facilityId: string,
  ledger: SessionLedger,
  meta?: {
    facilityNameAr?: string;
    preparedByAr?: string;
    waterFeePerSessionEgp?: number;
  }
): Promise<{
  ok: boolean;
  snapshot: OfflineShiftSnapshot | null;
  storage: "indexeddb" | "localstorage" | "none";
}> {
  const targetFacilityId = facilityId || ledger.facilityId;
  if (!targetFacilityId || !ledger?.id) {
    return { ok: false, snapshot: null, storage: "none" };
  }

  const existing = await loadOfflineShiftSnapshot(targetFacilityId);
  const nowIso = new Date().toISOString();
  const baseLedgers = Array.isArray(existing?.ledgers) ? existing.ledgers : [];
  const mergedLedgers = mergeSessionLedgers(baseLedgers, [ledger], "incoming");
  const totalActiveCount = mergedLedgers.filter(
    (l) => l.status !== "completed" && !l.isCodeExpired
  ).length;

  const updatedSnapshot: OfflineShiftSnapshot = {
    facilityId: targetFacilityId,
    facilityNameAr:
      existing?.facilityNameAr || meta?.facilityNameAr || ledger.facilityNameAr || "منشأة سباحة",
    preparedAtIso: existing?.preparedAtIso || nowIso,
    preparedByAr: existing?.preparedByAr || meta?.preparedByAr || "تحديث تلقائي أوفلاين",
    waterFeePerSessionEgp:
      existing?.waterFeePerSessionEgp ??
      meta?.waterFeePerSessionEgp ??
      ledger.pricingSnapshot?.waterFeePerSessionEgp ??
      0,
    poolDeskConfig: existing?.poolDeskConfig,
    ledgers: mergedLedgers,
    totalActiveCount,
  };

  const res = await saveOfflineShiftSnapshot(updatedSnapshot);
  return { ok: res.ok, snapshot: updatedSnapshot, storage: res.storage };
}
