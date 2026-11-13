import {
  Coach,
  DemandRadarEntry,
  EditorialArticle,
  Facility,
  MemberRegistryEntry,
  MinorAthleteProfile,
  NotificationItem,
  PersonaAccount,
  PersonalBestRecord,
  SessionLedger,
  SkillEvaluation5Point,
  VerifiedLeadItem,
} from "@/types/captenly";

// 9 التخصصات الرسمية للسباحة (تخصصات دقيقة لا تسمح بدخول الكلمات الطبية المخالفة للقانون)
export const SWIMMING_SPECIALTIES_9 = [
  "تأسيس أطفال",
  "كسر حاجز الخوف",
  "إعداد سباحي بطولات",
  "تدريب فردي (VIP 1:1)",
  "سباحة للسيدات فقط",
  "إنقاذ مائي معتمد",
  "أكوا إيروبكس",
  "تدريب ذوي الهمم",
  "سباحة الكبار والمبتدئين",
];

// الكلمات الطبية المحظورة في السيرة الذاتية للمدربين غير الأطباء (قانون 3 لسنة 1985)
export const PROHIBITED_MEDICAL_KEYWORDS = [
  "علاج طبيعي",
  "طبيب",
  "دكتور عظام",
  "أخصائي علاج",
  "روشتة",
  "تشخيص طبي",
  "تأهيل إصابات طبية",
];

export const INITIAL_MEMBER_REGISTRY: MemberRegistryEntry[] = [
  {
    memberCode: "CAP-M-5190",
    athleteId: "persona-athlete-independent",
    fullNameAr: "كريم محمود الدسوقي",
    phone: "01022334455",
    city: "المحلة الكبرى",
    role: "adult_athlete",
    isMinor: false,
  },
  {
    memberCode: "CAP-M-4821",
    athleteId: "athlete-youssef",
    fullNameAr: "يوسف خالد المنشاوي",
    phone: "01001122334",
    city: "المحلة الكبرى",
    role: "parent",
    isMinor: true,
    parentNameAr: "مدام نهى المنشاوي",
  },
];

export const PERSONA_ACCOUNTS: PersonaAccount[] = [
  {
    id: "persona-athlete-independent",
    role: "adult_athlete",
    memberCode: "CAP-M-5190",
    hasParentSupervision: false,
    shortLabelAr: "حساب سباح مستقل (كريم)",
    fullNameAr: "كريم محمود الدسوقي",
    personaTitleAr: "سبّاح مستقل — كود العضوية CAP-M-5190",
    city: "المحلة الكبرى",
    phone: "01022334455",
    descriptionAr:
      "حساب سبّاح مستقل يدير باقاته وسجلاته بنفسه، وجاهز لتسليم كود العضوية لأي كابتن أو أكاديمية موثقة لتفعيل دفتر الحصص.",
  },
  {
    id: "persona-parent",
    role: "parent",
    memberCode: "CAP-M-4821",
    hasParentSupervision: true,
    shortLabelAr: "ولي أمر (نهى)",
    fullNameAr: "مدام نهى المنشاوي",
    personaTitleAr: "ولي أمر لمتابعة حصص السباحة للأطفال",
    city: "المحلة الكبرى",
    phone: "01001122334",
    descriptionAr:
      "حساب ولي أمر لمتابعة حصص السباحة للأطفال وتقييماتهم وإيصالات الاشتراك مع دعم دفتر الحصص الأوفلاين.",
  },
  {
    id: "persona-guest",
    role: "guest",
    memberCode: "CAP-M-GUEST",
    hasParentSupervision: false,
    shortLabelAr: "زائر (بدون تسجيل)",
    fullNameAr: "زائر كابتنلي",
    personaTitleAr: "تصفح مجاني بدون حساب",
    city: "المحلة الكبرى",
    phone: "",
    descriptionAr:
      "استكشاف المسابح القريبة ومجلة السباحة متاح بالكامل مجاناً بدون أي تسجيل مسبق.",
  },
  {
    id: "persona-facility",
    role: "facility_manager",
    memberCode: "CAP-F-3011",
    hasParentSupervision: false,
    shortLabelAr: "إدارة أكاديمية / مسبح",
    fullNameAr: "إدارة أكاديمية سباحة",
    personaTitleAr: "حساب إدارة مسبح أو أكاديمية سباحة",
    city: "المحلة الكبرى",
    phone: "01055667788",
    descriptionAr:
      "إدارة صفحة الأكاديمية أو المسبح، المطالبة بالملكية، إضافة برامج المدرسة المائية، وتسجيل السباحين بكود العضوية.",
  },
  {
    id: "persona-coach",
    role: "coach",
    memberCode: "CAP-C-9001",
    hasParentSupervision: false,
    shortLabelAr: "بوابة الكابتن والتوثيق",
    fullNameAr: "كابتن متقدم للاعتماد",
    personaTitleAr: "حساب كابتن — التوثيق والملف المهني",
    city: "المحلة الكبرى",
    phone: "01099887766",
    descriptionAr:
      "توثيق الشهادات لإصدار الشارات الخضراء، نشر عروض التدريب، ربط السباحين بكود العضوية، وتسجيل الحضور بالـ QR.",
  },
];

