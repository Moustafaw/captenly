import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[1120px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 md:p-12 shadow-lg flex flex-col gap-4">
          <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label w-fit">
            عن منصة كابتنلي • مصر
          </span>
          <h1 className="font-hero-headline text-[30px] md:text-[36px] leading-tight">
            نحو رياضة مصرية آمنة، شفافة الأسعار، وموثقة بالشهادات الميدانية
          </h1>
          <p className="font-body-default text-surface-container-high max-w-3xl">
            وُلدت كابتنلي لحل ثلاث فجوات حقيقية يواجهها الرياضيون وأولياء الأمور في المحلة الكبرى والغربية ومصر: غياب شفافية الأسعار الكاملة، صعوبة التأكد من اعتماد الكباتن وسلامة المسابح شتاءً، وضياع متابعة الحصص بالدفاتر الورقية.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
          <div className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-2">
            <div className="w-11 h-11 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
              <Icon name="verified" className="text-[22px]" />
            </div>
            <h2 className="font-card-title text-dark-slate">سياسة التوثيق الصادق</h2>
            <p className="font-body-compact text-text-muted">
              لا نختلق بروفايلات كباتن وهميين؛ لا يظهر كابتن مستقل إلا بعد تسجيله بنفسه وتوثيق شهاداته للشارات الخضراء. والمنشآت المدرجة تُوسَم بوضوح إذا لم يُطالب بها أصحابها بعد.
            </p>
          </div>

          <div className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-2">
            <div className="w-11 h-11 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
              <Icon name="qr_code_2" className="text-[22px]" />
            </div>
            <h2 className="font-card-title text-dark-slate">دفتر حصص أوفلاين بالـ QR</h2>
            <p className="font-body-compact text-text-muted">
              كل مستخدم يحصل على كود عضوية فريد، وبمجرد تفعيل الكابتن لباقته يعمل كود الـ QR وحفظ الحصص محلياً على حافة المسبح حتى عند انقطاع الإنترنت.
            </p>
          </div>

          <div className="bg-surface-card rounded-[16px] p-6 shadow-sm flex flex-col gap-2">
            <div className="w-11 h-11 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
              <Icon name="payments" className="text-[22px]" />
            </div>
            <h2 className="font-card-title text-dark-slate">0% عمولة على الكباتن والأندية</h2>
            <p className="font-body-compact text-text-muted">
              اشتراكات المتدربين تذهب مباشرة إلى الكابتن أو الأكاديمية دون اقتطاع نسب سمسرة أو مصاريف مخفية.
            </p>
          </div>
        </section>

        <section className="rounded-[20px] bg-surface-card p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-card-title text-dark-slate">ابدأ الاستكشاف أو وثّق صفحتك الآن</h3>
            <p className="font-body-compact text-text-muted mt-1">
              قارن المنشآت القريبة منك أو طالب بصفحة ناديك مجاناً خلال دقائق.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-surface-snow text-dark-slate font-badge-label"
            >
              استكشف المنشآت
            </Link>
            <Link
              href="/claim"
              className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label"
            >
              طالب بصفحتك مجاناً
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
