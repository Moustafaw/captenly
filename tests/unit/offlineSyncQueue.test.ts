import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EGYPT_LOCATION,
  DEFAULT_SMART_FILTERS,
  DEFAULT_USER_SETTINGS,
  STORAGE_KEY,
  syncToSupabase,
  writePersistedStateToStorage,
  type PersistedPayload,
} from "@/context/modules/storageHelpers";
import {
  loadOfflineShiftSnapshot,
  mergeSessionLedgers,
  saveOfflineShiftSnapshot,
  upsertLedgerInOfflineShiftSnapshot,
} from "@/lib/offlineShiftDb";
import type { OfflineCheckinQueueItem, SessionLedger } from "@/types/captenly";

function installBrowserGlobals(online = true) {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, "window", {
    value: { location: { origin: "http://127.0.0.1:3000" } },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  });

  return mockLocalStorage;
}

function makeQueueItem(overrides: Partial<OfflineCheckinQueueItem> = {}): OfflineCheckinQueueItem {
  return {
    id: "oq-1",
    clientEventId: "evt-1001",
    kind: "checkin",
    ledgerId: "led-1",
    athleteNameAr: "يوسف طارق",
    sessionNumber: 4,
    method: "offline_sync",
    syncStatus: "pending",
    retryCount: 0,
    coachNoteAr: "حضور أوفلاين",
    queuedAtIso: "2026-11-27T10:00:00Z",
    synced: false,
    ...overrides,
  };
}

function makeLedger(overrides: Partial<SessionLedger> = {}): SessionLedger {
  return {
    id: "led-1",
    ledgerCode: "SUB-1001-A1",
    subscriptionCode: "SUB-1001-A1",
    memberCode: "CAP-M-1001",
    athleteId: "ath-1",
    athleteNameAr: "يوسف طارق",
    isMinor: false,
    coachId: "coach-1",
    coachNameAr: "كابتن شريف",
    facilityId: "fac-1",
    facilityNameAr: "نادي الموج الأزرق",
    sportSector: "swimming",
    packageTitleAr: "باقة 8 حصص",
    totalSessions: 8,
    completedSessions: 3,
    pinCode: "4829",
    status: "active",
    isCodeExpired: false,
    startedDateAr: "اليوم",
    checkins: [],
    receipts: [],
    ...overrides,
  };
}

const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const origNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const origLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const origFetch = globalThis.fetch;

