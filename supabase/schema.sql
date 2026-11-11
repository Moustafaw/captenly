-- =============================================================================
-- CAPTENLY (كابتنلي — captenly.com)
-- المخطط الكامل لقاعدة البيانات السحابية (Supabase PostgreSQL + PostGIS + RLS)
-- يضم الـ 22 جدولاً المعتمدين في دراسة الجدوى (الإصدار 4.0) مع سياسات الأمان
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- -----------------------------------------------------------------------------
-- المجموعة 1: حسابات المستخدمين والأطفال القُصّر (Identity & Minors - Law 151/2020)
-- -----------------------------------------------------------------------------

-- 1. جدول المستخدمين الأساسي (Users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('parent', 'adult_athlete', 'coach', 'facility_manager', 'super_admin')),
    city VARCHAR(80) NOT NULL DEFAULT 'المحلة الكبرى',
    governorate VARCHAR(80) NOT NULL DEFAULT 'الغربية',
    is_phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول ملفات أولياء الأمور والمتدربين البالغين (Parent_Profiles)
CREATE TABLE IF NOT EXISTS public.parent_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    district VARCHAR(100),
    preferred_sport VARCHAR(30) DEFAULT 'swimming',
    whatsapp_opt_in BOOLEAN DEFAULT TRUE,
    is_community_guide BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول الرياضيين الناشئين والقُصّر تحت 18 سنة (Minor_Athletes - Parent-Owned)
CREATE TABLE IF NOT EXISTS public.minor_athletes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    birth_year INT NOT NULL CHECK (birth_year >= 2008),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    primary_sport VARCHAR(30) NOT NULL CHECK (primary_sport IN ('swimming', 'fitness')),
    current_star_level INT DEFAULT 1 CHECK (current_star_level BETWEEN 1 AND 5),
    is_private_by_default BOOLEAN DEFAULT TRUE,
    active_coach_id UUID,
    active_facility_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول سجلات موافقة ولي الأمر القانونية (Consent_Logs - Law 151/2020 Art. 12)
CREATE TABLE IF NOT EXISTS public.consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    minor_athlete_id UUID NOT NULL REFERENCES public.minor_athletes(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('profile_creation', 'share_pride_card', 'coach_evaluation_access')),
    ip_address VARCHAR(64),
    consented_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- المجموعة 2: المنشآت والمدربون وحوكمة الربط الخماسية (Supply & Affiliations)
-- -----------------------------------------------------------------------------

-- 5. جدول المنشآت والأكاديميات وصالات الجيم (Facilities)
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(150) UNIQUE NOT NULL,
    name_ar VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    facility_type VARCHAR(40) NOT NULL CHECK (facility_type IN ('swimming_academy', 'club_pool', 'gym_fitness', 'multi_sport')),
    sport_sector VARCHAR(30) NOT NULL CHECK (sport_sector IN ('swimming', 'fitness', 'both')),
    governorate VARCHAR(80) NOT NULL DEFAULT 'الغربية',
    city VARCHAR(80) NOT NULL DEFAULT 'المحلة الكبرى',
    district VARCHAR(120) NOT NULL,
    address_detail TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    manager_user_id UUID REFERENCES public.users(id),
    whatsapp_number VARCHAR(20) NOT NULL,
    instapay_handle VARCHAR(120),
    vodafone_cash_number VARCHAR(20),
    supply_status VARCHAR(30) DEFAULT 'verified_active' CHECK (supply_status IN ('seeded_unclaimed', 'self_listed_pending', 'verified_active')),
    subscription_tier VARCHAR(30) DEFAULT 'free_founding' CHECK (subscription_tier IN ('free_founding', 'facility_pro', 'prepaid_leads')),
    is_sponsored BOOLEAN DEFAULT FALSE,
    price_last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    avg_reply_minutes INT DEFAULT 45,
    completeness_score INT DEFAULT 92,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول المواصفات الفنية لحمامات السباحة (Pools_Specs)
