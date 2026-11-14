# التعديلات المعلّقة — لم تُطبّق على السيرفر بعد (Pending Server Apply)

> [!IMPORTANT]
> **تنبيه هام للمستخدم ولكل Agent أو مراجع يحلّل هذا المستودع:**
> - **النسخة المفعّلة حالياً على السيرفر الحي (`captenly.vercel.app`) هي نسخة مجلدي `src/` و`public/` الرئيسية في فرع `main` (مبنية على الكوميت الأساسي `fd31b42`).**
> - **جميع التعديلات الجديدة والمحدّثة موجودة بالكامل داخل هذا المجلد (`pending-updates/`) — وأيضاً على الفرع الكامل `pending-server-apply` (كوميت `4039961`) — ولكنها لم تُطبّق على السيرفر الحي بعد.**
> - لأغراض التحليل والمراجعة الشاملة للمنصة: يجب تحليل نسخة `main` الحالية جنباً إلى جنب مع التعديلات المجمّعة هنا في `pending-updates/`.
>
> **Note for AI Agents / Reviewers:**
> The active deployed code in `main/src/` and `main/public/` reflects the pre-update live server state (`fd31b42`). All pending updates awaiting server deployment are staged inside `pending-updates/` (and runnable in branch `pending-server-apply` at commit `4039961`):
> - [`files/`](./files) — Full mirrored snapshot of all **66 added & modified files** (`59` modified + `7` newly created).
> - [`CHANGES.patch`](./CHANGES.patch) — Complete line-by-line unified `git diff` against `fd31b42` covering all **79 changed repo files**.
> - [`DELETED_FILES.txt`](./DELETED_FILES.txt) — Exact list of the **13 unused legacy files** slated for removal.
>
> `tsconfig.json` excludes `pending-updates` so the currently live `main` build remains strictly unaffected until these changes are applied.

---

## محتويات هذا المجلد (`pending-updates/`)

1. **[`files/`](./files)** (`66` ملفاً — `59` معدّلاً + `7` ملفات جديدة):
   - نسخة كاملة مطابقة للملفات الجديدة والمعدّلة تحت مساراتها الفعلية (`files/src/...` و`files/public/sw.js`) لسهولة قراءتها مباشرة دون فك الـ diff.
2. **[`CHANGES.patch`](./CHANGES.patch)** (`12,058` سطراً تقريباً):
   - ملف الفروقات الكامل (Unified Git Diff) بين النسخة الحيّة الحالية (`fd31b42`) والتعديلات المعلّقة (`4039961`).
3. **[`DELETED_FILES.txt`](./DELETED_FILES.txt)** (`13` ملفاً):
   - قائمة الملفات القديمة غير المستخدمة المقرر حذفها عند التطبيق على السيرفر.

---

## ملخص التعديلات المعلّقة المشمولة هنا

1. **توحيد حساب السبّاح وولي الأمر في حساب واحد (`adult_athlete` عبر `isMemberAccountRole`):**
   - اختصار بوابة التسجيل والاختيار إلى 3 فئات فقط: **سبّاح / متدرب وولي أمر (حساب موحد)**، **كابتن سباحة**، **إدارة نادي أو أكاديمية**، مع الإبقاء على دعم `"parent"` داخلياً لتوافق السجلات السابقة.
   - إتاحة إضافة ومتابعة الأبناء اختيارياً من نفس الحساب عند الحاجة، دون فرض واجهات ولي الأمر على من لا يملك أبناء مسجّلين.
2. **الأمان، المصادقة، وخصوصية الـ PIN:**
   - إضافة [`files/src/lib/memberSession.ts`](./files/src/lib/memberSession.ts) لإصدار والتحقق من كوكي جلسة موقّع (`HttpOnly` — `captenly_member_session`) ودعم جلسات Google/NextAuth والأدمن، مع تنقية معاملات البحث (`sanitizeFilterToken`) والتحقق من صلاحية الموظفين (`hasFacilityStaffAccess` / `callerHasAnyStaffRole`).
   - ربط [`files/src/app/api/auth/member-auth/route.ts`](./files/src/app/api/auth/member-auth/route.ts) بإصدار ومسح الكوكي وإضافة `verify_otp` و`logout`، وإغلاق ثغرة التجاوز في [`files/src/screens/Dotp.tsx`](./files/src/screens/Dotp.tsx).
   - تأمين مسارات `/api/supabase/*` (`session-ledgers`, `sync-profile`, `user-state`, `public-supply`, `leads`, `notifications`, `staff-lookup`) بالتحقق من الجلسة والملكية، وحجب `pinCode` (`"****"`) عن غير المالك/الأدمن، ومنع تسريبه في شاشات مقدم الخدمة (`D8.tsx`, `P5.tsx`).
3. **إصلاحات التجربة، الحسابات الرياضية، ولوحة الإدارة (`/admin`):**
   - تحويل `/f/[slug]` إلى إعادة توجيه نحو `/academy/[slug]`، وضبط fallback الـ PWA، وإصلاح فهرس البحث عن الكباتن، وعرض التنسيق العريض في المقالات، وحساب نسبة التقدّم حسب نوع الوحدة (الأقل أفضل للزمن مقابل الأعلى أفضل للمسافة والنقاط).
   - تحويل طابور مراجعة الشارات في [`files/src/app/admin/page.tsx`](./files/src/app/admin/page.tsx) لقراءة الوثائق الحية قيد الانتظار (`pending`) بدلاً من بيانات وهمية، وحذف 13 ملفاً مهملاً غير مستخدم (موثقة في [`DELETED_FILES.txt`](./DELETED_FILES.txt)).

---

## جرد الملفات المضافة والمحذوفة والمعدّلة

- **ملفات جديدة مضافة (`7` ملفات في [`files/src/`](./files/src)):**
  - `src/lib/memberSession.ts`
  - `src/lib/facilityPricing.ts`
  - `src/components/auth/RoleAccessDeniedScreen.tsx`
  - `src/app/api/auth/admin-verify/route.ts`
  - `src/app/api/auth/member-auth/route.ts`
  - `src/app/api/supabase/staff-lookup/route.ts`
  - `src/app/api/supabase/user-state/route.ts`
- **ملفات محذوفة عند التطبيق (`13` ملفاً — راجع [`DELETED_FILES.txt`](./DELETED_FILES.txt)):**
  - `src/components/BottomNav.tsx`, `src/components/BrandIcons.tsx`, `src/components/CaptenlyLogo.tsx`, `src/components/FounderPersonaBar.tsx`, `src/components/LegalFooter.tsx`, `src/components/Navbar.tsx`
  - `src/screens/P10.tsx`, `src/screens/P15.tsx`, `src/screens/P16.tsx`, `src/screens/P3.tsx`, `src/screens/P7.tsx`
  - `src/screens/chrome/DesktopFooterRaw.tsx`, `src/screens/chrome/DesktopHeaderRaw.tsx`
- **ملفات معدّلة (`59` ملفاً في [`files/`](./files)):**
  - شاشات Auth/Dashboards، السياق الرئيسي `CaptenlyContext.tsx`، مكوّنات Chrome/Editorial/QR، مسارات API الخاصة بـ Supabase والـ Places، و`public/sw.js`.

---

## طريقة التطبيق على السيرفر لاحقاً (عند الجاهزية)

الفرع الجاهز للتطبيق الكامل موجود أيضاً باسم `pending-server-apply` (كوميت `4039961`):

```bash
git checkout main
git merge pending-server-apply
git push origin main
```
