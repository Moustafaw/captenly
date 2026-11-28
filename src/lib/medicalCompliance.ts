/**
 * Law 3/1985 (Practice of Physical Therapy in Egypt) compliance keywords & pure helper.
 * Exposes unified EN + AR prohibited medical/rehabilitation keywords so client hooks
 * (`useSupplyDomain`, `useSupplyCatalog`, `useAuthProfileSync`, `useRoleClaimsAndStaff`)
 * and server endpoints (`role-claims`, `public-supply`, `sync-profile`) can share one source.
 */

export const PROHIBITED_MEDICAL_KEYWORDS_AR: readonly string[] = [
  "علاج طبيعي",
  "علاج طبي",
  "تأهيل طبي",
  "تأهيل إصابات طبية",
  "تشخيص",
  "تشخيص طبي",
  "وصفة طبية",
  "روشتة",
  "طبيب",
  "دكتور عظام",
  "أخصائي علاج",
  "إصابات ملاعب طبي",
  "استشفاء طبي",
  "علاج الديسك",
  "علاج العمود الفقري",
];

export const PROHIBITED_MEDICAL_KEYWORDS_EN: readonly string[] = [
  "physical therapy",
  "physiotherapy",
  "physiotherapist",
  "physical therapist",
  "rehabilitation therapy",
  "medical therapy",
  "medical diagnosis",
  "orthopedic diagnosis",
  "prescription",
  "spinal treatment",
  "disc treatment",
];

export const ALL_PROHIBITED_MEDICAL_KEYWORDS: readonly string[] = [
  ...PROHIBITED_MEDICAL_KEYWORDS_AR,
  ...PROHIBITED_MEDICAL_KEYWORDS_EN,
];

/**
 * Returns the first prohibited medical keyword (EN or AR, case-insensitive) found
 * in `text`, or `null` when compliant with Law 3/1985.
 */
export function findProhibitedMedicalKeyword(text?: string | null): string | null {
  if (!text || typeof text !== "string") return null;
  const normalized = text.toLowerCase();
  for (const kw of ALL_PROHIBITED_MEDICAL_KEYWORDS) {
    if (normalized.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}
