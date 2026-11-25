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
