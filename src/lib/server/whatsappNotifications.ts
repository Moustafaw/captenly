import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";

export type WhatsAppEventType =
  | "attendance_checkin"
  | "absence_alert"
  | "session_reminder"
  | "subscription_expiring"
  | "subscription_renewal"
  | "receipt_confirmed"
  | "test_message";

export type WhatsAppDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped_opt_out"
  | "skipped_no_phone"
  | "provider_unconfigured";

export interface WhatsAppDispatchRecord {
  id?: string;
  dedupeKey: string;
  eventType: WhatsAppEventType;
  recipientMemberCode: string;
  recipientPhoneMasked?: string | null;
  facilityId?: string | null;
  ledgerId?: string | null;
  templateName?: string | null;
  messagePreviewAr: string;
  provider: string;
  providerMessageId?: string | null;
  deliveryStatus: WhatsAppDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorDetail?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DispatchWhatsAppInput {
  eventType: WhatsAppEventType;
  recipientMemberCode: string;
  explicitPhone?: string | null;
  facilityId?: string | null;
  ledgerId?: string | null;
  athleteNameAr?: string;
  facilityNameAr?: string;
  completedSessions?: number;
  totalSessions?: number;
  remainingSessions?: number;
  amountEgp?: number;
  dateKey?: string;
  dedupeScope?: string;
  skipPreferenceCheck?: boolean;
  skipInApp?: boolean;
  actionHref?: string;
}

export interface DispatchWhatsAppDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  overridePhone?: string | null;
  overrideSettings?: Record<string, unknown> | null;
  inMemoryDedupe?: Set<string>;
}

const MAX_DEFAULT_ATTEMPTS = 3;