CREATE TABLE IF NOT EXISTS public.pools_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    pool_type VARCHAR(40) NOT NULL CHECK (pool_type IN ('olympic_50m', 'semi_olympic_25m', 'training_15m')),
    min_depth_m NUMERIC(3,1) NOT NULL,
    max_depth_m NUMERIC(3,1) NOT NULL,
    is_heated_winter BOOLEAN DEFAULT FALSE,
    is_covered_indoor BOOLEAN DEFAULT FALSE,
    max_swimmers_per_lane INT DEFAULT 6,
    has_ladies_only_slots BOOLEAN DEFAULT FALSE,
    has_edlf_lifeguard_on_duty BOOLEAN DEFAULT TRUE,
    specialties TEXT[] DEFAULT '{}'
);

-- 7. جدول المواصفات الفنية لصالات الجيم واللياقة (Gym_Specs)
CREATE TABLE IF NOT EXISTS public.gym_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    area_sqm INT,
    is_air_conditioned BOOLEAN DEFAULT TRUE,
    gender_policy VARCHAR(40) CHECK (gender_policy IN ('mixed_with_ladies_slots', 'ladies_only', 'men_only', 'separate_halls')),
    ladies_only_schedule TEXT,
    has_female_trainers BOOLEAN DEFAULT TRUE,
    equipment_highlights TEXT[],
    specialties TEXT[] DEFAULT '{}'
);

-- 8. جدول باقات الأسعار الشاملة ودورة الـ 60/120 يوماً (Facility_Price_Packages - MVP-03)
CREATE TABLE IF NOT EXISTS public.facility_price_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    package_name VARCHAR(150) NOT NULL,
    sessions_count INT NOT NULL,
    sessions_per_week INT DEFAULT 2,
    session_duration_min INT DEFAULT 60,
    base_monthly_price_egp NUMERIC(10,2) NOT NULL,
    assessment_fee_egp NUMERIC(10,2) DEFAULT 0,
    membership_card_fee_egp NUMERIC(10,2) DEFAULT 0,
    mandatory_kit_fee_egp NUMERIC(10,2) DEFAULT 0,
    companion_entry_fee_egp NUMERIC(10,2) DEFAULT 0,
    verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. جدول الكباتن والمدربين المستقلين (Coaches - Single Unique Coach ID - MVP-05)
CREATE TABLE IF NOT EXISTS public.coaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    slug VARCHAR(150) UNIQUE NOT NULL,
    full_name_ar VARCHAR(150) NOT NULL,
    title_ar VARCHAR(200) NOT NULL,
    national_id_hash VARCHAR(128) UNIQUE NOT NULL,
    sport_sector VARCHAR(30) NOT NULL CHECK (sport_sector IN ('swimming', 'fitness', 'both')),
    governorate VARCHAR(80) DEFAULT 'الغربية',
    city VARCHAR(80) DEFAULT 'المحلة الكبرى',
    bio_ar TEXT,
    years_experience INT DEFAULT 5,
    private_package_8_price_egp NUMERIC(10,2),
    private_package_12_price_egp NUMERIC(10,2),
    whatsapp_number VARCHAR(20) NOT NULL,
    instapay_handle VARCHAR(120),
    subscription_tier VARCHAR(30) DEFAULT 'free_founding' CHECK (subscription_tier IN ('free_founding', 'coach_pro')),
    commission_rate NUMERIC(4,2) DEFAULT 0.00 CHECK (commission_rate = 0.00),
    qr_code_token VARCHAR(64) UNIQUE NOT NULL,
    price_last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. جدول التخصصات ومستوى مصداقيتها للكابتن (Coach_Specialties)
CREATE TABLE IF NOT EXISTS public.coach_specialties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    specialty_code VARCHAR(60) NOT NULL,
    specialty_name_ar VARCHAR(120) NOT NULL,
    credibility_tier VARCHAR(30) NOT NULL CHECK (credibility_tier IN ('self_declared', 'reviewed_qualification', 'official_credential'))
);

-- 11. جدول الربط الثنائي المتبادل بين الكابتن والمنشأة (Facility_Coach_Affiliations)
CREATE TABLE IF NOT EXISTS public.facility_coach_affiliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    coach_approved BOOLEAN DEFAULT FALSE,
    facility_approved BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'active_mutual', 'gracefully_disaffiliated')),
    schedule_days TEXT NOT NULL,
    role_in_facility VARCHAR(120),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    UNIQUE(facility_id, coach_id)
);

-- -----------------------------------------------------------------------------
-- المجموعة 3: التوثيق والشارات الست المستقلة والمستندات السرية (Verification - MVP-06)
-- -----------------------------------------------------------------------------

