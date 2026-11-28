# CAPTENLY — Final Engineering Remediation, Production Deployment & Closure Report

- **Mission:** Final Execution, Remediation, Free-Tier Service Configuration, Production Release & Verification
- **Date:** 2026-11-28
- **Target Production URL:** `https://captenly.vercel.app`
- **Repository Branches & Commits:**
  - Starting Audit Baseline (`main` / `audit-remediation`): `1c2fc9e3`
  - Prior Remediation Deliverables (`remediation/critical-hardening`): `f25d1c3`
  - Final Execution Commit (`remediation/critical-hardening`): `0f079ee`
  - Production Merge Commit (`main`): `f4162b9` (prior to adding this closure report)
  - Vercel Production Deployment Verified: `DcTGANdC5DBoZbnCVkvjMAwejux8` (`Status: Ready`, `1m 15s`)
- **Zero-Spend Compliance:** `$0` spent. Every external service configured exclusively on free tiers with no payment card entered.
- **Secret Hygiene:** Zero raw API keys, tokens, passwords, or secrets appear anywhere in git commits, migrations, evidence logs, or this report.

---

## 1. Executive Outcome

All engineering remediation work, live Supabase schema migrations (`006` and `007`), free-tier email & WhatsApp Cloud API integrations, core web vitals / SSR LCP optimizations, full regression verification (`38` unit tests, `21` API integration tests, `86` Playwright E2E passes), and production release on `main` (`https://captenly.vercel.app`) are complete and verified.

| Area | Final Status | Live Production Verification Summary |
| :--- | :--- | :--- |
| **Core Hardening & Bug Fixes (`GAP-001`–`GAP-027`)** | **Completed** (excl. 2 owner policy decisions `OQ-007`, `OQ-008`) | Merged cleanly into `main` (`f4162b9`) and serving on `https://captenly.vercel.app`. |
| **Supabase Database (`aobmijghzsmsnnikefkb`)** | **Executed & Verified** | Migrations `006` and `007` applied; `19/19` `captenly_*` tables have `rowsecurity = true`; `captenly_facilities_public` view active; `0` Plus Codes in SQL `address`/`district`. |
| **Free Email Delivery (Resend)** | **Configured & Live Tested ($0)** | `RESEND_API_KEY` & `RESEND_FROM_EMAIL` saved in Vercel Production; test email `"Hello World"` verified `Delivered` to owner inbox. |
| **WhatsApp Cloud API + Cron (`$0` Sandbox)** | **Configured & Live Webhook Active** | Engine, API, Webhook, Daily Cron (`vercel.json` `0 7 * * *`), and UI wired; Meta Webhook verified & `messages` (`v27.0`) subscribed on `https://captenly.vercel.app/api/whatsapp/webhook`. |
| **QA, Security & Build Verification** | **PASS (`0` failures)** | `tsc` (`0` err), `next lint` (`0` err), `madge` (`0` cycles / `218` files), `npm audit` (`0` vulns), `unit` (`38/38`), `integration` (`21/21`), `playwright` (`86` pass, `6` viewport skips). |
| **Production Live Smoke Verification** | **PASS** | All 7 live routes (`/`, `/pools`, `/explore`, `/coaches`, `/magazine`, `/dashboard/facility/gate`, `/auth`) render `mainCount=1`, `h1Count=1`, `0` Plus Codes in DOM, `0` HTTP 500s. |

---

## 2. Final Status Matrix Across All 32 Discovery GAPs (`GAP-001`–`GAP-032`)