export function normalizeWhatsAppPhone(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  // Egypt mobile patterns: 010/011/012/015 (11 digits) -> 201...
  if (digits.length === 11 && digits.startsWith("01")) {
    digits = `2${digits}`;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = `20${digits}`;
  }
  // International E.164 digit length bounds (10 to 15 digits)
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function maskPhoneLast4(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

export function getCairoDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

export function buildWhatsAppDedupeKey(params: {
  eventType: WhatsAppEventType;
  recipientMemberCode: string;
  ledgerId?: string | null;
  dateKey?: string;
  dedupeScope?: string;
}): string {
  const datePart = params.dateKey || getCairoDateString();
  const scopePart = params.dedupeScope || params.ledgerId || "global";
  const memberPart = params.recipientMemberCode.trim().toUpperCase() || "UNKNOWN";
  return `${params.eventType}:${memberPart}:${scopePart}:${datePart}`;
}

export function isWhatsAppConfigured(): boolean {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  return Boolean(token && phoneId);
}

export function getWhatsAppProviderStatus() {
  const configured = isWhatsAppConfigured();
  const rawMode = (process.env.WHATSAPP_MODE || "test_sandbox").trim().toLowerCase();
  const mode =
    rawMode === "template" || rawMode === "text" || rawMode === "test_sandbox"
      ? rawMode
      : "test_sandbox";
  const templateLang = (process.env.WHATSAPP_TEMPLATE_LANG || "ar").trim() || "ar";
  return {
    configured,
    provider: "meta_whatsapp_cloud" as const,
    mode,
    templateLang,
    webhookConfigured: Boolean((process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()),
    cronConfigured: Boolean((process.env.CRON_SECRET || "").trim()),
    freeTierNoteAr: configured
      ? mode === "test_sandbox"
        ? "متصل برقم اختبار مطوري Meta WhatsApp Cloud API المجاني (لأرقام الاختبار المعتمدة فقط حتى إتمام توثيق النشاط التجاري)."
        : "متصل بواجهة Meta WhatsApp Business Cloud API الرسمية."
      : "محرك إشعارات واتساب وسجلات الإرسال مفعّل على الخادم؛ بانتظار ضبط مفاتيح Meta WhatsApp Cloud API للإرسال الخارجي الفعلي.",
  };
}

export function buildArabicMessageForEvent(
  eventType: WhatsAppEventType,
  params: Pick<
    DispatchWhatsAppInput,
    | "athleteNameAr"
    | "facilityNameAr"
    | "completedSessions"
    | "totalSessions"
    | "remainingSessions"
    | "amountEgp"
  >
): {
  titleAr: string;
  bodyAr: string;
  templateName: string;
  templateParams: string[];
  preferenceKey: "notifyWhatsappSessions" | "notifyWhatsappRenewals" | null;
} {
  const athlete = (params.athleteNameAr || "السبّاح").trim();
  const facility = (params.facilityNameAr || "كابتنلي").trim();
  const completed = Number(params.completedSessions ?? 0);
  const total = Number(params.totalSessions ?? 0);
  const remaining =
    params.remainingSessions !== undefined
      ? Math.max(0, Number(params.remainingSessions))
      : Math.max(0, total - completed);

  switch (eventType) {
    case "attendance_checkin":
      return {
        titleAr: `تأكيد حضور حصة (${facility})`,
        bodyAr: `كابتنلي: تم تسجيل حضور السبّاح ${athlete} في ${facility} (حصة ${completed}/${total} — المتبقي ${remaining}).`,
        templateName: process.env.WHATSAPP_TEMPLATE_ATTENDANCE || "captenly_attendance_ar",
        templateParams: [athlete, facility, `${completed}/${total}`, String(remaining)],
        preferenceKey: "notifyWhatsappSessions",
      };
    case "absence_alert":
      return {
        titleAr: `تذكير حضور حصة اليوم (${facility})`,
        bodyAr: `كابتنلي: تذكير من ${facility} — لم يُسجّل حضور ${athlete} لحصة اليوم حتى الآن. الرصيد المتبقي: ${remaining} من ${total}.`,
        templateName: process.env.WHATSAPP_TEMPLATE_ABSENCE || "captenly_absence_reminder_ar",
        templateParams: [athlete, facility, String(remaining), String(total)],
        preferenceKey: "notifyWhatsappSessions",
      };
    case "session_reminder":
      return {
        titleAr: `تذكير بموعد الحصة القادمة (${facility})`,
        bodyAr: `كابتنلي: تذكير بحصة السباحة لـ ${athlete} في ${facility}. يرجى تجهيز كود الـ QR أو الـ PIN. المتبقي بالباقة: ${remaining} حصة.`,
        templateName: process.env.WHATSAPP_TEMPLATE_REMINDER || "captenly_session_reminder_ar",
        templateParams: [athlete, facility, String(remaining)],
        preferenceKey: "notifyWhatsappSessions",
      };
    case "subscription_expiring":
      return {
        titleAr: `تنبيه قرب انتهاء الباقة (${facility})`,
        bodyAr: `كابتنلي: تنبيه — تبقّى ${remaining} ${remaining === 1 ? "حصة" : "حصص"} فقط في اشتراك ${athlete} لدى ${facility} (${completed}/${total}).`,
        templateName: process.env.WHATSAPP_TEMPLATE_EXPIRING || "captenly_subscription_expiring_ar",
        templateParams: [athlete, facility, String(remaining)],
        preferenceKey: "notifyWhatsappRenewals",
      };
    case "subscription_renewal":
      return {
        titleAr: `تم تجديد الباقة (${facility})`,
        bodyAr: `كابتنلي: تم تجديد باقة السبّاح ${athlete} في ${facility} بنجاح (${total} حصص جديدة).`,
        templateName: process.env.WHATSAPP_TEMPLATE_RENEWAL || "captenly_subscription_renewal_ar",
        templateParams: [athlete, facility, String(total)],
        preferenceKey: "notifyWhatsappRenewals",
      };
    case "receipt_confirmed":
      return {
        titleAr: `تأكيد إيصال الدفع (${facility})`,
        bodyAr: `كابتنلي: تم تأكيد إيصال الدفع بمبلغ ${Number(params.amountEgp || 0)} ج.م لاشتراك ${athlete} في ${facility}.`,
        templateName: process.env.WHATSAPP_TEMPLATE_RECEIPT || "captenly_receipt_confirmed_ar",
        templateParams: [athlete, facility, String(params.amountEgp || 0)],
        preferenceKey: "notifyWhatsappRenewals",
      };
    case "test_message":
    default:
      return {
        titleAr: "رسالة اختبار إشعارات كابتنلي",
        bodyAr: `كابتنلي: تم ربط قنوات تنبيهات واتساب لحسابك (${athlete}) بنجاح ✓`,
        templateName: process.env.WHATSAPP_TEMPLATE_TEST || "hello_world",
        templateParams: [athlete],
        preferenceKey: null,
      };
  }
}

async function resolveRecipientPhoneAndSettings(
  memberCode: string,
  explicitPhone?: string | null,
  deps?: DispatchWhatsAppDeps
): Promise<{
  phoneE164: string | null;
  userSettings: Record<string, unknown>;
}> {
  const code = memberCode.trim().toUpperCase();
  if (deps?.overridePhone !== undefined || deps?.overrideSettings !== undefined) {
    return {
      phoneE164: normalizeWhatsAppPhone(deps?.overridePhone ?? explicitPhone),
      userSettings: deps?.overrideSettings || {},
    };
  }

  let dbPhone: string | null = explicitPhone || null;
  let userSettings: Record<string, unknown> = {};
  const admin = getSupabaseAdminClient();

  if (admin) {
    try {
      const [{ data: prefRow }, { data: profileRow }] = await Promise.all([
        admin
          .from("captenly_user_prefs")
          .select("user_settings")
          .ilike("member_code", code)
          .maybeSingle(),
        admin
          .from("captenly_profiles")
          .select("phone")
          .ilike("member_code", code)
          .maybeSingle(),
      ]);
      if (prefRow?.user_settings && typeof prefRow.user_settings === "object") {
        userSettings = prefRow.user_settings as Record<string, unknown>;
      }
      if (!dbPhone && profileRow?.phone) {
        dbPhone = String(profileRow.phone);
      }
    } catch {
      // fall through to PG
    }
  } else {
    const pgRes = await withPgClient(async (client) => {
      const [prefQ, profQ] = await Promise.all([
        client.query(
          `select user_settings from public.captenly_user_prefs where upper(member_code) = upper($1) limit 1`,
          [code]
        ),
        client.query(
          `select phone from public.captenly_profiles where upper(member_code) = upper($1) limit 1`,
          [code]
        ),
      ]);
      return {
        settings: (prefQ.rows[0]?.user_settings || {}) as Record<string, unknown>,
        phone: prefQ.rows[0] || profQ.rows[0] ? (profQ.rows[0]?.phone as string | undefined) : undefined,
      };
    });
    if (pgRes.ok) {
      userSettings = pgRes.value.settings;
      if (!dbPhone && pgRes.value.phone) dbPhone = pgRes.value.phone;
    }
  }

  return {
    phoneE164: normalizeWhatsAppPhone(dbPhone),
    userSettings,
  };
}

async function findExistingDispatchByDedupe(dedupeKey: string): Promise<Record<string, unknown> | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_whatsapp_dispatches")
        .select("*")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (!error) return (data as Record<string, unknown>) || null;
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select * from public.captenly_whatsapp_dispatches where dedupe_key = $1 limit 1`,
      [dedupeKey]
    );
    return (rows[0] as Record<string, unknown>) || null;
  });
  return pg.ok ? pg.value : null;
}

async function persistDispatchRecord(row: {
  dedupe_key: string;
  event_type: string;
  recipient_member_code: string;
  recipient_phone_e164: string | null;
  facility_id: string | null;
  ledger_id: string | null;
  template_name: string | null;
  message_preview_ar: string;
  provider: string;
  provider_message_id: string | null;
  delivery_status: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error_code: string | null;
  last_error_detail: string | null;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; row?: Record<string, unknown> }> {
  const nowIso = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_whatsapp_dispatches")
        .upsert({ ...row, updated_at: nowIso }, { onConflict: "dedupe_key" })
        .select("*")
        .maybeSingle();
      if (!error) {
        return { ok: true, row: (data as Record<string, unknown>) || undefined };
      }
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `insert into public.captenly_whatsapp_dispatches
        (dedupe_key, event_type, recipient_member_code, recipient_phone_e164, facility_id, ledger_id,
         template_name, message_preview_ar, provider, provider_message_id, delivery_status,
         attempt_count, max_attempts, next_retry_at, last_error_code, last_error_detail, payload, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,now())
       on conflict (dedupe_key) do update set
         recipient_phone_e164 = excluded.recipient_phone_e164,
         provider_message_id = coalesce(excluded.provider_message_id, public.captenly_whatsapp_dispatches.provider_message_id),
         delivery_status = excluded.delivery_status,
         attempt_count = excluded.attempt_count,
         next_retry_at = excluded.next_retry_at,
         last_error_code = excluded.last_error_code,
         last_error_detail = excluded.last_error_detail,
         payload = excluded.payload,
         updated_at = now()
       returning *`,
      [
        row.dedupe_key,
        row.event_type,
        row.recipient_member_code,
        row.recipient_phone_e164,
        row.facility_id,
        row.ledger_id,
        row.template_name,
        row.message_preview_ar,
        row.provider,
        row.provider_message_id,
        row.delivery_status,
        row.attempt_count,
        row.max_attempts,
        row.next_retry_at,
        row.last_error_code,
        row.last_error_detail,
        JSON.stringify(row.payload || {}),
      ]
    );
    return (rows[0] as Record<string, unknown>) || null;
  });
  return { ok: pg.ok, row: pg.ok ? pg.value || undefined : undefined };
}

async function persistInAppNotificationBestEffort(params: {
  memberCode: string;
  titleAr: string;
  messageAr: string;
  eventType: WhatsAppEventType;
  actionHref?: string;
}) {
  if (!params.memberCode) return;
  const notifType =
    params.eventType === "subscription_expiring" || params.eventType === "subscription_renewal"
      ? "renewal_due"
      : "checkin";
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      await admin.from("captenly_notifications").insert({
        member_code: params.memberCode,
        title_ar: params.titleAr,
        message_ar: params.messageAr,
        notif_type: notifType,
        action_label_ar: params.actionHref ? "عرض التفاصيل" : null,
        action_href: params.actionHref || "/dashboard/athlete/settings/notifications",
        is_read: false,
      });
      return;
    } catch {
      // fall through
    }
  }
  await withPgClient(async (client) => {
    await client.query(
      `insert into public.captenly_notifications
        (member_code, title_ar, message_ar, notif_type, action_label_ar, action_href, is_read)
       values ($1,$2,$3,$4,$5,$6,false)`,
      [
        params.memberCode,
        params.titleAr,
        params.messageAr,
        notifType,
        params.actionHref ? "عرض التفاصيل" : null,
        params.actionHref || "/dashboard/athlete/settings/notifications",
      ]
    );
    return true;
  });
}

async function sendViaMetaCloudApi(params: {
  phoneE164: string;
  bodyAr: string;
  templateName: string;
  templateParams: string[];
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<{
  ok: boolean;
  providerMessageId?: string | null;
  errorCode?: string;
  errorDetail?: string;
}> {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const mode = (process.env.WHATSAPP_MODE || "test_sandbox").trim().toLowerCase();
  const templateLang = (process.env.WHATSAPP_TEMPLATE_LANG || "ar").trim() || "ar";

  if (!token || !phoneNumberId) {
    return { ok: false, errorCode: "provider_unconfigured", errorDetail: "Missing Meta credentials" };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;
  let graphPayload: Record<string, unknown>;

  if (mode === "text") {
    graphPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phoneE164,
      type: "text",
      text: { preview_url: false, body: params.bodyAr },
    };
  } else if (mode === "template") {
    graphPayload = {
      messaging_product: "whatsapp",
      to: params.phoneE164,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: templateLang },
        ...(params.templateParams.length > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters: params.templateParams.map((text) => ({ type: "text", text })),
                },
              ],
            }
          : {}),
      },
    };
  } else {
    // test_sandbox defaults to Meta's built-in approved template ("hello_world") unless text mode is opted in
    graphPayload = {
      messaging_product: "whatsapp",
      to: params.phoneE164,
      type: "template",
      template: {
        name: process.env.WHATSAPP_SANDBOX_TEMPLATE || "hello_world",
        language: { code: process.env.WHATSAPP_SANDBOX_TEMPLATE_LANG || "en_US" },
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await params.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphPayload),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string; error_subcode?: number };
    } | null;

    if (res.ok && json?.messages?.[0]?.id) {
      return { ok: true, providerMessageId: json.messages[0].id };
    }
    return {
      ok: false,
      errorCode: String(json?.error?.code || res.status || "meta_api_error"),
      errorDetail: (json?.error?.message || `HTTP ${res.status}`).slice(0, 240),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network_timeout";
    return {
      ok: false,
      errorCode: "network_or_timeout",
      errorDetail: msg.slice(0, 240),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function mapDispatchRow(row: Record<string, unknown>): WhatsAppDispatchRecord {
  return {
    id: row.id ? String(row.id) : undefined,
    dedupeKey: String(row.dedupe_key || ""),
    eventType: String(row.event_type || "test_message") as WhatsAppEventType,
    recipientMemberCode: String(row.recipient_member_code || ""),
    recipientPhoneMasked: maskPhoneLast4(row.recipient_phone_e164 ? String(row.recipient_phone_e164) : null),
    facilityId: row.facility_id ? String(row.facility_id) : null,
    ledgerId: row.ledger_id ? String(row.ledger_id) : null,
    templateName: row.template_name ? String(row.template_name) : null,
    messagePreviewAr: String(row.message_preview_ar || ""),
    provider: String(row.provider || "meta_whatsapp_cloud"),
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    deliveryStatus: String(row.delivery_status || "queued") as WhatsAppDeliveryStatus,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || MAX_DEFAULT_ATTEMPTS),
    nextRetryAt: row.next_retry_at ? String(row.next_retry_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    lastErrorDetail: row.last_error_detail ? String(row.last_error_detail) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function dispatchWhatsAppNotification(
  input: DispatchWhatsAppInput,
  deps?: DispatchWhatsAppDeps
): Promise<{
  ok: boolean;
  deduplicated: boolean;
  deliveryStatus: WhatsAppDeliveryStatus;
  providerMessageId?: string | null;
  dedupeKey: string;
  persisted: boolean;
  messageAr: string;
}> {
  const recipientMemberCode = (input.recipientMemberCode || "").trim().toUpperCase();
  const dedupeKey = buildWhatsAppDedupeKey({
    eventType: input.eventType,
    recipientMemberCode,
    ledgerId: input.ledgerId,
    dateKey: input.dateKey,
    dedupeScope: input.dedupeScope,
  });

  if (deps?.inMemoryDedupe?.has(dedupeKey)) {
    return {
      ok: true,
      deduplicated: true,
      deliveryStatus: "sent",
      dedupeKey,
      persisted: false,
      messageAr: "تم منع تكرار نفس الإشعار في نفس النطاق الزمني.",
    };
  }

  const existing = await findExistingDispatchByDedupe(dedupeKey);
  if (
    existing &&
    ["sent", "delivered", "read", "skipped_opt_out"].includes(String(existing.delivery_status || ""))
  ) {
    return {
      ok: true,
      deduplicated: true,
      deliveryStatus: String(existing.delivery_status) as WhatsAppDeliveryStatus,
      providerMessageId: existing.provider_message_id ? String(existing.provider_message_id) : null,
      dedupeKey,
      persisted: true,
      messageAr: "تم تسجيل هذا الإشعار مسبقاً ومنع التكرار.",
    };
  }

  const msgSpec = buildArabicMessageForEvent(input.eventType, input);
  const { phoneE164, userSettings } = await resolveRecipientPhoneAndSettings(
    recipientMemberCode,
    input.explicitPhone,
    deps
  );

  if (!input.skipInApp && recipientMemberCode && !existing) {
    await persistInAppNotificationBestEffort({
      memberCode: recipientMemberCode,
      titleAr: msgSpec.titleAr,
      messageAr: msgSpec.bodyAr,
      eventType: input.eventType,
      actionHref: input.actionHref,
    });
  }

  const optOut =
    !input.skipPreferenceCheck &&
    msgSpec.preferenceKey !== null &&
    userSettings[msgSpec.preferenceKey] === false;

  let deliveryStatus: WhatsAppDeliveryStatus;
  let providerMessageId: string | null = null;
  let lastErrorCode: string | null = null;
  let lastErrorDetail: string | null = null;
  let attemptCount = Number(existing?.attempt_count || 0);
  let nextRetryAt: string | null = null;

  if (optOut) {
    deliveryStatus = "skipped_opt_out";
  } else if (!phoneE164) {
    deliveryStatus = "skipped_no_phone";
    lastErrorCode = "missing_phone";
  } else if (!isWhatsAppConfigured()) {
    deliveryStatus = "provider_unconfigured";
    lastErrorCode = "meta_credentials_missing";
  } else {
    attemptCount += 1;
    const sendRes = await sendViaMetaCloudApi({
      phoneE164,
      bodyAr: msgSpec.bodyAr,
      templateName: msgSpec.templateName,
      templateParams: msgSpec.templateParams,
      fetchImpl: deps?.fetchImpl || fetch,
      timeoutMs: deps?.timeoutMs ?? 8000,
    });
    if (sendRes.ok) {
      deliveryStatus = "sent";
      providerMessageId = sendRes.providerMessageId || null;
      deps?.inMemoryDedupe?.add(dedupeKey);
    } else {
      deliveryStatus = "failed";
      lastErrorCode = sendRes.errorCode || "send_failed";
      lastErrorDetail = sendRes.errorDetail || null;
      if (attemptCount < MAX_DEFAULT_ATTEMPTS) {
        nextRetryAt = new Date(Date.now() + attemptCount * 15 * 60 * 1000).toISOString();
      }
    }
  }

  const saved = await persistDispatchRecord({
    dedupe_key: dedupeKey,
    event_type: input.eventType,
    recipient_member_code: recipientMemberCode || "UNKNOWN",
    recipient_phone_e164: phoneE164,
    facility_id: input.facilityId || null,
    ledger_id: input.ledgerId || null,
    template_name: msgSpec.templateName,
    message_preview_ar: msgSpec.bodyAr,
    provider: "meta_whatsapp_cloud",
    provider_message_id: providerMessageId,
    delivery_status: deliveryStatus,
    attempt_count: attemptCount,
    max_attempts: MAX_DEFAULT_ATTEMPTS,
    next_retry_at: nextRetryAt,
    last_error_code: lastErrorCode,
    last_error_detail: lastErrorDetail,
    payload: {
      athleteNameAr: input.athleteNameAr,
      facilityNameAr: input.facilityNameAr,
      remainingSessions: input.remainingSessions,
    },
  });

  const messageByStatus: Record<WhatsAppDeliveryStatus, string> = {
    sent: "تم إرسال إشعار واتساب عبر الخادم بنجاح ✓",
    delivered: "تم تسليم رسالة واتساب بنجاح ✓",
    read: "تمت قراءة رسالة واتساب ✓",
    queued: "الإشعار قيد الانتظار في الطابور.",
    failed: `تعذّر الإرسال الخارجي حالياً (${lastErrorCode || "error"}) — تمت جدولة إعادة المحاولة تلقائياً.`,
    skipped_opt_out: "تم تخطي إرسال واتساب احتراماً لتفضيل المشترك (تم تسجيل تنبيه داخل المنصة فقط).",
    skipped_no_phone: "لم يُرسل واتساب لعدم توفر رقم موبايل صالح (تم تسجيل تنبيه داخل المنصة).",
    provider_unconfigured:
      "تم توثيق حدث الإشعار في السجل وداخلياً — الإرسال الخارجي عبر Meta WhatsApp Cloud API بانتظار ضبط بيانات الربط.",
  };

  return {
    ok: deliveryStatus === "sent",
    deduplicated: false,
    deliveryStatus,
    providerMessageId,
    dedupeKey,
    persisted: saved.ok,
    messageAr: messageByStatus[deliveryStatus],
  };
}

export async function listWhatsAppDispatches(filter: {
  recipientMemberCode?: string;
  facilityId?: string;
  limit?: number;
}): Promise<WhatsAppDispatchRecord[]> {
  const limit = Math.min(100, Math.max(1, filter.limit || 30));
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin
        .from("captenly_whatsapp_dispatches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (filter.recipientMemberCode) {
        query = query.ilike("recipient_member_code", filter.recipientMemberCode.trim());
      }
      if (filter.facilityId) {
        query = query.eq("facility_id", filter.facilityId.trim());
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data.map((r) => mapDispatchRow(r as Record<string, unknown>));
      }
    } catch {
      // fall through
    }
  }

  const pg = await withPgClient(async (client) => {
    if (filter.facilityId) {
      const { rows } = await client.query(
        `select * from public.captenly_whatsapp_dispatches where facility_id = $1 order by created_at desc limit $2`,
        [filter.facilityId.trim(), limit]
      );
      return rows as Record<string, unknown>[];
    }
    if (filter.recipientMemberCode) {
      const { rows } = await client.query(
        `select * from public.captenly_whatsapp_dispatches where upper(recipient_member_code) = upper($1) order by created_at desc limit $2`,
        [filter.recipientMemberCode.trim(), limit]
      );
      return rows as Record<string, unknown>[];
    }
    return [];
  });
  return pg.ok ? pg.value.map(mapDispatchRow) : [];
}

export async function updateWhatsAppDeliveryStatusByProviderId(params: {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorCode?: string | null;
  errorDetail?: string | null;
}): Promise<boolean> {
  const msgId = params.providerMessageId.trim();
  if (!msgId) return false;
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { error } = await admin
        .from("captenly_whatsapp_dispatches")
        .update({
          delivery_status: params.status,
          ...(params.errorCode ? { last_error_code: params.errorCode } : {}),
          ...(params.errorDetail ? { last_error_detail: params.errorDetail.slice(0, 240) } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("provider_message_id", msgId);
      if (!error) return true;
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    await client.query(
      `update public.captenly_whatsapp_dispatches
       set delivery_status = $2,
           last_error_code = coalesce($3, last_error_code),
           last_error_detail = coalesce($4, last_error_detail),
           updated_at = now()
       where provider_message_id = $1`,
      [msgId, params.status, params.errorCode || null, params.errorDetail?.slice(0, 240) || null]
    );
    return true;
  });
  return pg.ok;
}

export async function retryDueWhatsAppDispatches(params: {
  facilityId?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ attempted: number; sent: number; failed: number }> {
  const limit = Math.min(25, Math.max(1, params.limit || 10));
  let dueRows: Record<string, unknown>[] = [];
  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  if (admin) {
    try {
      let query = admin
        .from("captenly_whatsapp_dispatches")
        .select("*")
        .eq("delivery_status", "failed")
        .lt("attempt_count", MAX_DEFAULT_ATTEMPTS)
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (params.facilityId) {
        query = query.eq("facility_id", params.facilityId);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        dueRows = data as Record<string, unknown>[];
      }
    } catch {
      // fall through
    }
  }

  if (dueRows.length === 0) {
    const pg = await withPgClient(async (client) => {
      const { rows } = params.facilityId
        ? await client.query(
            `select * from public.captenly_whatsapp_dispatches
             where delivery_status = 'failed' and attempt_count < max_attempts
               and (next_retry_at is null or next_retry_at <= now()) and facility_id = $1
             order by updated_at asc limit $2`,
            [params.facilityId, limit]
          )
        : await client.query(
            `select * from public.captenly_whatsapp_dispatches
             where delivery_status = 'failed' and attempt_count < max_attempts
               and (next_retry_at is null or next_retry_at <= now())
             order by updated_at asc limit $1`,
            [limit]
          );
      return rows as Record<string, unknown>[];
    });
    if (pg.ok) dueRows = pg.value;
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const row of dueRows) {
    const phone = row.recipient_phone_e164 ? String(row.recipient_phone_e164) : null;
    if (!phone || !isWhatsAppConfigured()) continue;
    attempted += 1;
    const prevAttempts = Number(row.attempt_count || 0) + 1;
    const payload = (row.payload || {}) as Record<string, unknown>;
    const msgSpec = buildArabicMessageForEvent(
      String(row.event_type || "test_message") as WhatsAppEventType,
      {
        athleteNameAr: payload.athleteNameAr ? String(payload.athleteNameAr) : undefined,
        facilityNameAr: payload.facilityNameAr ? String(payload.facilityNameAr) : undefined,
        remainingSessions:
          typeof payload.remainingSessions === "number" ? payload.remainingSessions : undefined,
      }
    );
    const sendRes = await sendViaMetaCloudApi({
      phoneE164: phone,
      bodyAr: String(row.message_preview_ar || msgSpec.bodyAr),
      templateName: String(row.template_name || msgSpec.templateName),
      templateParams: msgSpec.templateParams,
      fetchImpl: params.fetchImpl || fetch,
      timeoutMs: 8000,
    });
    if (sendRes.ok) {
      sent += 1;
      await persistDispatchRecord({
        dedupe_key: String(row.dedupe_key),
        event_type: String(row.event_type),
        recipient_member_code: String(row.recipient_member_code),
        recipient_phone_e164: phone,
        facility_id: row.facility_id ? String(row.facility_id) : null,
        ledger_id: row.ledger_id ? String(row.ledger_id) : null,
        template_name: row.template_name ? String(row.template_name) : null,
        message_preview_ar: String(row.message_preview_ar || msgSpec.bodyAr),
        provider: "meta_whatsapp_cloud",
        provider_message_id: sendRes.providerMessageId || null,
        delivery_status: "sent",
        attempt_count: prevAttempts,
        max_attempts: Number(row.max_attempts || MAX_DEFAULT_ATTEMPTS),
        next_retry_at: null,
        last_error_code: null,
        last_error_detail: null,
        payload,
      });
    } else {
      failed += 1;
      const nextRetry =
        prevAttempts < MAX_DEFAULT_ATTEMPTS
          ? new Date(Date.now() + prevAttempts * 15 * 60 * 1000).toISOString()
          : null;
      await persistDispatchRecord({
        dedupe_key: String(row.dedupe_key),
        event_type: String(row.event_type),
        recipient_member_code: String(row.recipient_member_code),
        recipient_phone_e164: phone,
        facility_id: row.facility_id ? String(row.facility_id) : null,
        ledger_id: row.ledger_id ? String(row.ledger_id) : null,
        template_name: row.template_name ? String(row.template_name) : null,
        message_preview_ar: String(row.message_preview_ar || msgSpec.bodyAr),
        provider: "meta_whatsapp_cloud",
        provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
        delivery_status: "failed",
        attempt_count: prevAttempts,
        max_attempts: Number(row.max_attempts || MAX_DEFAULT_ATTEMPTS),
        next_retry_at: nextRetry,
        last_error_code: sendRes.errorCode || "retry_failed",
        last_error_detail: sendRes.errorDetail || null,
        payload,
      });
    }
  }

  return { attempted, sent, failed };
}