// سياسة صفر بيانات وهمية:
// لا تُزرع منشآت أو كباتن وهميون داخل الكود — تظهر المنشآت المسجلة فعلياً من Supabase + دليل خرائط Google Places الحيّ حسب موقع المستخدم.
export const INITIAL_COACHES: Coach[] = [];
export const INITIAL_FACILITIES: Facility[] = [];
export const INITIAL_MINOR_ATHLETES: MinorAthleteProfile[] = [];
export const INITIAL_PB_RECORDS: PersonalBestRecord[] = [];
export const INITIAL_SESSION_LEDGERS: SessionLedger[] = [];
export const INITIAL_VERIFIED_LEADS: VerifiedLeadItem[] = [];

export const INITIAL_SKILL_EVALUATION: SkillEvaluation5Point = {
  athleteId: "persona-athlete-independent",
  evaluatedDateAr: "بانتظار أول تقييم رسمي من الكابتن",
  coachNameAr: "لم يُسجل تقييم معتمد بعد",
  metrics: [
    { labelAr: "التنفس الجانبي", score: 0 },
    { labelAr: "ضربات الرجلين", score: 0 },
    { labelAr: "سحب الذراعين", score: 0 },
    { labelAr: "وضعية الجسم والطفو", score: 0 },
    { labelAr: "البدء والدوران", score: 0 },
  ],
  coachFeedbackAr:
    "عند ربط كود عضويتك بكابتن موثق أو أكاديمية سيظهر تقييم المهارات المائي المعتمد هنا تلقائياً.",
};

export const INITIAL_DEMAND_RADAR: DemandRadarEntry[] = [
  {
    city: "المحلة الكبرى",
    governorate: "الغربية",
    totalSearchesMonth: 412,
    topUnmetFilters: [
      {
        filterTitleAr: "مسبح شتوي مدفأ لتأسيس الأطفال",
        searchCount: 146,
        percentage: 35,
        opportunityNoteAr: "أعلى فجوة طلب في المحلة الكبرى لأولياء الأمور أعمار 5-9 سنوات",
      },
      {
        filterTitleAr: "حصص سباحة للسيدات بإشراف مدربات معتمدات",
        searchCount: 118,
        percentage: 29,
        opportunityNoteAr: "طلب متزايد على المواعيد المسائية المغطاة تماماً",
      },
      {
        filterTitleAr: "حوض تدريب شتوي دافئ لمجموعات الناشئين",
        searchCount: 74,
        percentage: 18,
        opportunityNoteAr: "فرصة لبرامج مدرسة السباحة في نطاق المحلة",
      },
    ],
  },
  {
    city: "طنطا",
    governorate: "الغربية",
    totalSearchesMonth: 328,
    topUnmetFilters: [
      {
        filterTitleAr: "مجموعات بحد أقصى 4 أطفال في الحارة (VIP)",
        searchCount: 114,
        percentage: 35,
        opportunityNoteAr: "بحث مرتفع في حي أول طنطا وطريق الاستاد",
      },
      {
        filterTitleAr: "مقارنة شاملة للرسوم النهائية بلا مصاريف إضافية",
        searchCount: 92,
        percentage: 28,
        opportunityNoteAr: "المستخدمون يفضلون المنشآت المعلنة لأسعار الكارنيه والتقييم بوضوح",
      },
    ],
  },
];

