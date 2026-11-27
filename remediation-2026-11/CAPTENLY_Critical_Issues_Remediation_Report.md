# CAPTENLY — Critical Issues Remediation & Engineering Hardening Report

- **Mission:** Critical Issues Remediation, Engineering Hardening & Regression Verification
- **Date:** 2026-11-27
- **Verified Codebase Baseline:** `audit-remediation` / `main` at Commit `1c2fc9e3f9969cbd474e9338b43374c18a2b5ba9`
- **Integrated Remediation Branch & Commit:** `remediation/critical-hardening` (`a431d48` + deliverables) — **`main` and `audit-remediation` untouched at `1c2fc9e3`**
- **Production Safety Guarantee:** Strictly **NOT deployed to production** (`https://captenly.vercel.app`), zero pushes to production branches, zero database migrations executed on production Supabase (`aobmijghzsmsnnikefkb`), zero production mutations.

---

## 1. Executive Summary

Every finding from `GAP-001` through `GAP-032` in the Product Discovery inventory was re-checked directly against CAPTENLY's live codebase, classified strictly into actionable software/security defects vs product decisions vs external dependencies vs excluded future opportunities, fixed across 6 coordinated specialist agents on isolated git worktrees, and verified via TypeScript, ESLint, circular dependency scanning, dependency auditing, `35` new pure unit tests (`8` suites), `18` new API integration & authorization tests (`5` suites), `82` passing Playwright E2E tests (`6` viewport-specific skips, `0` failures), and before/after Lighthouse Mobile & Desktop audits.

### Summary Outcome Across All 32 GAPs

| Remediation Status | Count | GAP IDs |
| :--- | :---: | :--- |
| **`Fixed & Verified`** | **10** | `GAP-004`, `GAP-008`, `GAP-013`, `GAP-015`, `GAP-016`, `GAP-018`, `GAP-019`, `GAP-020`, `GAP-024`, `GAP-026` |
| **`Fixed — Staging Verification Pending`** | **6** | `GAP-001`, `GAP-002`, `GAP-003`, `GAP-006`, `GAP-010`, `GAP-014` |
| **`Partially Fixed`** | **5** | `GAP-011` (`OQ-005`/`OQ-006`), `GAP-012` (`CaptenlyProvider` full split deferred), `GAP-017` (`OQ-012` newsletter/cron), `GAP-021` (CAS/idempotency fixed; `OQ-011` `consent_logs`/`abuse_reports` pending), `GAP-023` (`/api/places/photo` LRU bounded; `OQ-014` Storage buckets pending) |
| **`Blocked by Product Decision`** | **2** | `GAP-005` (`OQ-007`), `GAP-007` (`OQ-008`) |
| **`Blocked by External Dependency`** | **1** | `GAP-009` (`OQ-009` Resend/Twilio env credentials; fails closed `503` + UI hardened) |
| **`Deferred — Optional Enhancement`** | **3** | `GAP-022`, `GAP-025`, `GAP-027` |
| **`Deferred — Future Opportunity`** | **5** | `GAP-028`, `GAP-029`, `GAP-030`, `GAP-031`, `GAP-032` |
| **Total** | **32** | **100% of Product Discovery `GAP-001`–`GAP-032` accounted for** |

---

## 2. Detailed Remediation by GAP (`GAP-001`–`GAP-032`)

### 2.1 Critical P0 Blockers (`GAP-001`–`GAP-004`)

