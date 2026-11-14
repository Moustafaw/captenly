# تحديثات قيد الانتظار — لم تُطبّق على السيرفر بعد (Pending Server Apply)

> [!IMPORTANT]
> **الحالة الحالية:** جميع التعديلات الموجودة في هذا الفرع (`pending-server-apply`) مرفوعة على GitHub للمراجعة والتوثيق فقط، **ولم يتم دمجها في فرع `main` أو تطبيقها على السيرفر الحي (`captenly.vercel.app`) حتى الآن.**

- **الفرع على GitHub:** `pending-server-apply`
- **فرع الإنتاج (`main`):** ما زال عند آخر نسخة مفعّلة (`fd31b42`) دون أي تغيير.
- **نطاق التحقق قبل الرفع:** تم التحقق محلياً عبر `npx tsc --noEmit` و`npm run build` (Next.js 14.2.35 — 47/47 مساراً دون أخطاء).

---

## ملخص التعديلات المجمّعة في هذا الفرع

1. **توحيد حساب السبّاح وولي الأمر في حساب واحد (`adult_athlete` عبر `isMemberAccountRole`):**
   - اختصار بوابة التسجيل والاختيار إلى 3 فئات فقط: **سبّاح / متدرب وولي أمر (حساب موحد)**، **كابتن سباحة**، **إدارة نادي أو أكاديمية**، مع الإبقاء على دعم `"parent"` داخلياً لتوافق السجلات السابقة.
   - إتاحة إضافة ومتابعة الأبناء اختيارياً من نفس الحساب عند الحاجة، دون فرض واجهات ولي الأمر على من لا يملك أبناء مسجّلين.
2. **الأمان، المصادقة، وخصوصية الـ PIN:**
   - إضافة [src/lib/memberSession.ts](../src/lib/memberSession.ts) لإصدار والتحقق من كوكي جلسة موقّع (`HttpOnly` — `captenly_member_session`) ودعم جلسات Google/NextAuth والأدمن، مع تنقية معاملات البحث (`sanitizeFilterToken`) والتحقق من صلاحية الموظفين (`hasFacilityStaffAccess` / `callerHasAnyStaffRole`).
   - ربط [src/app/api/auth/member-auth/route.ts](../src/app/api/auth/member-auth/route.ts) بإصدار ومسح الكوكي وإضافة `verify_otp` و`logout`، وإغلاق ثغرة التجاوز في [src/screens/Dotp.tsx](../src/screens/Dotp.tsx).
   - تأمين مسارات `/api/supabase/*` (`session-ledgers`, `sync-profile`, `user-state`, `public-supply`, `leads`, `notifications`, `staff-lookup`) بالتحقق من الجلسة والملكية، وحجب `pinCode` (`"****"`) عن غير المالك/الأدمن، ومنع تسريبه في شاشات مقدم الخدمة (`D8.tsx`, `P5.tsx`).
3. **إصلاحات التجربة، الحسابات الرياضية، ولوحة الإدارة (`/admin`):**
   - تحويل `/f/[slug]` إلى إعادة توجيه نحو `/academy/[slug]`، وضبط fallback الـ PWA، وإصلاح فهرس البحث عن الكباتن، وعرض التنسيق العريض في المقالات، وحساب نسبة التقدّم حسب نوع الوحدة (الأقل أفضل للزمن مقابل الأعلى أفضل للمسافة والنقاط).
   - تحويل طابور مراجعة الشارات في [src/app/admin/page.tsx](../src/app/admin/page.tsx) لقراءة الوثائق الحية قيد الانتظار (`pending`) بدلاً من بيانات وهمية، وحذف 13 ملفاً مهملاً غير مستخدم في `src/components` و`src/screens`.

---

## جرد الملفات في هذا التحديث

- **ملفات جديدة مضافة (`src/`):**
  - `src/lib/memberSession.ts`
  - `src/lib/facilityPricing.ts`
  - `src/components/auth/RoleAccessDeniedScreen.tsx`
  - `src/app/api/auth/admin-verify/route.ts`
  - `src/app/api/auth/member-auth/route.ts`
  - `src/app/api/supabase/staff-lookup/route.ts`
  - `src/app/api/supabase/user-state/route.ts`
- **ملفات محذوفة لعدم الاستخدام:**
  - `src/components/BottomNav.tsx`, `src/components/BrandIcons.tsx`, `src/components/CaptenlyLogo.tsx`, `src/components/FounderPersonaBar.tsx`, `src/components/LegalFooter.tsx`, `src/components/Navbar.tsx`
  - `src/screens/P3.tsx`, `src/screens/P7.tsx`, `src/screens/P10.tsx`, `src/screens/P15.tsx`, `src/screens/P16.tsx`
  - `src/screens/chrome/DesktopFooterRaw.tsx`, `src/screens/chrome/DesktopHeaderRaw.tsx`
- **ملفات معدّلة:** شاشات Auth/Dashboards، السياق الرئيسي `CaptenlyContext.tsx`، مكوّنات Chrome/Editorial/QR، مسارات API الخاصة بـ Supabase والـ Places، و`public/sw.js`.

---

## طريقة التطبيق على السيرفر لاحقاً (عند الجاهزية)

لتفعيل هذه التعديلات على الموقع المنشور، يتم دمج هذا الفرع في `main` عبر Pull Request على GitHub أو محلياً:

```bash
git checkout main
git merge pending-server-apply
git push origin main
```