describe("offlineSyncQueue: syncToSupabase, reload persistence & bounded idempotent replay", () => {
  beforeEach(() => {
    installBrowserGlobals(true);
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
    else delete (globalThis as Record<string, unknown>).window;
    if (origNavigator) Object.defineProperty(globalThis, "navigator", origNavigator);
    else delete (globalThis as Record<string, unknown>).navigator;
    if (origLocalStorage) Object.defineProperty(globalThis, "localStorage", origLocalStorage);
    else delete (globalThis as Record<string, unknown>).localStorage;
  });

  it("classifies HTTP 200, 200(persisted:false), 401, 403, 409, 500, offline, and timeout accurately", async () => {
    // 200 persisted: true
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, persisted: true, ledger: { id: "led-1" } }), {
        status: 200,
      })) as typeof fetch;
    const okRes = await syncToSupabase("/api/supabase/session-ledgers", { a: 1 });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.status, 200);
    assert.equal(okRes.category, "ok");

    // 200 persisted: false -> failure
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, persisted: false, reason: "db_down" }), {
        status: 200,
      })) as typeof fetch;
    const unpersisted = await syncToSupabase("/api/supabase/session-ledgers", { a: 1 });
    assert.equal(unpersisted.ok, false);
    assert.equal(unpersisted.category, "server");
    assert.equal(unpersisted.errorCode, "db_down");

    // 401, 403, 409, 500
    for (const [status, expectedCat] of [
      [401, "auth"],
      [403, "forbidden"],
      [409, "conflict"],
      [500, "server"],
    ] as const) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ ok: false, error: `err_${status}` }), { status })) as typeof fetch;
      const res = await syncToSupabase("/api/supabase/session-ledgers", { a: 1 });
      assert.equal(res.ok, false);
      assert.equal(res.status, status);
      assert.equal(res.category, expectedCat);
      assert.equal(res.errorCode, `err_${status}`);
      assert.ok(res.messageAr && res.messageAr.length > 0);
    }

    // Timeout / AbortError
    globalThis.fetch = (async (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as typeof fetch;
    const timeoutRes = await syncToSupabase(
      "/api/supabase/session-ledgers",
      { a: 1 },
      { timeoutMs: 5 }
    );
    assert.equal(timeoutRes.ok, false);
    assert.equal(timeoutRes.category, "network");
    assert.equal(timeoutRes.errorCode, "timeout");

    // Browser offline short-circuit
    installBrowserGlobals(false);
    const offlineRes = await syncToSupabase("/api/supabase/session-ledgers", { a: 1 });
    assert.equal(offlineRes.ok, false);
    assert.equal(offlineRes.category, "offline");
    assert.equal(offlineRes.errorCode, "browser_offline");
  });

  it("persists offlineQueue and shift snapshots across reload via localStorage and prevents duplicate merges", async () => {
    const storage = installBrowserGlobals(true);

    const payload: PersistedPayload = {
      personaId: "p-1",
      allPersonas: [],
      memberRegistry: [],
      facilities: [],
      coaches: [],
      minorAthletes: [],
      pbRecords: [],
      skillEvaluationsByAthlete: {},
      sessionLedgers: [makeLedger({ completedSessions: 4 })],
      verifiedLeads: [],
      demandRadar: [],
      demandSubmissions: [],
      offlineQueue: [
        makeQueueItem({ id: "oq-1", clientEventId: "evt-1", syncStatus: "pending", retryCount: 0 }),
        makeQueueItem({
          id: "oq-2",
          clientEventId: "evt-2",
          syncStatus: "failed",
          retryCount: 5,
          lastErrorCode: "http_500",
        }),
      ],
      facilityLinks: [],
      savedFavoriteIds: [],
      compareFacilityIds: [],
      notifications: [],
      articles: [],
      activeStaffAssignmentId: null,
      activeWorkspaceContext: "member",
      accountSnapshots: {},
      userSettings: DEFAULT_USER_SETTINGS,
      newsletterEmails: [],
      userLocation: DEFAULT_EGYPT_LOCATION,
      smartFilters: DEFAULT_SMART_FILTERS,
    };

    writePersistedStateToStorage(payload);
    const restoredRaw = storage.getItem(STORAGE_KEY);
    assert.ok(restoredRaw);
    const restored = JSON.parse(restoredRaw) as PersistedPayload;
    assert.equal(restored.offlineQueue.length, 2);
    assert.equal(restored.offlineQueue[0].clientEventId, "evt-1");
    assert.equal(restored.offlineQueue[1].retryCount, 5);

    // Bounded retries <= 5 filtering rule
    const eligibleAuto = restored.offlineQueue.filter(
      (q) => !q.synced && (q.retryCount ?? 0) < 5
    );
    assert.deepEqual(
      eligibleAuto.map((q) => q.id),
      ["oq-1"]
    );

    // Offline shift snapshot persistence + atomic ledger upsert + higher_progress merge
    const snapRes = await saveOfflineShiftSnapshot({
      facilityId: "fac-1",
      facilityNameAr: "نادي الموج الأزرق",
      preparedAtIso: "2026-11-27T09:00:00Z",
      preparedByAr: "مسؤول البوابة",
      waterFeePerSessionEgp: 60,
      ledgers: [makeLedger({ id: "led-1", completedSessions: 3 })],
      totalActiveCount: 1,
    });
    assert.equal(snapRes.ok, true);
    assert.equal(snapRes.storage, "localstorage");

    await upsertLedgerInOfflineShiftSnapshot(
      "fac-1",
      makeLedger({ id: "led-1", completedSessions: 4 })
    );
    const loadedSnap = await loadOfflineShiftSnapshot("fac-1");
    assert.equal(loadedSnap?.ledgers[0].completedSessions, 4);

    // Merge preserves higher progress and avoids duplicating ledger IDs
    const merged = mergeSessionLedgers(
      [makeLedger({ id: "led-1", completedSessions: 5 })],
      [makeLedger({ id: "led-1", completedSessions: 3 })],
      "higher_progress"
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].completedSessions, 5);
  });

  it("prevents duplicate deduction on idempotent clientEventId replay", async () => {
    const seenEventIds = new Set<string>();
    let serverCompletedSessions = 3;

    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body || "{}")) as {
        clientEventId?: string;
        ledger?: SessionLedger;
      };
      const eventId = body.clientEventId || "";
      if (eventId && seenEventIds.has(eventId)) {
        return new Response(
          JSON.stringify({
            ok: true,
            persisted: true,
            idempotentReplay: true,
            ledger: makeLedger({ completedSessions: serverCompletedSessions }),
          }),
          { status: 200 }
        );
      }
      if (eventId) seenEventIds.add(eventId);
      serverCompletedSessions += 1;
      return new Response(
        JSON.stringify({
          ok: true,
          persisted: true,
          ledger: makeLedger({ completedSessions: serverCompletedSessions }),
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const first = await syncToSupabase("/api/supabase/session-ledgers", {
      ledger: makeLedger({ completedSessions: 4 }),
      clientEventId: "evt-replay-1",
    });
    assert.equal(first.ok, true);
    assert.equal(serverCompletedSessions, 4);

    const replay = await syncToSupabase("/api/supabase/session-ledgers", {
      ledger: makeLedger({ completedSessions: 4 }),
      clientEventId: "evt-replay-1",
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.data?.idempotentReplay, true);
    assert.equal(serverCompletedSessions, 4);
  });
});