#### `GAP-001` — Silent Fire-and-Forget Cloud Sync & Unawaited Offline Replay
- **Classification:** Confirmed data-integrity defect (`Fixed — Staging Verification Pending`)
- **Original Root Cause:** `postSupabaseSync()` ([storageHelpers.ts:177-184](file:///e:/Moustafa%20Ezzat/Captenly/src/context/modules/storageHelpers.ts)) fired `fetch()` without inspecting `res.ok` or awaiting completion, swallowing HTTP `401`/`403`/`409`/`500` and network errors. `syncOfflineQueue()` ([usePoolDeskDomain.ts:226-271](file:///e:/Moustafa%20Ezzat/Captenly/src/context/modules/usePoolDeskDomain.ts)) marked `offlineQueue` items `synced: true` synchronously before any response and emitted unconditional success notifications.
- **Fix Implemented:**
  - Replaced fire-and-forget writes with awaited `syncToSupabase(path, body, options)` returning structured `SyncResult` classifying `ok`, `offline`, `auth` (`401`), `forbidden` (`403`), `validation` (`400`/`422`), `conflict` (`409`), `server` (`>=500` / `{ persisted: false }`), and `network` (catch / `15s` abort timeout).
  - Rewrote `syncOfflineQueue()` as sequential `async` `syncOfflineQueueAsync()` guarded by `isSyncingRef`: marks `synced: true, syncStatus: "synced"` **only after confirmed HTTP `2xx` + `persisted: true`**, stops immediately on `401`/`403` with error notifications, handles `409` via canonical `syncLedgersFromServer()` refresh, caps retries at `5`, persists `clientEventId` / `retryCount` / `syncStatus` / `lastErrorCode` / `lastErrorAr` across reloads, and exposes `syncStatusSummary` + `retryFailedOfflineQueue` on `CaptenlyContext`.
  - Migrated `usePoolDeskCheckins.ts`, `usePoolDeskRenewalsAndReceipts.ts`, `PoolGateKioskView.tsx`, `D8.tsx`, `P5.tsx`, `FacilityDashboardClient.tsx`, and `FacilitySubscribersTab.tsx` to awaited `*Async` handlers with truthful failure/rollback/retry UI.
- **Files Changed:** `storageHelpers.ts`, `usePoolDeskDomain.ts`, `usePoolDeskCheckins.ts`, `usePoolDeskRenewalsAndReceipts.ts`, `CaptenlyContext.tsx`, `types.ts`, `captenly.ts`, `PoolGateKioskView.tsx`, `D8.tsx`, `P5.tsx`, `FacilityDashboardClient.tsx`, `FacilitySubscribersTab.tsx`, `session-ledgers/route.ts`.
- **Tests & Verification:** `offlineSyncQueue.test.ts` (`3/3` PASS), `session-ledgers-pin-concurrency.test.ts` (`4/4` PASS), `remediation-regression.spec.ts` #5b (`403`/`500` retry badge E2E PASS). Note: `F-003` & `F-017` previously passed only by swallowing unauth `401` and were updated with `200` API route mocks (`a431d48`).

#### `GAP-002` — Cross-Device PIN-Based Attendance
- **Classification:** Confirmed existing software & security defect (`Fixed — Staging Verification Pending`, `OQ-001` interim safe behavior)
- **Original Root Cause:** `/api/supabase/session-ledgers` masked `pinCode` as `"****"` for staff/coaches with zero server PIN verification; client validation rejected `"****"`; `PoolGateKioskView.tsx` rejected 4-digit strings pre-lookup; mobile `P5.tsx` omitted displaying the swimmer's PIN.
- **Fix Implemented:**
  - Retained `pinCode: "****"` masking in `GET`/`POST` responses to all staff/coaches and added server-side `action: "pin_checkin"` in `POST /api/supabase/session-ledgers` enforcing: `401` auth, `403` provider/delegated-coach authorization (rejecting `accounts_manager` and swimmer self-deduction), rate limiting (`10` attempts / `300s` -> `429 rate_limited`), `^\d{4}$` validation, `crypto.timingSafeEqual` against stored `pin_code`, `409 ambiguous_pin` when multiple ledgers share a PIN without `ledgerId`, exhaustion/3h duplicate guards, and atomic CAS update.
  - Enabled online 4-digit PIN execution in `PoolGateKioskView.tsx` via `checkInByPinAsync` (honest offline message directing to QR/`CAP-SUB-*`) and added swimmer PIN display on mobile `P5.tsx`.
- **Tests & Verification:** `session-ledgers-pin-concurrency.test.ts` (`pin_checkin` full matrix PASS), `remediation-regression.spec.ts` #5a (`P5` mobile PIN) and #5b (desktop Gate Kiosk online PIN) PASS.

#### `GAP-003` — Staff Invitation Acceptance HTTP `403`
- **Classification:** Confirmed workflow & authorization defect (`Fixed — Staging Verification Pending`)
- **Original Root Cause:** `respondToStaffInvitation` called `updateFacilityAndSync` -> `POST /api/supabase/public-supply`, which required `invitationStatus === "accepted"` (`403` to pending invitees) while updating local state optimistically.
- **Fix Implemented:** Created dedicated `POST /api/supabase/staff-invitations/route.ts` validating authenticated caller (`401`), facility/staff lookup (`404`), caller-to-invitee identity match (`403 forbidden_not_invitee`), pending-only state (`409` already responded, `410` expired/revoked), and server-preserved invited `role`, persisting acceptance/decline to `captenly_facilities` (Supabase + PG). Updated `respondToStaffInvitation` in `useRoleClaimsAndStaff.ts` to await HTTP `200` before updating client state.
- **Tests & Verification:** `staff-invitations.test.ts` (`6/6` integration tests PASS). Staging DB multi-user verification pending.

#### `GAP-004` — `accounts_manager` & `general_staff` UI-vs-API Permission Mismatches
- **Classification:** Confirmed RBAC mismatch (`Fixed & Verified` under `OQ-002`/`OQ-003` interim security)
- **Original Root Cause:** `FacilitySettingsDeskTab.tsx` exposed `collectedMonthlyEgp` saves to `accounts_manager` (returning `403` on `facility-links` `PATCH` while mutating local state) and exposed `staffMembers` add/remove UI to `general_staff` (stripped server-side in `public-supply`); `POST add_direct` on `facility-links` also allowed `accounts_manager` asymmetrically.
- **Fix Implemented:** Added canonical `src/lib/facilityPermissions.ts` (`getFacilityRoleCapabilities`, `hasFacilityCapability`), tightened `POST /api/supabase/facility-links` (`add_direct`) to match `PATCH` (`owner | general_staff | admin`), locked UI edit controls with clear Arabic notices for `accounts_manager` (`OQ-002`) and `general_staff` (`OQ-003`), and removed phantom local fallbacks in `usePoolDeskLinksAndConfig.ts`.
- **Tests & Verification:** `facilityPermissions.test.ts` (`5/5` PASS), `facility-links-rbac.test.ts` (`2/2` PASS).

---

### 2.2 P1 & Confirmed P2/P3 Defects (`GAP-005`–`GAP-027`)

- **`GAP-005` (`Blocked by Product Decision` — `OQ-007`):** Verified personal/minor DB records are preserved on coach/manager promotion (`user-state` keys by `memberCode`), and isolated workspace-switching policy (`D15`/`P2`/`FamilySettings`) as an explicit Product-Owner decision without inventing unapproved role changes.
- **`GAP-006` (`Fixed — Staging Verification Pending`):** Removed early `!admin` exit in `GET /api/supabase/session-ledgers` (restoring pure-`POSTGRES_URL` fallback), exported `readOfflineShiftSnapshot` / `readAllOfflineShiftSnapshots` / `mergeSessionLedgers` / `upsertLedgerInOfflineShiftSnapshot` in `offlineShiftDb.ts`, hydrated IDB snapshots on mount (`usePoolDeskDomain.ts`), merged canonical IDB ledgers in `checkInBySubscriptionCode` & `PoolGateKioskView.tsx`, and fixed `parentPhone` lookup. Verified in `offlineSyncQueue.test.ts` & `session-ledgers-pin-concurrency.test.ts`.
- **`GAP-007` (`Blocked by Product Decision` — `OQ-008`):** Audited `D10.tsx`, `D1.tsx`, `register-facility/route.ts`, and `role-claims/route.ts`; preserved existing publish/review boundaries and unverified label honesty without changing product policy unapproved.
- **`GAP-008` (`Fixed & Verified`):** Replaced nested `<main>` in `D4.tsx:57` with `<div>`, strengthened `F-021` (`phase3-remaining.spec.ts`) to assert `mainCount === 1` across `/pools`, and updated `src/middleware.ts` + `next.config.mjs` (`poweredByHeader: false`) to emit explicit allowed origin + `Vary: Origin` on non-API HTML/RSC responses instead of Vercel CDN default `ACAO: *`. Verified via `remediation-regression.spec.ts` #1 and strengthened `F-021`.
- **`GAP-009` (`Blocked by External Dependency` / `Partially Fixed` — `OQ-009`):** Verified zero OTP/secret logging and clean `503 deliveryUnavailable` when Resend/Twilio keys are unset; added timeout-bounded `fetchImpl` in `member-auth/route.ts`; improved `D11.tsx` unavailable error guidance; verified mocked Resend, Twilio fallback, timeout, and `503` in `otp-delivery.test.ts` (`3/3` PASS).
- **`GAP-010` (`Fixed — Staging Verification Pending`, `OQ-004`):** Fixed `AthleteProfileSocialEditor.tsx` to inspect `{ ok, messageAr }` and surface Law 3/1985 errors (`E2E` #7 PASS); added server-side promo validation (`isActive`, expiry, `usedCount < maxUses`) + `usedCount` persistence on new enrollments in `POST /api/supabase/session-ledgers` (`session-ledgers-pin-concurrency.test.ts` PASS); retained existing initial receipt rule (`OQ-004`).
- **`GAP-011` (`Partially Fixed` — `OQ-005`/`OQ-006`):** Strengthened `stripPlusCode` / `cleanPublicAddressAr` (`src/lib/maps.ts`) and applied across `FacilityCard`, `D22`, `P13`, `D23`, `P6` (`maps.test.ts` + E2E #2 PASS); prepared unexecuted [006_proposed_cleanup_and_rls_view.sql](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/migrations/006_proposed_cleanup_and_rls_view.sql) without mutating production DB or upgrading Supabase plan.
- **`GAP-012` (`Partially Fixed`):** Replaced eager `jsQR` import in `QrCameraScannerModal.tsx` with dynamic `import("jsqr")` (`-36` to `-38 kB` on `/dashboard/coach`, `/facility`, `/ledger`), scoped `/api/places/search` to discovery routes (`useDiscoveryDomain.ts`), deferred non-discovery `public-supply` & initial `localStorage` writes (`useSupplyDomain.ts`, `CaptenlyContext.tsx`), stabilized hydration wrappers (`HomeScreenClient.tsx`, `ExploreScreenClient.tsx`), and removed 4MB Material Symbols CSS (`globals.css`). Mobile `/` Perf improved `34 -> 46` (LCP `9.3s -> 5.1s`) and Desktop `/explore` `57 -> 89`; full root `CaptenlyProvider` split deferred safely due to `63+` consumers.
- **`GAP-013` (`Fixed & Verified` locally):** Built zero-dependency Node 24 test infrastructure (`tests/register-paths.mjs`, `"test:unit"` + `"test:integration"` in `package.json`) with `35` unit tests (`8` suites), `18` API integration tests (`5` suites), and `7` E2E regression tests (`82 passed / 6 skipped / 0 failed` total Playwright). Live multi-user staging & physical camera QA remain pending staging environment & hardware.
- **`GAP-014` (`Fixed — Staging Verification Pending`, `OQ-010`):** Locked 3h override for `general_staff` in `FacilityOpsAuditTab.tsx` (matching server `409` boundary); added `limit`/`offset`/`hasMore`/`nextOffset` pagination to `GET /api/supabase/session-ledgers` (both REST and PG) and multi-page loop in `lookupRemoteLedgersOrProfile` (`usePoolDeskDomain.ts`).
- **`GAP-015` (`Fixed & Verified`):** Removed `1650ms–1700ms` simulated progress timers in `DynamicScheduleCardsBuilder.tsx` & `AuthorArticlesManager.tsx` and wired inline edit via `updateFacilitySchoolProgram` / `updateCoachSessionOffer`.
- **`GAP-016` (`Fixed & Verified`):** Guarded empty `sessionLedgers[0]` in `AdminDashboardClient.tsx` (`E2E` #6 PASS), replaced stale `"الحسابات الـ 6"` copy, implemented admin-only `GET /api/supabase/demand-radar` (`401`/`403` verified in `demand-radar-admin.test.ts` `3/3` PASS), and wired Demand Radar viewer in `/admin` Tab 5.
- **`GAP-017` (`Partially Fixed` — `OQ-012`):** Replaced misleading automated delivery copy on `/magazine` (`D21.tsx`) & `/settings/notifications` (`AthleteNotificationsSettingsClient.tsx`) with honest account-preference disclosures (without building cron/WABA).
- **`GAP-018` (`Fixed & Verified`):** Fixed `D10.tsx` synchronous `addMinorAthlete` `depsRef` race on signup, standardized `3–17` age bounds in `D15.tsx` & `P2.tsx`, added self-filter chip to `D15.tsx`, and replaced `window.alert()`/`window.confirm()` in `AthleteHistorySettingsClient.tsx` (`E2E` #4 PASS) and `AthleteFamilySettingsClient.tsx` with inline modals.
- **`GAP-019` (`Fixed & Verified`):** Kept `/coaches` visible in logged-in `SiteHeader.tsx` (`E2E` #3 PASS), added guest lock hint on `/compare` (`D12.tsx`), added `verifiedLeads` & `manualSubNote` parity to mobile `P12.tsx`, and clarified settings copy in `AthleteSettingsClient.tsx`.
- **`GAP-020` (`Fixed & Verified`, `OQ-013`):** Removed hardcoded `repliedWithin2h: true, replyMinutes: 15` SLA placeholders in `useTelemetrySync.ts` & `useTelemetryDomain.ts`; kept Demand Radar guest auth gate (`OQ-013`).
- **`GAP-021` (`Partially Fixed` — `OQ-011`):** Added `clientEventId` idempotency (`idempotentReplay: true`) and optimistic concurrency CAS (`409 concurrent_update_conflict` with `WHERE completed_sessions = $expected`) to `POST /api/supabase/session-ledgers` (`session-ledgers-pin-concurrency.test.ts` PASS). Legal audit migration (`consent_logs`/`abuse_reports`) awaits `OQ-011`.
- **`GAP-022`, `GAP-025`, `GAP-027` (`Deferred — Optional Enhancement`):** Preserved cleanly out of remediation scope.
- **`GAP-023` (`Partially Fixed` — `OQ-014`):** Bounded `PHOTO_CACHE` & `IMAGE_BYTES_CACHE` in `src/app/api/places/photo/route.ts` with LRU (`200` entries) and `5 MB` streaming byte cap (`readBoundedResponseBytes`); Supabase Storage buckets await `OQ-014`.
- **`GAP-024` (`Fixed & Verified`):** Removed unused 4MB Material Symbols `@font-face` (`globals.css`), switched `FacilityImageOrFallback.tsx` to `<Icon name="pool" />`, verified 0 imports and deleted unused `src/screens/P11.tsx`.
- **`GAP-026` (`Fixed & Verified`):** Created unified EN+AR Law 3/1985 compliance module (`src/lib/medicalCompliance.ts`) and added EN+AR parity in `useSupplyDomain.ts`.
- **`GAP-028`–`GAP-032` (`Deferred — Future Opportunity`):** Explicitly excluded and untouched (`0` code added).

---

## 3. Production Release Risks & Pre-Deployment Prerequisites

Before merging `remediation/critical-hardening` into `main` or deploying to production:
1. Run full staging smoke verification against a staging Supabase environment (confirming `staff-invitations`, `session-ledgers` CAS/PIN/pagination, `demand-radar` admin `GET`, and `facility-links` ACLs against real PostgreSQL).
2. Obtain Product-Owner decisions on **`OQ-001`–`OQ-010`** (especially `OQ-005` Supabase Pro backups and `OQ-006` executing Migration `006` ONLY after taking a database snapshot).
3. Provision production `RESEND_API_KEY` / `TWILIO_*` env vars if self-service OTP recovery (`OQ-009`) is activated.
