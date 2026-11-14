import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        <div className="bg-surface-card rounded-[20px] p-8 md:p-10 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="font-section-title text-[28px] text-dark-slate">
              سياسة الخصوصية وحماية البيانات (القانون 151 لسنة 2020)
            </h1>
            <span className="text-deep-olive text-xs font-extrabold">
              متوافق مصرياً ✓
            </span>
          </div>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">1. استقلال الرياضيين واختيارية ربط ولي الأمر</h2>
            <p>
              يحق للرياضيين البالغين التسجيل وإدارة باقاتهم وسجلاتهم الرياضية بشكل مستقل تماماً. أما ربط حساب ولي الأمر للأبناء تحت 14 سنة فهو خيار متاح طوعاً للأسر بموافقة صريحة، وتبقى ملفات القُصّر خاصة وغير ظاهرة للعامة افتراضياً.
            </p>
          </section>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">2. حفظ بيانات دفتر الحصص أوفلاين</h2>
            <p>
              تُحفظ سجلات حضور الـ QR محلياً على جهازك عند انقطاع الشبكة لضمان عدم ضياع أي حصة، وتُزامَن فقط بمجرد استقرار الاتصال ضمن حدود العضوية المفعّلة مع الكابتن أو المنشأة.
            </p>
          </section>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">3. التحقق من بيانات المنشآت العامة</h2>
            <p>
              تُعرض الصفحات الأولية للمنشآت المدرجة وفق اسمها ونطاقها الجغرافي، مع توضيح عدم توفر بيانات مباشرة ما لم تفعّل إدارة المنشأة حسابها وتوثق بياناتها بنفسها مجاناً وفوراً.
            </p>
          </section>

          <div className="pt-4 border-t border-surface-container flex items-center justify-between flex-wrap gap-3">
            <Link href="/terms" className="text-deep-olive font-badge-label hover:underline">
              الاطلاع على شروط الاستخدام وميثاق التوثيق ←
            </Link>
            <Link
              href="/dashboard/athlete/settings/security"
              className="px-5 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs"
            >
              إعدادات الخصوصية والأمان بحسابي
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
