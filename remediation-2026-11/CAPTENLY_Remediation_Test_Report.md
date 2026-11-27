# CAPTENLY — Remediation Test & Verification Report

- **Target Branch / HEAD:** `remediation/critical-hardening` (`a431d48`) from verified baseline `1c2fc9e3` (`main` & `audit-remediation` untouched)
- **Test Environment Verification Scope:** Local production build (`next build` + `next start` on `127.0.0.1`), Node `v24.22.1` native unit & API integration runners, local Playwright Chromium (`desktop-chromium` `1366x900` & `mobile-chromium` `390x844`), and local throttled Lighthouse `13.6.0`.
- **Production Safety Boundary:** **Zero** tests mutated production data, production Supabase (`aobmijghzsmsnnikefkb`), or Vercel production (`https://captenly.vercel.app`). All integration API suites ran against mocked NextAuth/Supabase/PG dependencies at the integration boundary.

---

## 1. Executive Comparison — Baseline (`1c2fc9e3`) vs Final (`remediation/critical-hardening` @ `a431d48`)

| Check / Suite | Baseline (`1c2fc9e3`) | Final Integrated (`a431d48`) | Status / Delta |
| :--- | :--- | :--- | :--- |
| **TypeScript (`npx tsc --noEmit`)** | `0` errors | **`0` errors** | PASS (unchanged clean) |
| **ESLint (`npm run lint`)** | `0` errors (`25` `<img>`/`useEffect` warnings) | **`0` errors** (`25` `<img>`/`useEffect` warnings) | PASS (0 new lint issues) |
| **Production Build (`npm run build`)** | Built cleanly (`/` `127 kB`; `/dashboard/coach` `241 kB`; `/dashboard/facility` `258 kB`; `/dashboard/ledger` `247 kB`) | Built cleanly (`/` `11.1 kB` page / `171 kB` FLJS; **`/dashboard/coach` `203 kB` [-38 kB]**; **`/dashboard/facility` `222 kB` [-36 kB]**; **`/dashboard/ledger` `211 kB` [-36 kB]**; +2 new API routes) | PASS (major QR dashboard bundle reduction) |
| **Circular Deps (`npx madge --circular`)** | `0` across `211` files | **`0` across `213` files** (caught & eliminated temporary `storageHelpers.ts <-> types.ts` cycle in `071acfa`) | PASS |
| **Dependency Audit (`npm audit --json`)** | `0` vulnerabilities | **`0` vulnerabilities** (`info: 0, low: 0, moderate: 0, high: 0, critical: 0`) | PASS |
| **Code Duplication (`npm run qa:duplication`)** | `106` clones (`3.26%`, pre-F-025) | **`146` clones (`3.55%` lines across `199` files)** | Measured & recorded |
| **Unit Tests (`npm run test:unit`)** | **`0` tests (`0` files)** | **`35 passed, 0 failed` (`8` suites)** | **+35 real unit tests** |
| **API Integration Tests (`npm run test:integration`)** | **`0` integration suites in `npm scripts`** | **`18 passed, 0 failed` (`5` suites)** | **+18 server contract tests** |
| **Playwright E2E (`npx playwright test --workers=1`)** | `69 passed, 3 skipped, 0 failed` (`72` cases; `F-021` checked `mainCount >= 1`) | **`82 passed, 6 skipped, 0 failed` (`88` cases; `F-021` checks `mainCount === 1` incl. `/pools`)** | **+13 passed E2E tests, 0 failures** |

---

## 2. Exact Commands Executed & Evidence Logs