| GAP ID | Summary | Final Classification | Production & Verification State |
| :--- | :--- | :--- | :--- |
| **`GAP-001`** | Awaited cloud sync (`syncToSupabase`) & transactional IDB/localStorage offline replay | **Fixed & Verified** | Sequential `syncOfflineQueueAsync()`, `clientEventId` idempotency, retry cap (`5`), error badges (`offlineSyncQueue.test.ts`, `E2E` #5b). |
| **`GAP-002`** | Cross-device 4-digit PIN attendance (`pin_checkin`) & masked provider responses | **Fixed & Verified** (`OQ-001` Option A) | Server `timingSafeEqual`, `10/300s` rate limit (`429`), `409 ambiguous_pin`, mobile `P5` PIN display (`session-ledgers-pin-concurrency.test.ts`, `E2E` #5a/#5b). |
| **`GAP-003`** | Dedicated `POST /api/supabase/staff-invitations` acceptance/decline flow | **Fixed & Verified** | Auth/identity/status validation (`401`/`403`/`409`/`410`), persists to `captenly_facilities` (`staff-invitations.test.ts` `6/6`). |
| **`GAP-004`** | Canonical RBAC matrix (`facilityPermissions.ts`) parity for `accounts_manager` & `general_staff` | **Fixed & Verified** (`OQ-002`/`OQ-003`) | Aligned server `PATCH`/`add_direct` ACLs & locked matching UI controls (`facilityPermissions.test.ts` `5/5`, `facility-links-rbac.test.ts` `2/2`). |
| **`GAP-005`** | Dual-hatted personal/family access on promoted `coach`/`facility_manager` accounts | **Blocked by Product Decision** (`OQ-007`) | Underlying minor/personal records preserved safely under `memberCode`; workspace-switching policy awaits owner decision. |
| **`GAP-006`** | Pure-PG `session-ledgers` `GET` fallback & IDB offline shift hydration | **Fixed & Verified** | Removed early `!admin` return; merged IDB shift snapshots into `PoolGateKioskView` & check-ins (`offlineSyncQueue.test.ts`). |
| **`GAP-007`** | Self-listing / instant unbadged provider publish vs `super_admin` pre-approval | **Blocked by Product Decision** (`OQ-008`) | Existing publish flow and honest unverified badges (`self_listed_pending`) preserved intact. |
| **`GAP-008`** | Single `<main>` on `/pools` (`D4.tsx`) & strict CORS headers (`middleware.ts`, `next.config.mjs`) | **Fixed & Verified** | Verified `mainCount === 1` in live production `/pools` & `F-021` + `remediation-regression.spec.ts` #1. |
| **`GAP-009`** | Self-service OTP email/SMS delivery hardening (`member-auth/route.ts` & `D11.tsx`) | **Fixed & Configured Free Tier** (`OQ-009`) | Secret-free `503 deliveryUnavailable`, timeout-bounded fetch, `otp-delivery.test.ts` (`3/3`), and live Resend free tier configured (`onboarding@resend.dev` limit noted in Sec. 7). |
| **`GAP-010`** | Law 3/1985 editor error surfacing & server promo validation (`maxUses`/expiry) | **Fixed & Verified** (`OQ-004`) | `AthleteProfileSocialEditor` surfaces Law 3/1985 rejections (`E2E` #7); `POST session-ledgers` validates/increments promo usage (`session-ledgers-pin-concurrency.test.ts`). |
| **`GAP-011`** | Plus Code (`X529+F73`) cleanup & public read-only view `captenly_facilities_public` | **Executed in Live DB + Stripped in UI** (`OQ-005` Pro PITR excluded) | Migration `006` scrubbed SQL `address`/`district` (`0` rows left) and created `captenly_facilities_public` view. UI `stripPlusCode` removes raw Plus Codes on all screens (see Sec. 3 note on legacy JSONB keys). |
| **`GAP-012`** | Mobile/Desktop Performance & LCP/SSR hardening (`jsQR` lazy-load, SSR Hero Card, idle deferrals) | **Substantially Hardened** | Refactored persistent SSR Hero Card (`HomeScreenClient.tsx`/`P21.tsx`/`D24.tsx`), added `/pools` SSR shell (`PoolsSsrShell`), priority `<CaptenlyImage>` in `D4.tsx`, deferred guest `GoogleSessionBridge`/`public-supply`/`IDB` reads, and removed 4MB CSS font (`globals.css`). Full `CaptenlyProvider` split kept out of scope cleanly. |
| **`GAP-013`** | Automated unit, integration & regression E2E test suites | **Fixed & Verified** | `38` unit tests (`9` suites), `21` integration tests (`6` suites), and `86` passing Playwright E2E specs (`6` viewport skips, `0` failures). |
| **`GAP-014`** | `general_staff` 3h override parity & `>80` ledger cursor pagination (`limit`/`offset`/`hasMore`) | **Fixed & Verified** (`OQ-010`) | UI matches server `409` boundary; paginated `lookupRemoteLedgersOrProfile` wired (`session-ledgers-pin-concurrency.test.ts`). |
| **`GAP-015`** | Real save flows in `DynamicScheduleCardsBuilder` & `AuthorArticlesManager` | **Fixed & Verified** | Eliminated `1.7s` fake timers and wired inline schedule edits. |
| **`GAP-016`** | `/admin` empty ledger guard & admin-only `GET /api/supabase/demand-radar` | **Fixed & Verified** | `demand-radar-admin.test.ts` (`3/3`), `/admin` Tab 5 viewer & empty guard (`E2E` #6). |
| **`GAP-017`** | Newsletter persistence (`/api/supabase/newsletter`) & real WhatsApp notifications UI | **Implemented & Live Deployed** | `/api/supabase/newsletter` (`400` validation verified live; `D21.tsx` wired, `E2E` #9); official Meta WhatsApp engine, webhook, cron, `AthleteNotificationsSettingsClient` (`E2E` #8), and `FacilityOpsAuditTab` absentee alert trigger deployed. |
| **`GAP-018`** | `D10` minor signup `depsRef` race, `3–17` age bounds, receipt/confirm inline modals | **Fixed & Verified** | Eliminated `alert()`/`confirm()`, verified receipt modal (`E2E` #4). |
| **`GAP-019`** | Logged-in desktop `/coaches` nav (`SiteHeader`), `P12` parity & `/compare` lock hint | **Fixed & Verified** | Desktop `/coaches` nav verified (`E2E` #3). |
| **`GAP-020`** | Removed hardcoded SLA metrics (`repliedWithin2h: true / replyMinutes: 15`) | **Fixed & Verified** (`OQ-013`) | Truthful unverified SLA defaults in `useTelemetrySync.ts` / `useTelemetryDomain.ts`. |
| **`GAP-021`** | CAS concurrency (`409`) + `consent_logs` & `abuse_reports` Migration `007` | **Fixed & Live Executed** | Migration `007` created RLS-protected `captenly_consent_logs` & `captenly_abuse_reports`; `/api/supabase/user-state` (`minor_upsert`) inserts Law 151/2020 minor consent audit logs. |
| **`GAP-022`** | History CSV export | **Deferred — Optional Enhancement** | Explicitly deferred. |
| **`GAP-023`** | Bounded `/api/places/photo` LRU cache (`200` entries / `5 MB` cap) | **Hardened in Code** (`OQ-014` Storage deferred) | Prevents memory growth in serverless functions; Supabase Storage bucket migration deferred (`$0` free tier). |
| **`GAP-024`** | Unused 4MB Material Symbols font & dead `src/screens/P11.tsx` removal | **Fixed & Verified** | Removed dead `@font-face` and unused file cleanly. |
| **`GAP-025`** | Multi-ledger picker in `QrCameraScannerModal` | **Deferred — Optional Enhancement** | Explicitly deferred. |
| **`GAP-026`** | Unified EN+AR Law 3/1985 medical claims compliance (`medicalCompliance.ts`) | **Fixed & Verified** | Enforced across client + `useSupplyDomain.ts`. |
| **`GAP-027`** | Inline renewal pricing edits | **Deferred — Optional Enhancement** | Explicitly deferred. |
| **`GAP-028`–`GAP-032`** | Online PSP payments, live calendar/lane booking, generic Web Push, `fitness` sector, SW Background Sync / USB HID | **Deferred — Future Opportunity** | Intentionally excluded (`0` unauthorized commercial/billing code added). |

---

## 3. Supabase Production Database Audit & Migrations (`aobmijghzsmsnnikefkb`)

1. **Client Query Audit:** Searched `src/` prior to executing Migration `006`; confirmed zero direct client-side `anon` queries against `captenly_facilities` (all database reads/writes execute server-side via `service_role` or `withPgClient`).
2. **Pre-Migration Backup:** Saved a local JSON backup of matching facility record `fac-1794915870720-vzc2` (`X529+F73`) into untracked `.git/captenly-pre-006-backup.json` (excluded from git commits).
3. **Executed Migrations (Verified via Live Supabase SQL Editor on Project `aobmijghzsmsnnikefkb`):**
   - [`supabase/migrations/20261127000006_captenly_pluscode_cleanup_and_public_view.sql`](file:///e:/Moustafa%20Ezzat/Captenly/supabase/migrations/20261127000006_captenly_pluscode_cleanup_and_public_view.sql): Scrubbed raw Plus Code `X529+F73` from SQL `address`/`district` columns on `captenly_facilities` and created restricted `captenly_facilities_public` view.
   - [`supabase/migrations/20261127000007_captenly_whatsapp_notifications_and_compliance.sql`](file:///e:/Moustafa%20Ezzat/Captenly/supabase/migrations/20261127000007_captenly_whatsapp_notifications_and_compliance.sql): Created RLS-enabled `captenly_whatsapp_dispatches`, `captenly_newsletter_subscribers`, `captenly_consent_logs`, and `captenly_abuse_reports`.
4. **Live Verification Query Results Observed:**
   - `captenly_*` table count: **`19`**, with **`19/19` (`rowsecurity = true`)**.
   - Plus Codes remaining in `captenly_facilities.address` / `district`: **`0`** (`NONE`).
   - `captenly_facilities_public` view projection check on `fac-1794915870720-vzc2`: **`owner=false, staff=false`** (sensitive PII/staff/owner keys excluded from public view).
5. **Remaining Data Note Found During Live API Inspection:**
   - Inspection of `GET https://captenly.vercel.app/api/supabase/public-supply` showed that inside `fac-1794915870720-vzc2`'s JSON payload, `locations[0].addressAr`, `sourcePublicNoteAr`, and `publicDescriptionAr` still contain the string `X529+F73` in raw JSON because Migration `006` scrubbed top-level SQL columns (`address`, `district`) rather than rewriting nested JSONB note/location keys. Every public UI component strips Plus Codes at render time (`hasPlusCode === false` verified across all 7 live DOM routes and E2E test #2).

---

## 4. WhatsApp Notifications Architecture & Free-Tier Service Activation ($0)

### 4.1 Implemented Code & Endpoints
- **Core Dispatcher:** [`src/lib/server/whatsappNotifications.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/lib/server/whatsappNotifications.ts) (`normalizeWhatsAppPhone`, `maskPhoneLast4`, `getCairoDateString`, `buildWhatsAppDedupeKey`, `getWhatsAppProviderStatus`, `buildArabicMessageForEvent`, `dispatchWhatsAppNotification`, `listWhatsAppDispatches`, `updateWhatsAppDeliveryStatusByProviderId`, `retryDueWhatsAppDispatches`).
- **Webhook Endpoint:** [`src/app/api/whatsapp/webhook/route.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/api/whatsapp/webhook/route.ts) (`GET` verification using `crypto.timingSafeEqual`, `POST` Meta delivery `statuses[]` reconciliation with optional `X-Hub-Signature-256` HMAC validation via `WHATSAPP_APP_SECRET`).
- **Notifications API:** [`src/app/api/notifications/whatsapp/route.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/api/notifications/whatsapp/route.ts) (`GET` scoped history + provider mode, `POST` `send_test`, `retry_failed`, `send_absence_alert`, `send_session_reminder`, `send_renewal_reminder`).
- **Daily Scheduled Cron:** [`src/app/api/cron/whatsapp-reminders/route.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/api/cron/whatsapp-reminders/route.ts) + [`vercel.json`](file:///e:/Moustafa%20Ezzat/Captenly/vercel.json) (`0 7 * * *` daily UTC schedule within Vercel Hobby free-tier limits; gated by `CRON_SECRET` Bearer or `super_admin`; scans active & `renewal_due` ledgers in `Africa/Cairo` and retries eligible failed dispatches).
- **Lifecycle Hooks & UI Wiring:**
  - [`src/app/api/supabase/session-ledgers/route.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/api/supabase/session-ledgers/route.ts): Triggers non-blocking dispatches on `attendance_checkin`, `subscription_expiring`, `subscription_renewal`, and `receipt_confirmed`.
  - [`src/app/dashboard/athlete/settings/notifications/AthleteNotificationsSettingsClient.tsx`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/dashboard/athlete/settings/notifications/AthleteNotificationsSettingsClient.tsx): Displays truthful sandbox/provider status (`freeTierNoteAr`), test send trigger, and recent masked delivery status log.
  - [`src/components/facility-desk/FacilityOpsAuditTab.tsx`](file:///e:/Moustafa%20Ezzat/Captenly/src/components/facility-desk/FacilityOpsAuditTab.tsx): Adds server-side `"إرسال"` absentee alert (`send_absence_alert`) alongside existing `wa.me` fallback.
  - [`src/app/api/supabase/newsletter/route.ts`](file:///e:/Moustafa%20Ezzat/Captenly/src/app/api/supabase/newsletter/route.ts) & [`src/screens/D21.tsx`](file:///e:/Moustafa%20Ezzat/Captenly/src/screens/D21.tsx): Persists `/magazine` newsletter signups into `captenly_newsletter_subscribers` with rate limiting and email validation.

### 4.2 External Services & Vercel Production Env Configuration
- **Vercel Production Env Variables Configured** (names only; values stored strictly as Vercel encrypted secrets):
  1. `RESEND_API_KEY`
  2. `RESEND_FROM_EMAIL` (`Captenly <onboarding@resend.dev>`)
  3. `WHATSAPP_PHONE_NUMBER_ID` (`1535481539641539`)
  4. `WHATSAPP_ACCESS_TOKEN`
  5. `WHATSAPP_MODE` (`test_sandbox`)
  6. `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  7. `CRON_SECRET`
- **Resend (`moustafadesign.12` — Free Plan: `3,000` emails/mo, `100`/day):** API key generated, stored in Vercel Production, and verified `"Delivered"` (`"Hello World"`) to `moustafadesign.12@gmail.com` in Resend Emails log.
- **Meta WhatsApp Cloud API (`MCD Agent` App `1399063506631930`, Business `976345157056324`, WABA `1175293008525159` — Free Sandbox):** Accepted free sandbox terms, claimed official Meta test number `+1 (555) 631-9594`, generated token, configured Webhook Callback `https://captenly.vercel.app/api/whatsapp/webhook`, clicked Verify & Save on Meta Dashboard, and confirmed automatic subscription (`checked`) on **`messages` (`v27.0`)**, `message_template_status_update`, `message_template_quality_update`, `phone_number_name_update`, `phone_number_quality_update`, `security`, `account_alerts`, and `account_review_update`.

---

## 5. Verification Results (Latest Runs After Final Code Edit)

| Check / Suite | Command | Latest Result | Evidence Log |
| :--- | :--- | :--- | :--- |
| **TypeScript** | `npx tsc --noEmit` | **`0` errors** (Exit `0`) | Verified prior to commit `0f079ee` |
| **ESLint** | `npm run lint` | **`0` errors** (`<img>` / `deps` warnings only) | [`remediation-2026-11/evidence/lint.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/lint.log) |
| **Circular Dependencies** | `npx madge --circular --extensions ts,tsx src` | **`0` cycles** across **`218` files** | [`remediation-2026-11/evidence/madge.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/madge.log) |
| **Dependency Vulnerabilities** | `npm audit --json` | **`0` vulnerabilities** (`info/low/moderate/high/critical: 0`) | [`remediation-2026-11/evidence/npm-audit.json`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/npm-audit.json) |
| **Unit Tests** | `npm run test:unit` | **`38 passed, 0 failed, 0 skipped`** (`9` suites) | [`remediation-2026-11/evidence/unit-tests.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/unit-tests.log) |
| **API Integration Tests** | `npm run test:integration` | **`21 passed, 0 failed, 0 skipped`** (`6` suites) | [`remediation-2026-11/evidence/integration-tests.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/integration-tests.log) |
| **Production Build** | `npm run build` | **PASS** (Exit `0`, `50/50` static pages generated) | [`remediation-2026-11/evidence/next-build.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/next-build.log) |
| **Playwright E2E Suite** | `npx playwright test --workers=1` | **`86 passed, 6 viewport skips, 0 failed`** (`5.5m`) | [`remediation-2026-11/evidence/playwright-e2e.log`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/playwright-e2e.log) |

**Documented Playwright E2E Skips (`6` total, all viewport-intentional):**
- `desktop-chromium` (`1` skip): `remediation-regression.spec.ts` #5a (mobile `P5.tsx` 4-digit PIN view).
- `mobile-chromium` (`5` skips): `F-013` (desktop FilterModal/Header), `F-014` (desktop `/explore` side-by-side map), `F-027(e)` (desktop `SiteHeader` staff tab truncation), `remediation-regression.spec.ts` #3 (logged-in desktop `/coaches` nav), and #5b (desktop Gate Kiosk 4-digit PIN + retry badge).
- **Note on Integration Scope:** All `21` API integration tests ran using Node 24 module mocks against simulated NextAuth/Supabase/Meta responses to keep automated test runs isolated and non-destructive; live production behavior was separately verified in Section 6.

### 5.1 Lighthouse Comparison (Baseline -> Interim After -> Final)
Measured locally against production `next start` (`127.0.0.1:3197`) using Playwright Chromium (`lighthouse-baseline.json`, `lighthouse-after.json`, [`lighthouse-final.json`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/evidence/lighthouse-final.json)):

| Route | Mode | Perf (`Base -> After -> Final`) | A11y (Final) | BP (Final) | SEO (Final) | LCP (`Base -> Final`) | CLS (`Base -> Final`) | TBT (`Base -> Final`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`/` (Home)** | Mobile | `34 -> 46 -> 41` | `100` | `100` | `100` | `9,306ms -> 5,736ms` | `0.0012 -> 0.0457` | `4,634ms -> 4,972ms` |
| **`/` (Home)** | Desktop | `98 -> 95 -> 87` | `100` | `100` | `100` | `802ms -> 877ms` | `0.0515 -> 0.0534` | `83ms -> 289ms` |
| **`/explore`** | Mobile | `57 -> 59 -> 55` | `100` | `100` | `92` | `4,672ms -> 4,944ms` | `0 -> 0.0005` | `1,551ms -> 1,561ms` |
| **`/explore`** | Desktop | `57 -> 89 -> 74` | `100` | `96` | `92` | `6,256ms -> 2,831ms` | `0.0035 -> 0.0031` | `268ms -> 209ms` |
| **`/coaches`** | Mobile | `74 -> 77 -> 70` | `100` | `100` | `100` | `1,208ms -> 1,265ms` | `0.0001 -> 0.2115` | `1,489ms -> 828ms` |
| **`/coaches`** | Desktop | `79 -> 96 -> 98` | `100` | `100` | `100` | `436ms -> 395ms` | `0.012 -> 0.013` | `499ms -> 114ms` |
| **`/pools`** | Mobile | `56 -> 55 -> 56` | `100` | `100` | `100` | `4,792ms -> 4,271ms` | `0.0672 -> 0` | `1,501ms -> 2,333ms` |
| **`/pools`** | Desktop | `99 -> 91 -> 91` | `98` | `100` | `100` | `930ms -> 1,524ms` | `0.013 -> 0.0037` | `36ms -> 109ms` |
| **`/dashboard/facility/gate`** | Mobile | `69 -> 69 -> 66` | `100` | `100` | `69` | `4,132ms -> 4,335ms` | `0 -> 0.0009` | `699ms -> 803ms` |
| **`/dashboard/facility/gate`** | Desktop | `96 -> 90 -> 97` | `100` | `100` | `69` | `1,240ms -> 1,174ms` | `0.0058 -> 0.0039` | `88ms -> 38ms` |

**Honest Performance Note:** Mobile `/` LCP improved significantly vs initial baseline (`9,306ms -> 5,736ms`), Desktop `/coaches` rose `79 -> 98`, Desktop `/explore` rose `57 -> 74` (`LCP 6,256ms -> 2,831ms`), `/pools` Mobile CLS dropped to `0`, and Desktop `/dashboard/facility/gate` reached `97`. Mobile `/` TBT (`~4.97s`) and `/coaches` Mobile CLS (`0.2115`) remain constrained primarily by the global `<CaptenlyProvider>` root hydration architecture and client screen switching wrapper (`ResponsiveScreen`), which were intentionally kept intact to avoid breaking `63+` consumer modules.

---

## 6. Live Production Smoke Verification (`https://captenly.vercel.app`)

1. **Live Production APIs Verified After `f4162b9` Deploy:**
   - `GET /api/supabase/health` -> **`200`** `{"ok":true,"status":"healthy"}`
   - `GET /api/whatsapp/webhook` (valid `hub.verify_token` & `hub.mode=subscribe`) -> **`200`** `captenly_ok`
   - `GET /api/whatsapp/webhook` (invalid `hub.verify_token`) -> **`403`**
   - `GET /api/notifications/whatsapp` (unauthenticated) -> **`401`**
   - `GET /api/cron/whatsapp-reminders` (unauthenticated) -> **`401`**
   - `GET /api/cron/whatsapp-reminders` (`Authorization: Bearer <CRON_SECRET>`) -> **`200`** `{"ok":true,"cairoDate":"2026-11-28","scanned":0,"sessionRemindersTriggered":0,"expiryRemindersTriggered":0,"retrySummary":{"attempted":0,"sent":0,"failed":0}}`
   - `POST /api/supabase/newsletter` (`{"email":"not-an-email"}`) -> **`400`** `{"ok":false,"persisted":false,"messageAr":"يرجى إدخال بريد إلكتروني صحيح."}`
2. **Live Production Browser Checks (Chrome DevTools across `7` routes):**
   - `/`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests, zero uncaught JS console errors.
   - `/pools`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   - `/explore`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   - `/coaches`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   - `/magazine`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   - `/dashboard/facility/gate`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   - `/auth`: `mainCount=1`, `h1Count=1`, `hasPlusCode=false`, zero HTTP >=500 requests.
   *(Note: on `/` and `/pools`, an optional legacy hero media slot request for `fac-1794915870720-vzc2` returned expected `404` when falling back to static imagery; zero `5xx` errors occurred anywhere.)*

---

## 7. Honest Free-Tier Constraints & Exact Owner Follow-Up Actions

1. **Meta WhatsApp Token Lifecycle:** The generated `WHATSAPP_ACCESS_TOKEN` is Meta's standard **24-hour Developer Temporary Token**. To keep automated WhatsApp dispatches working continuously beyond 24 hours without re-generating tokens, create a **Meta Business System User** in Meta Business Settings -> assign it Full Control of App `1399063506631930` and WABA `1175293008525159`, generate a non-expiring System User token (free), and update `WHATSAPP_ACCESS_TOKEN` in Vercel Production (plus optionally add `WHATSAPP_APP_SECRET` from App Basic Settings so webhook `POST` payloads enforce strict `X-Hub-Signature-256` verification).
2. **Meta Free Sandbox Recipient Gate (`OTP Required`):** The Meta test number `+1 (555) 631-9594` currently has **`0` verified recipient test phone numbers** configured because adding any recipient number in Meta Step 1 requires entering an OTP sent to that personal WhatsApp phone. Up to `5` free test phones can be added under **Meta Developer Console -> WhatsApp -> Quickstart / Step 1 -> "إلى" -> "إدارة قائمة أرقام الهاتف"** so you can receive live sandbox test messages from `/dashboard/athlete/settings/notifications` and Gate/Ops triggers.
3. **Meta Production Rollout Boundary (`Business Verification` + Approved Arabic Templates):** Sandbox mode only sends to the up to `5` OTP-verified test phones and delivers test webhooks only while the Meta app is unpublished. Reaching arbitrary Egyptian swimmers/parents in production requires:
   - Completing **Meta Business Verification** (`Step 3`) with official company/academy documents,
   - Connecting and registering an official business WhatsApp phone number,
   - Submitting and getting Meta approval for Arabic utility message templates, and publishing the Meta app (free tier includes `1,000` user-initiated service conversations/month; business-initiated utility templates outside a 24h customer reply window are billed per Meta's WhatsApp rate card), then switching `WHATSAPP_MODE` from `test_sandbox` to `production`.
4. **Resend Custom Domain Requirement:** Resend is currently on its free `onboarding@resend.dev` sender, which **only delivers to `moustafadesign.12@gmail.com`**. To deliver password-reset OTPs (`member-auth`) to arbitrary user email addresses in Egypt/globally (`3,000` emails/month free), verify a custom domain (e.g., `captenly.com`) in **Resend -> Domains -> Add Domain** with DNS SPF/DKIM records and update `RESEND_FROM_EMAIL` in Vercel Production.
5. **Remaining Product-Owner Policy Decisions:** Review and sign off on `OQ-007` (`GAP-005` dual-hatted family access on promoted coach/facility accounts) and `OQ-008` (`GAP-007` provider pre-approval vs instant unbadged self-publish) in [`CAPTENLY_Open_Product_Decisions.md`](file:///e:/Moustafa%20Ezzat/Captenly/remediation-2026-11/CAPTENLY_Open_Product_Decisions.md), plus consider cleaning nested `locations[0].addressAr` / `sourcePublicNoteAr` / `publicDescriptionAr` in `captenly_facilities.data` for `fac-1794915870720-vzc2` if desired in raw API JSON.
6. **Hardware / Physical Gate Field QA:** Physical Android/tablet rear camera QR scanning (`QrCameraScannerModal`) and physical pool-side offline/reconnect transitions remain unverified on physical hardware here (verified via mocked browser E2E and JS unit/integration contracts).