-- 12. جدول الشارات الست المستقلة الممنوحة (Coach_Badges)
CREATE TABLE IF NOT EXISTS public.coach_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE,
    badge_code VARCHAR(40) NOT NULL CHECK (badge_code IN (
        'BADGE_01_IDENTITY',
        'BADGE_02_FACILITY',
        'BADGE_03_SPORTS_SCIENCE',
        'BADGE_04_ESF_FEDERATION',
        'BADGE_05_EDLF_LIFEGUARD',
        'BADGE_06_MEDICAL_PT'
    )),
    issuing_authority VARCHAR(150) NOT NULL,
    document_number VARCHAR(100),
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('pending_review', 'active', 'expired_auto_revoked', 'suspended_emergency'))
);

-- 13. جدول طلبات فحص المستندات السرية (Verification_Requests - SLA 24-48h)
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_user_id UUID NOT NULL REFERENCES public.users(id),
    target_coach_id UUID REFERENCES public.coaches(id),
    target_facility_id UUID REFERENCES public.facilities(id),
    badge_code VARCHAR(40) NOT NULL,
    private_storage_path TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    sla_deadline_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    reviewed_by_admin_id UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT
);

-- 14. جدول طلبات المطالبة بإدارة صفحات المنشآت المجهزة (Facility_Claims)
CREATE TABLE IF NOT EXISTS public.facility_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    claimant_name VARCHAR(150) NOT NULL,
    claimant_role VARCHAR(100) NOT NULL,
    official_phone VARCHAR(20) NOT NULL,
    commercial_reg_or_contract_path TEXT,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- المجموعة 4: دفتر الحصص الأوفلاين، إيصالات إنستاباي، وجواز السفر الرياضي (MVP-07..10)
-- -----------------------------------------------------------------------------

-- 15. جدول دفاتر الحصص المشتركة (Packages_Ledger - MVP-09)
CREATE TABLE IF NOT EXISTS public.packages_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_code VARCHAR(30) UNIQUE NOT NULL,
    parent_user_id UUID NOT NULL REFERENCES public.users(id),
    minor_athlete_id UUID REFERENCES public.minor_athletes(id),
    athlete_display_name VARCHAR(150) NOT NULL,
    coach_id UUID REFERENCES public.coaches(id),
    facility_id UUID REFERENCES public.facilities(id),
    package_title VARCHAR(150) NOT NULL,
    total_sessions INT NOT NULL CHECK (total_sessions IN (8, 12, 24)),
    completed_sessions INT DEFAULT 0,
    pin_code VARCHAR(4) NOT NULL,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'renewal_due', 'completed', 'archived')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 16. جدول أختام حضور الحصص بالتوقيت غير القابل للتلاعب (Session_Checkins - MVP-09)
CREATE TABLE IF NOT EXISTS public.session_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES public.packages_ledger(id) ON DELETE CASCADE,
    session_number INT NOT NULL,
    verification_method VARCHAR(20) NOT NULL CHECK (verification_method IN ('pin_4digit', 'qr_scan', 'offline_sync')),
    checked_in_by_role VARCHAR(30) NOT NULL,
    was_offline_cached BOOLEAN DEFAULT FALSE,
    coach_note TEXT,
    immutable_checked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ledger_id, session_number)
);

-- 17. جدول أرشيف إيصالات إنستاباي وفودافون كاش غير الحفظي (InstaPay_Proofs - MVP-10)
CREATE TABLE IF NOT EXISTS public.instapay_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES public.packages_ledger(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id),
    payment_channel VARCHAR(30) NOT NULL CHECK (payment_channel IN ('instapay', 'vodafone_cash', 'direct_receipt')),
    reference_number VARCHAR(80) NOT NULL,
    amount_egp NUMERIC(10,2) NOT NULL,
    receipt_webp_path TEXT,
    confirmed_by_provider BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. جدول الأرقام القياسية الشخصية للسباحة والجيم (PB_Records - MVP-07)