All raw command logs are preserved under `e:\Moustafa Ezzat\Captenly\remediation-2026-11\evidence\`:

1. **TypeScript & ESLint:**
   - `npx tsc --noEmit | Tee-Object -FilePath 'remediation-2026-11\evidence\tsc.log'` → Exit `0`
   - `npm run lint | Tee-Object -FilePath 'remediation-2026-11\evidence\lint.log'` → Exit `0` (`0` errors)
2. **Unit Tests (Node 24 native test runner + zero-dependency `@/` ESM loader `tests/register-paths.mjs`):**
   - `npm run test:unit | Tee-Object -FilePath 'remediation-2026-11\evidence\unit-tests.log'` → **`35 passed, 0 failed, 0 skipped`** (`7,227.8ms`):
     - `facilityPermissions.test.ts` (`5` checks): Full matrix (`owner`, `admin`, `general_staff` denied `manage_staff`, `accounts_manager` restricted to pricing & `view_facility_links`, `subscriptions_manager`, `null`/unknown).
     - `facilityPricing.test.ts` (`3` checks): Lowest monthly package, hidden-fee audit, `schoolProgram` conversion & buckets.
     - `maps.test.ts` (`3` checks): Raw Plus Code `X529+F73` stripping adjacent to Arabic text/punctuation, Haversine distance, multi-branch city matching.
     - `memberSession.test.ts` (`5` checks): HMAC-SHA256 signing/verification, tampered/malformed/expired token rejection, admin key cookie, fail-closed missing secret in production, cookie helpers.
     - `offlineSyncQueue.test.ts` (`3` checks): HTTP `200`, `200(persisted:false)`, `401`, `403`, `409`, `500`, offline, and timeout classification; reload persistence via `localStorage` + `mergeSessionLedgers`; idempotent `clientEventId` duplicate prevention.
     - `poolDeskPricing.test.ts` (`7` checks): `poolDeskConfig` normalization, per-swimmer vs `fixed_monthly` water fee, percent/fixed promos, inactive/exhausted/expired promo rejection, open discount clamping, gate verdicts (`valid`, `last_session`, `duplicate_3h`, `expired`), coach delegated scan permission.
     - `qrPayload.test.ts` (`6` checks): `CAP-SUB-*`, `CAP-M-*`, `CAP-JR-*`, `CAP-MEMBER:*`, `CAP-QR:<ledger>:<pin>`, JSON, URL `?qr=`/`?sub=`/`?code=`, invalid/empty handling.
     - `rateLimit.test.ts` (`3` checks): Trusted proxy IP extraction, fail-open unconfigured helper, fixed-window counting, bucket isolation, window reset, `429` response headers.
3. **API Integration & Server Authorization Suites (Node 24 `--experimental-test-module-mocks`):**
   - `npm run test:integration | Tee-Object -FilePath 'remediation-2026-11\evidence\integration-tests.log'` → **`18 passed, 0 failed, 0 skipped`** (`5,512.2ms`):
     - `staff-invitations.test.ts` (`6` checks): Unauth `401`, missing facility/invite `404`, wrong user `403 forbidden_not_invitee`, already responded `409`, expired/revoked `410`, valid pending accept (`200`) blocking caller role escalation & persisting cross-device, valid pending decline (`200`).
     - `session-ledgers-pin-concurrency.test.ts` (`4` comprehensive multi-case checks):
       - Cross-device `pin_checkin`: `401`, `403` `accounts_manager` & swimmer self-deduction, `403 invalid_pin` (`timingSafeEqual`), masked `pinCode: "****"` in provider responses, `429 rate_limited` (>10 attempts), `409 ambiguous_pin`, valid `200` `method: "pin_4digit"`, `409 duplicate_checkin_3h` & authorized override, `400` exhausted ledger.
       - Standard `POST` concurrency & idempotency (`GAP-021`): `200 { idempotentReplay: true }` on repeated `clientEventId` (zero double deduction); stale `expectedCompletedSessions` CAS rejected with `409 concurrent_update_conflict` + canonical `serverLedger`.
       - Server promo validation (`GAP-010`): Exhausted/expired promos rejected (`400`), valid promo decrements availability (`usedCount + 1`) server-side.
       - Pagination (`GAP-014` `limit`/`offset`/`hasMore`/`nextOffset` >80 rows) & pure-`POSTGRES_URL` `GET` fallback without Supabase admin client (`GAP-006`).
     - `facility-links-rbac.test.ts` (`2` checks): `accounts_manager` blocked `403` on `facility-links` `PATCH` & `add_direct` while `owner` returns `200`; `canScanGroupQr` enforcement on governed coaches (`403 coach_qr_scan_not_delegated` when false, `200` when true).
     - `otp-delivery.test.ts` (`3` checks): Resend email success storing HMAC hash (asserting zero OTP/secret leaks in logs/errors), Twilio SMS fallback when Resend fails, `503 deliveryUnavailable` on timeout/failure & missing env config.
     - `demand-radar-admin.test.ts` (`3` checks): `GET /api/supabase/demand-radar` returns `401` unauth, `403` non-admin, `200` mapped rows for `super_admin` via Supabase & PG fallback.
4. **Circular Dependency, Security & Duplication Checks:**
   - `npx madge --circular --extensions ts,tsx src | Tee-Object -FilePath 'remediation-2026-11\evidence\madge.log'` → `0` circular dependencies across `213` files.
   - `npm audit --json | Out-File -Encoding utf8 'remediation-2026-11\evidence\npm-audit.json'` → `0` vulnerabilities.
   - `npm run qa:duplication | Tee-Object -FilePath 'remediation-2026-11\evidence\jscpd.log'` → `146` clones (`3.55%` lines).
5. **Production Build & Full Playwright E2E Suite:**
   - `npm run build | Tee-Object -FilePath 'remediation-2026-11\evidence\next-build.log'` → Exit `0`.
   - `npx playwright test --workers=1 | Tee-Object -FilePath 'remediation-2026-11\evidence\playwright-e2e.log'` → **`82 passed, 6 skipped, 0 failed`** (`4.2m`, Exit `0`).
   - **Documented Skips (`6` total, all viewport-intentional):**
     - `3` existing desktop-only tests skipped on `mobile-chromium`: `F-013` (desktop FilterModal/Header), `F-014` (desktop `/explore` side-by-side map & distance filter), `F-027(e)` (desktop `SiteHeader` staff tab truncation).
     - `2` new desktop-specific tests skipped on `mobile-chromium`: `remediation-regression.spec.ts` #3 (logged-in desktop `SiteHeader` `/coaches` link) and #5b (desktop Gate Kiosk PIN check-in + `403`/`500` offline retry UI).
     - `1` new mobile-specific test skipped on `desktop-chromium`: `remediation-regression.spec.ts` #5a (mobile `P5.tsx` swimmer 4-digit PIN display).
   - **Note on Legacy Gate Tests `F-003` & `F-017` (`a431d48`):** Previously, `phase1-remediation.spec.ts` (`F-003 & F-006`) and `phase2-remediation.spec.ts` (`F-017`) seeded `localStorage` without an auth cookie or `/api/supabase/session-ledgers` route mock, passing only because fire-and-forget `postSupabaseSync` swallowed HTTP `401`. After fixing `GAP-001`, both tests surfaced real `401` rejections until updated to fulfill mocked HTTP `200 { ok: true, persisted: true }` responses on `**/api/supabase/session-ledgers*` and `**/api/supabase/notifications*` (zero assertions weakened).

---

## 3. Lighthouse Performance, Accessibility, Best Practices & SEO (Before vs After)

Measured directly against local `next start` (`127.0.0.1:3197`) using `scratch/run_lh_baseline.mjs` (`remediation-2026-11/evidence/lighthouse-baseline.json` vs `lighthouse-after.json`).

| Route | Mode | Perf (Before -> After) | A11y (B->A) | BP (B->A) | SEO (B->A) | LCP (B -> A) | CLS (B -> A) | TBT (B -> A) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`/` (Home)** | Mobile | `34` → **`46`** (+12) | `100` → `100` | `100` → `100` | `100` → `100` | `9,306ms` → **`5,129ms`** | `0.0012` → `0.0015` | `4,634ms` → `5,162ms` |
| **`/` (Home)** | Desktop | `98` → `95` (-3) | `100` → `100` | `100` → `100` | `100` → `100` | `802ms` → `823ms` | `0.0515` → `0.0511` | `83ms` → `148ms` |
| **`/explore`** | Mobile | `57` → **`59`** (+2) | `100` → `100` | `100` → `100` | `92` → `92` | `4,672ms` → `4,789ms` | `0` → `0` | `1,551ms` → **`1,188ms`** |
| **`/explore`** | Desktop | `57` → **`89`** (+32) | `100` → `100` | `96` → `96` | `92` → `92` | `6,256ms` → **`1,347ms`** | `0.0035` → `0.0031` | `268ms` → **`181ms`** |
| **`/coaches`** | Mobile | `74` → **`77`** (+3) | `100` → `100` | `100` → `100` | `100` → `100` | `1,208ms` → **`1,112ms`** | `0.0001` → **`0`** | `1,489ms` → **`1,048ms`** |
| **`/coaches`** | Desktop | `79` → **`96`** (+17) | `100` → `100` | `100` → `100` | `100` → `100` | `436ms` → **`345ms`** | `0.012` → `0.0119` | `499ms` → **`157ms`** |
| **`/pools`** | Mobile | `56` → `55` (-1) | `100` → `100` | `100` → `100` | `100` → `100` | `4,792ms` → `4,817ms` | `0.0672` → `0.0672` | `1,501ms` → `1,574ms` |
| **`/pools`** | Desktop | `99` → `91` (-8) | `98` → `98` | `100` → `100` | `100` → `100` | `930ms` → **`790ms`** | `0.013` → `0.013` | `36ms` → `227ms` |
| **`/dashboard/facility/gate`** | Mobile | `69` → `69` (0) | `100` → `100` | `100` → `100` | `69` → `69` | `4,132ms` → `4,283ms` | **`0` → `0`** | `699ms` → **`654ms`** |
| **`/dashboard/facility/gate`** | Desktop | `96` → `90` (-6) | `100` → `100` | `100` → `100` | `69` → `69` | `1,240ms` → `1,416ms` | `0.0058` → `0.0058` | `88ms` → `194ms` |

### Analysis of Performance Results (`GAP-012` — `Partially Fixed`)
- **Measured Wins:** Lazy-loading `jsQR` reduced `/dashboard/coach`, `/dashboard/facility`, and `/dashboard/ledger` bundles by `36–38 kB`. Scoping `/api/places/search`, deferring non-discovery `/api/supabase/public-supply`, removing initial redundant `localStorage` write-backs, and removing the 4MB Material Symbols font cut Mobile `/` FCP from `2,101ms` -> `1,340ms` and LCP from `9,306ms` -> `5,129ms` (Perf `+12` points: `34 -> 46`), cut Mobile `/explore` TBT `1,551ms -> 1,188ms`, lifted Desktop `/explore` Perf `57 -> 89` (+32), and lifted Desktop `/coaches` Perf `79 -> 96` (+17).
- **Remaining Bottleneck:** Root `src/app/layout.tsx` still mounts `<CaptenlyProvider>` globally with `seedData.ts` and all 6 domain hooks across public pages, keeping throttled Mobile `/` TBT around `5.1s` and Perf at `46`. Splitting `CaptenlyProvider` into route-group providers requires touching 63+ `useCaptenly()` consumer imports (`F-025` architectural threshold) and is documented transparently under `GAP-012` as `Partially Fixed`.

---

## 4. Verification Environment Distinction (Local vs Staging vs Production)

| Verification Tier | What Was Verified | What Remains Unverified Here |
| :--- | :--- | :--- |
| **Local Unit & API Contract Suites** | All `35` pure logic unit tests + `18` server API handler integration tests (`staff-invitations`, cross-device `pin_checkin`, CAS concurrency, idempotent replay, promo validation, pagination, RBAC, OTP mocked delivery, admin `demand-radar`). | Live hosted Supabase REST / TLS PG behavior under real concurrent multi-client DB transactions. |
| **Local Playwright E2E + Lighthouse** | All `82` active desktop & mobile browser tests (auth gates, offline fail-closed UI, `P5` swimmer PIN, Gate Kiosk PIN/QR, `/pools` single `<main>`, cleaned Plus Codes, receipt modal, admin empty guard, Law 3/1985 error banner) + 10 Lighthouse runs. | Physical Android/tablet rear camera hardware, physical pool-side offline/reconnect transitions, live external Resend/Twilio delivery. |
| **Live Production (`https://captenly.vercel.app`)** | **Unchanged & untouched at `1c2fc9e3`** per absolute production safety restrictions (`main` untouched, `0` prod deployments, `0` prod DB migrations/mutations). | Multi-user staging Supabase validation of `staff-invitations`, `session-ledgers` CAS/PIN/pagination, `demand-radar` GET, and Migration `006` execution. |