export const INITIAL_ARTICLES: EditorialArticle[] = [
  {
    id: "art-winter-safety",
    slug: "winter-swimming-pool-safety-guide",
    titleAr: "الدليل الكامل لأولياء الأمور: 7 معايير أساسية لاختيار مسبح شتوي آمن لطفلك",
    excerptAr:
      "قبل تسجيل طفلك في التدريب الشتوي، تحقق من درجة حرارة المياه (28-30°C)، التهوية، الكثافة العددية، وتواجد المنقذ المعتمد.",
    categoryAr: "الأمان والإنقاذ المائي",
    readingMinutes: 5,
    authorNameAr: "د. أحمد سامي",
    authorRoleAr: "استشاري التدريب الرياضي والإنقاذ المائي",
    publishedDateAr: "نوفمبر 2026",
    imageUrl: "/screens/c4a35b02a5ab.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## لماذا تفشل بعض اختيارات الشتاء للأهالي؟
مع دخول موسم البرد في مدن الدلتا ومصر، يظن كثير من أولياء الأمور أن مجرد وضع سقف بلاستيكي على المسبح كافٍ لحماية الطفل. الحقيقة الميدانية أن سلامة الطفل تعتمد على **توازن 3 عناصر معاً**: حرارة المياه الفعلية، كفاءة التهوية لمنع اختناق أبخرة الكلور، وقرب غرف التبديل الدافئة.

## العلامات السبع للأكاديمية الآمنة
1. **حرارة المياه المقاسة يومياً بين 28° و30° مئوية**: المياه الأقل من 26° تسبب إجهاداً حرارياً للطفل الصغير خلال 20 دقيقة.
2. **وجود تهوية ميكانيكية بالصالات المغطاة**: تجمع روائح الكلور فوق سطح الماء قد يهيج الجيوب الأنفية والحساسية.
3. **منقذ مائي مستقل غير الكابتن المدرس**: يجب أن تكون عين المنقذ على الحوض بالكامل لا على متدرب واحد.
4. **كثافة الحارة لا تتعدى 5–6 أطفال للمدرب الواحد**: العدد الزائد يضيع زمن التمرين الفعلي للطفل.
5. **غرف تبديل مغلقة بمياه دافئة ومجففات**.
6. **وضوح عمق حوض التأسيس (80سم – 110سم)**.
7. **شفافية التكلفة الكاملة من أول يوم** دون مفاجأة برسوم كارنيه أو أدوات إجبارية بعد الاشتراك.`,
  },
  {
    id: "art-coach-vs-fake",
    slug: "choosing-kids-swimming-coach-checklist",
    titleAr: "الفرق بين الشهادة المعتمدة والدورات الوهمية لمدربي السباحة في مصر (القانون 3 لسنة 1985)",
    excerptAr:
      "كيف تتحقق من اعتماد المدرب الرسمي من الاتحاد المصري للسباحة والغوص والإنقاذ ونقابة المهن الرياضية قبل تسليم ابنك؟",
    categoryAr: "سلسلة اختر صح",
    readingMinutes: 6,
    authorNameAr: "فريق التوثيق الميداني — كابتنلي",
    authorRoleAr: "مراجعة المعايير المهنية والأمنية",
    publishedDateAr: "أكتوبر 2026",
    imageUrl: "/screens/bf4051042977.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## لماذا نمنع أي مدرب غير موثق من الظهور؟
التدريب الرياضي للأطفال أمانة مهنية وتنظيمية يحكمها القانون المصري رقم 3 لسنة 1985 ولائحة نقابة المهن الرياضية. في كابتنلي لا ننشئ بروفايلات عشوائية؛ لا يظهر اسم أي كابتن مستقل إلا بعد مراجعة مستنداته الفعلية.

## ما الشهادات التي تحمي طفلك؟
- **بطاقة قيد نقابة المهن الرياضية أو شهادة الكلية المختصة**.
- **شهادة إنقاذ مائي سارية (EDLF)** مجددة بانتظام وليست ورقة منتهية الصلاحية.
- **فيش تشبيه موجه / تحقق هوية** لدى المنشأة المستضيفة.
- **الالتزام بحدود التخصص الرياضي**: فالمدرب الرياضي يطور الأداء المائي والسباحة وليس بديلاً عن طبيب العظام أو أخصائي العلاج الطبيعي في الحالات المرضية.`,
  },
  {
    id: "art-pre-swim-nutrition",
    slug: "pre-swim-nutrition-kids",
    titleAr: "ماذا يأكل طفلك قبل حصة السباحة بساعتين لتفادي الشد العضلي والغثيان؟",
    excerptAr:
      "وجبات مصرية خفيفة ومتوازنة تمد الطفل بالطاقة طوال الحصة دون إثقال المعدة أو هبوط السكر داخل الماء.",
    categoryAr: "تغذية السباحين",
    readingMinutes: 4,
    authorNameAr: "كابتن سارة النجار",
    authorRoleAr: "أخصائية تغذية رياضية للناشئين",
    publishedDateAr: "أكتوبر 2026",
    imageUrl: "/screens/ffcc3e56ffaa.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## القاعدة الذهبية: ساعتان قبل النزول للمياه
النزول مباشرة بعد وجبة دسمة يرفع احتمالية المغص والغثيان بسبب ضغط الماء على البطن وتغير توزيع الدم نحو العضلات.

## 3 خيارات جاهزة من البيت المصري
- **موزة متوسطة + 3 تمرات** قبل التمرين بـ 45 دقيقة للطاقة السريعة.
- **ساندويتش توست قمح كامل مع جبنة قريش وعسل** قبلها بساعتين.
- **زجاجة ماء دائمة على حافة المسبح**: يفقد الجسم سوائل داخل المسبح حتى دون الشعور بالعرق!`,
  },
  {
    id: "art-ladies-privacy",
    slug: "ladies-privacy-pools-guide",
    titleAr: "كيف تتأكدين من خصوصية المسابح ومواعيد سباحة السيدات الفعلية؟",
    excerptAr:
      "أبرز النقاط الواجب التأكد منها قبل الاشتراك في فصول سباحة السيدات: العزل الكامل، غياب الكاميرات داخل حوض السباحة، وتوفر مدربات معتمدات.",
    categoryAr: "سلسلة اختر صح",
    readingMinutes: 4,
    authorNameAr: "هيئة التحرير النسائية — كابتنلي",
    authorRoleAr: "مراجعة معايير الخصوصية والأمان",
    publishedDateAr: "أكتوبر 2026",
    imageUrl: "/screens/a62d511dce31.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## 4 أسئلة تسألينها قبل الدفع في أي باقة سباحة للسيدات
- هل حوض السباحة **معزول تماماً** عن أي ممرات خارجية أو أدوار علوية؟
- هل جميع المتواجدين أثناء الفترة النسائية (الإنقاذ، الإشراف، التدريب) **من السيدات فقط**؟
- هل غرف تبديل الملابس مقفلة ومؤمّنة دون زجاج مكشوف؟
- هل جدول الساعات المخصصة للسيدات ثابت ومضمون دون تغيير مفاجئ؟`,
  },
  {
    id: "art-overcome-fear",
    slug: "overcoming-child-fear-of-water",
    titleAr: "طفلي يبكي عند حافة المسبح! 5 خطوات تربوية لكسر رهبة الماء دون صدمة",
    excerptAr:
      "كيف يتعاون ولي الأمر مع مدرب السباحة في الأسابيع الثلاثة الأولى لبناء الثقة دون إجبار أو قسوة تدفع الطفل لكره الماء.",
    categoryAr: "دليل أولياء الأمور",
    readingMinutes: 5,
    authorNameAr: "كابتنلي لتطوير الناشئين",
    authorRoleAr: "علم نفس السباحة للطفل",
    publishedDateAr: "أكتوبر 2026",
    imageUrl: "/screens/f26e73948f8b.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## القاعدة الأولى: لا إلقاء مفاجئ في العميق
الأسلوب القديم الذي يرمي الطفل في الماء "ليتعلم غصباً عنه" يصنع عقدة تستمر سنوات.

## خطوات الكسر التدريجي
1. الجلوس على الدرج التفاعلي واللعب بالرذاذ لمدة 10 دقائق.
2. التمرين على نفخ الفقاعات بالوجه دون غمر الرأس قسراً.
3. ارتداء **نظارة سباحة مضبوطة المقاس** تمنع لدغة الكلور في العين.
4. جلوس ولي الأمر في مكان هادئ بعيداً عن توجيه أو توتير الطفل من المدرج.`,
  },
  {
    id: "art-qr-ledger-transparency",
    slug: "transparent-pricing-and-digital-ledger",
    titleAr: "نهاية «ضاعت عليّ حصة أو خلصت الباقة»: كيف يعمل دفتر الحصص الرقمي أوفلاين؟",
    excerptAr:
      "تعرّف على آلية ربط كود عضويتك مع الكابتن أو الأكاديمية لحفظ رصيد الحصص الـ 8 أو 12 بالبصمة الزمنية حتى بدون إنترنت بالمسبح.",
    categoryAr: "سلسلة اختر صح",
    readingMinutes: 3,
    authorNameAr: "فريق منتج كابتنلي",
    authorRoleAr: "دليل استخدام المنصة",
    publishedDateAr: "نوفمبر 2026",
    imageUrl: "/screens/7d7f304252a9.jpg",
    recommendedFacilitySlugs: [],
    recommendedCoachSlugs: [],
    contentMarkdownAr: `## لماذا كود العضوية (CAP-M-XXXX)؟
داخل صالات السباحة المغطاة تكون شبكة الموبايل والإنترنت ضعيفة غالباً. لهذا صممنا **دفتر الحصص الرقمي أوفلاين**:

1. بمجرد تسجيل حسابك في كابتنلي تحصل على **كود عضوية فريد** خاص بك.
2. عند اشتراكك مع كابتن أو أكاديمية موثقة، تعطيهم كود عضويتك.
3. يدخل الكابتن الكود في لوحة تحكمه مع عدد الحصص والمبلغ ويضغط حفظ.
4. فوراً يتفعّل **الباركود (QR)** والرصيد على حسابك، وتُسجّل كل حصة لحظياً بالمسح أو كود الـ 4 أرقام حتى لو انقطع الإنترنت مؤقتاً، لتتم المزامنة تلقائياً فور عودة الاتصال.`,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    titleAr: "كود عضويتك جاهز للتفعيل",
    messageAr:
      "شارك كود عضويتك مع الكابتن أو إدارة أكاديمية السباحة لتفعيل باقة الحصص والـ QR أوفلاين فوراً.",
    timeAr: "الآن",
    type: "school_card",
    actionLabelAr: "فتح دفتر الحصص",
    actionHref: "/dashboard/ledger",
    isRead: false,
  },
  {
    id: "notif-2",
    titleAr: "دليل الشتاء للمسابح الدافئة",
    messageAr:
      "نُشر دليل 7 معايير أساسية لاختيار مسبح شتوي آمن في مجلة كابتنلي.",
    timeAr: "منذ 3 ساعات",
    type: "editorial",
    actionLabelAr: "قراءة المقال",
    actionHref: "/magazine/winter-swimming-pool-safety-guide",
    isRead: false,
  },
];
