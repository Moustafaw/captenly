import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        <div className="bg-surface-card rounded-[20px] p-8 md:p-10 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="font-section-title text-[28px] text-dark-slate">
              شروط الاستخدام وميثاق التوثيق الرياضي
            </h1>
            <span className="text-deep-olive text-xs font-extrabold">
              ميثاق كابتنلي ✓
            </span>
          </div>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">1. التزام القانون رقم 3 لسنة 1985</h2>
            <p>
              تُحظر استخدمات أوصاف مثل «علاج طبيعي» أو «تشخيص طبي» أو «روشتة» في ملفات المدربين غير الحاصلين على ترخيص مزاولة المهنة الطبي المعتمد، وتقتصر خدمات الكباتن على التدريب الرياضي والإنقاذ المائي واللياقة البدنية.
            </p>
          </section>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">2. شفافية البيانات والباقات الموثقة</h2>
            <p>
              تلتزم المنشآت المفعّلة والموثقة بتحديث باقاتها بانتظام وتوضيح الرسوم الكاملة دون بنود خفية، بينما تُوضّح المنشآت التي لم تفعّل حسابها بعد عدم توفر بيانات مباشرة منها حالياً.
            </p>
          </section>

          <section className="flex flex-col gap-2 text-text-muted font-body-default leading-relaxed">
            <h2 className="font-card-title text-dark-slate">3. عدم احتجاز أموال الاشتراكات (Non-Custodial)</h2>
            <p>
              لا تتقاضى كابتنلي عمولات من المدفوعات المباشرة بين الرياضيين والمنشآت، ويُستخدم أرشيف إيصالات إنستاباي وفودافون كاش ودفتر الحصص الـ QR للتوثيق المتبادل وحفظ الحقوق فقط.
            </p>
          </section>

          <div className="pt-4 border-t border-surface-container flex items-center justify-between flex-wrap gap-3">
            <Link href="/privacy" className="text-deep-olive font-badge-label hover:underline">
              سياسة الخصوصية والقانون 151/2020 ←
            </Link>
            <Link
              href="/claim"
              className="px-5 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs"
            >
              توثيق منشأة أو كابتن
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