CREATE TABLE IF NOT EXISTS public.pb_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    minor_athlete_id UUID REFERENCES public.minor_athletes(id) ON DELETE CASCADE,
    adult_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sport_type VARCHAR(20) NOT NULL CHECK (sport_type IN ('swimming', 'fitness')),
    event_or_exercise VARCHAR(100) NOT NULL,
    metric_value NUMERIC(8,2) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL CHECK (metric_unit IN ('seconds', 'kg', 'reps', 'star_level')),
    previous_best NUMERIC(8,2),
    verification_source VARCHAR(30) NOT NULL CHECK (verification_source IN ('self_entered', 'coach_reviewed', 'document_verified', 'official_esf_result')),
    verified_by_coach_id UUID REFERENCES public.coaches(id),
    facility_id UUID REFERENCES public.facilities(id),
    recorded_at DATE DEFAULT CURRENT_DATE
);

-- 19. جدول التقييم الفني الخماسي للاعبين (Skill_Evaluations - MVP-07)
CREATE TABLE IF NOT EXISTS public.skill_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    minor_athlete_id UUID REFERENCES public.minor_athletes(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.coaches(id),
    breath_control_score INT CHECK (breath_control_score BETWEEN 1 AND 5),
    body_position_score INT CHECK (body_position_score BETWEEN 1 AND 5),
    stroke_technique_score INT CHECK (stroke_technique_score BETWEEN 1 AND 5),
    starts_turns_score INT CHECK (starts_turns_score BETWEEN 1 AND 5),
    endurance_commitment_score INT CHECK (endurance_commitment_score BETWEEN 1 AND 5),
    coach_feedback TEXT,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- المجموعة 5: الليدات المهيكلة، رادار الطلب، والرقابة (Leads, Radar & Audit - MVP-11..12)
-- -----------------------------------------------------------------------------

-- 20. جدول الإحالات والليدات الموثقة وعدم التكرار لـ 30 يوماً (Verified_Leads - MVP-11)
CREATE TABLE IF NOT EXISTS public.verified_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_code VARCHAR(25) UNIQUE NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('facility', 'coach')),
    facility_id UUID REFERENCES public.facilities(id),
    coach_id UUID REFERENCES public.coaches(id),
    inquirer_name VARCHAR(120),
    inquirer_phone VARCHAR(20) NOT NULL,
    athlete_age INT,
    requested_specialty VARCHAR(120) NOT NULL,
    preferred_schedule VARCHAR(120),
    channel VARCHAR(30) DEFAULT 'whatsapp_structured' CHECK (channel IN ('whatsapp_structured', 'assessment_form', 'deposit_booking')),
    is_unique_30d BOOLEAN DEFAULT TRUE,
    provider_replied_within_2h BOOLEAN DEFAULT TRUE,
    converted_to_ledger_id UUID REFERENCES public.packages_ledger(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. جدول سجلات رادار الطلب المحلي مجهول الهوية (Search_Radar_Logs - MVP-12)
CREATE TABLE IF NOT EXISTS public.search_radar_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    governorate VARCHAR(80) NOT NULL,
    city VARCHAR(80) NOT NULL,
    district VARCHAR(100),
    sport_sector VARCHAR(30) NOT NULL,
    requested_filter VARCHAR(100) NOT NULL,
    was_zero_result BOOLEAN DEFAULT FALSE,
    waitlist_phone VARCHAR(20),
    searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. جدول البلاغات الطارئة وسجل الرقابة (Abuse_Reports & Audit_Logs - 12h Emergency SLA)
CREATE TABLE IF NOT EXISTS public.abuse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_phone VARCHAR(20),
    target_facility_id UUID REFERENCES public.facilities(id),
    target_coach_id UUID REFERENCES public.coaches(id),
    report_category VARCHAR(50) NOT NULL CHECK (report_category IN (
        'child_safety_lifeguard',
        'medical_impersonation_law_3_1985',
        'price_mismatch_hidden_fees',
        'fake_credential'
    )),
    severity VARCHAR(20) DEFAULT 'high' CHECK (severity IN ('normal_48h', 'emergency_12h')),
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_action_taken')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- تفعيل سياسات عزل الخصوصية (PostgreSQL Row-Level Security - RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.minor_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instapay_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- سياسة حماية بيانات الطفل القاصر (لا يراها إلا ولي أمره الشرعي أو الكابتن المرتبط به حالياً)
CREATE POLICY minor_athletes_parent_or_coach_policy ON public.minor_athletes
    FOR SELECT
    USING (
        auth.uid() = parent_user_id
        OR auth.uid() IN (SELECT user_id FROM public.coaches WHERE id = active_coach_id)
    );
