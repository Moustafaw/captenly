"use client";

import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilitySchoolProgram, CoachSessionOffer } from "@/types/captenly";

type DraftCardItem = {
  tempId: string;
  trackType: "buds" | "prep" | "team" | "school" | "ladies";
  titleAr: string;
  ageRangeAr: string;
  sessionTimeAr: string;
  durationMinutes: string;
  priceEgp: string;
  sessionsCount: string;
  notesAr: string;
};

const TRACK_LABELS: Record<DraftCardItem["trackType"], string> = {
  school: "مدرسة سباحة / مستوى",
  buds: "البراعم والتأسيس",
  prep: "التجهيزي والمهارات",
  team: "الفريق والسباقات",
  ladies: "مواعيد السيدات",
};

function makeEmptyDraft(): DraftCardItem {
  return {
    tempId: `draft-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    trackType: "school",
    titleAr: "",
    ageRangeAr: "",
    sessionTimeAr: "",
    durationMinutes: "60",
    priceEgp: "",
    sessionsCount: "8",
    notesAr: "",
  };
}

interface DynamicScheduleCardsBuilderProps {
  mode: "facility" | "coach";
  targetId?: string;
  facilityPrograms?: FacilitySchoolProgram[];
  coachOffers?: CoachSessionOffer[];
  onFeedback?: (fb: { ok: boolean; msg: string }) => void;
}

export function DynamicScheduleCardsBuilder({
  mode,
  targetId,
  facilityPrograms = [],
  coachOffers = [],
  onFeedback,
}: DynamicScheduleCardsBuilderProps) {
  const {
    addFacilitySchoolProgram,
    updateFacilitySchoolProgram,
    removeFacilitySchoolProgram,
    addCoachSessionOffer,
    updateCoachSessionOffer,
    removeCoachSessionOffer,
  } = useCaptenly();

  const [drafts, setDrafts] = useState<DraftCardItem[]>([makeEmptyDraft()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftCardItem | null>(null);
  const [localFeedback, setLocalFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const reportFeedback = (fb: { ok: boolean; msg: string }) => {
    setLocalFeedback(fb);
    onFeedback?.(fb);
  };

  const startEditFacilityProgram = (prog: FacilitySchoolProgram) => {
    setEditingId(prog.id);
    setEditDraft({
      tempId: prog.id,
      trackType: prog.trackType || "school",
      titleAr: prog.titleAr || "",
      ageRangeAr: prog.ageRangeAr || "",
      sessionTimeAr: prog.sessionTimeAr || prog.scheduleAr || "",
      durationMinutes: String(prog.durationMinutes || 60),
      priceEgp: String(prog.priceEgp || ""),
      sessionsCount: String(prog.sessionsPerMonth || 8),
      notesAr: prog.notesAr || "",
    });
    setLocalFeedback(null);
  };

  const startEditCoachOffer = (offer: CoachSessionOffer) => {
    setEditingId(offer.id);
    setEditDraft({
      tempId: offer.id,
      trackType: "school",
      titleAr: offer.titleAr || "",
      ageRangeAr: "",
      sessionTimeAr: offer.sessionTimeAr || "",
      durationMinutes: String(offer.durationMinutes || 60),
      priceEgp: String(offer.priceEgp || ""),
      sessionsCount: String(offer.sessionsCount || 8),
      notesAr: offer.notesAr || "",
    });
    setLocalFeedback(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !editingId || !editDraft) return;
    if (!editDraft.titleAr.trim() || !editDraft.sessionTimeAr.trim() || Number(editDraft.priceEgp) <= 0) {
      reportFeedback({
        ok: false,
        msg: "يرجى إدخال العنوان وساعة الحصة والسعر (ج.م) لحفظ التعديلات.",
      });
      return;
    }
    const duration = Math.max(15, Number(editDraft.durationMinutes) || 60);
    const price = Math.max(0, Number(editDraft.priceEgp) || 0);
    const sessions = Math.max(1, Number(editDraft.sessionsCount) || 8);

    const res =
      mode === "facility"
        ? updateFacilitySchoolProgram(targetId, editingId, {
            trackType: editDraft.trackType,
            trackLabelAr: TRACK_LABELS[editDraft.trackType],
            titleAr: editDraft.titleAr.trim(),
            ageRangeAr: editDraft.ageRangeAr.trim() || undefined,
            sessionsPerMonth: sessions,
            sessionTimeAr: editDraft.sessionTimeAr.trim(),
            durationMinutes: duration,
            priceEgp: price,
            scheduleAr: editDraft.sessionTimeAr.trim(),
            notesAr: editDraft.notesAr.trim() || undefined,
          })
        : updateCoachSessionOffer(targetId, editingId, {
            titleAr: editDraft.titleAr.trim(),
            sessionsCount: sessions,
            priceEgp: price,
            sessionTimeAr: editDraft.sessionTimeAr.trim(),
            durationMinutes: duration,
            notesAr: editDraft.notesAr.trim() || undefined,
          });

    setEditingId(null);
    setEditDraft(null);
    reportFeedback({ ok: res.ok, msg: res.messageAr });
  };

  const updateDraft = (tempId: string, patch: Partial<DraftCardItem>) => {
    setDrafts((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)));
  };

  const addAnotherDraftRow = () => {
    setDrafts((prev) => [...prev, makeEmptyDraft()]);
  };

  const removeDraftRow = (tempId: string) => {
    setDrafts((prev) => (prev.length <= 1 ? [makeEmptyDraft()] : prev.filter((d) => d.tempId !== tempId)));
  };

  const handlePublishAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      reportFeedback({
        ok: false,
        msg:
          mode === "coach"
            ? "يرجى توثيق ملفك ككابتن أولاً لنشر بطاقات المواعيد والأسعار على صفحتك."
            : "يرجى اختيار منشأة مفعّلة أو توثيقها لنشر البطاقات.",
      });
      return;
    }

    const validDrafts = drafts.filter(
      (d) => d.titleAr.trim() && d.sessionTimeAr.trim() && Number(d.priceEgp) > 0
    );

    if (validDrafts.length === 0) {
      reportFeedback({
        ok: false,
        msg: "يرجى إدخال العنوان وساعة/توقيت الحصة والسعر (ج.م) لبطاقة واحدة على الأقل.",
      });
      return;
    }

    let createdCount = 0;
    for (const d of validDrafts) {
      const duration = Math.max(15, Number(d.durationMinutes) || 60);
      const price = Math.max(0, Number(d.priceEgp) || 0);
      const sessions = Math.max(1, Number(d.sessionsCount) || 8);

      if (mode === "facility") {
        addFacilitySchoolProgram(targetId, {
          trackType: d.trackType,
          trackLabelAr: TRACK_LABELS[d.trackType],
          titleAr: d.titleAr.trim(),
          ageRangeAr: d.ageRangeAr.trim() || undefined,
          sessionsPerMonth: sessions,
          sessionTimeAr: d.sessionTimeAr.trim(),
          durationMinutes: duration,
          priceEgp: price,
          scheduleAr: d.sessionTimeAr.trim(),
          notesAr: d.notesAr.trim() || undefined,
        });
      } else {
        addCoachSessionOffer(targetId, {
          titleAr: d.titleAr.trim(),
          sessionsCount: sessions,
          priceEgp: price,
          sessionTimeAr: d.sessionTimeAr.trim(),
          durationMinutes: duration,
          notesAr: d.notesAr.trim() || undefined,
        });
      }
      createdCount += 1;
    }

    setDrafts([makeEmptyDraft()]);
    reportFeedback({
      ok: true,
      msg: `تم حفظ ونشر ${createdCount} ${createdCount === 1 ? "بطاقة" : "بطاقات"} ومزامنتها مع الصفحة العامة بنجاح.`,
    });
  };

  const existingCount = mode === "facility" ? facilityPrograms.length : coachOffers.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Existing Published Cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-card-title text-dark-slate flex items-center gap-2">
            <Icon name="schedule" className="text-[18px] text-deep-olive" />
            <span>
              البطاقات المنشورة حالياً ({existingCount})
            </span>
          </h3>
          <span className="text-[11px] font-bold text-deep-olive bg-lime-tint px-3 py-1 rounded-full">
            توليد بطاقات لا نهائي حسب المواعيد والفئات
          </span>
        </div>

        {existingCount === 0 ? (
          <div className="rounded-2xl bg-surface-snow p-4 text-xs text-text-muted border border-surface-container/80">
            لا توجد بطاقات مواعيد أو أسعار منشورة حالياً. أضف أول بطاقة من النموذج بالأسفل (ويمكنك إضافة أي عدد من البطاقات لكل توقيت أو مدرسة).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mode === "facility"
              ? facilityPrograms.map((prog) => (
                  <div
                    key={prog.id}
                    className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-deep-olive">{prog.trackLabelAr}</span>
                        {targetId && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditFacilityProgram(prog)}
                              className="text-[11px] font-bold text-[#1D6E7D] hover:underline"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeFacilitySchoolProgram(targetId, prog.id);
                                if (editingId === prog.id) {
                                  setEditingId(null);
                                  setEditDraft(null);
                                }
                              }}
                              className="text-[11px] font-bold text-status-danger hover:underline"
                            >
                              حذف
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="font-card-title-sm text-dark-slate">{prog.titleAr}</div>
                      <div className="text-xs text-dark-slate/80 flex items-center gap-1.5">
                        <Icon name="schedule" className="text-[14px] text-deep-olive" />
                        <span>{prog.sessionTimeAr || prog.scheduleAr}</span>
                      </div>
                      <div className="text-[11px] text-text-muted flex flex-wrap gap-2">
                        <span>المدة: {prog.durationMinutes || 60} دقيقة</span>
                        {prog.sessionsPerMonth ? <span>• {prog.sessionsPerMonth} حصة</span> : null}
                        {prog.ageRangeAr ? <span>• {prog.ageRangeAr}</span> : null}
                      </div>
                      {prog.notesAr && (
                        <p className="text-[11px] text-text-muted bg-surface-card rounded-xl p-2 mt-1 border border-surface-container/60 leading-relaxed">
                          {prog.notesAr}
                        </p>
                      )}
                    </div>
                    <div className="text-lg font-black text-deep-olive pt-1 border-t border-surface-container/70">
                      {prog.priceEgp} ج.م
                    </div>
                  </div>
                ))
              : coachOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-deep-olive">
                          {offer.sessionsCount} حصة
                        </span>
                        {targetId && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditCoachOffer(offer)}
                              className="text-[11px] font-bold text-[#1D6E7D] hover:underline"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeCoachSessionOffer(targetId, offer.id);
                                if (editingId === offer.id) {
                                  setEditingId(null);
                                  setEditDraft(null);
                                }
                              }}
                              className="text-[11px] font-bold text-status-danger hover:underline"
                            >
                              حذف
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="font-card-title-sm text-dark-slate">{offer.titleAr}</div>
                      {offer.sessionTimeAr && (
                        <div className="text-xs text-dark-slate/80 flex items-center gap-1.5">
                          <Icon name="schedule" className="text-[14px] text-deep-olive" />
                          <span>{offer.sessionTimeAr}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-text-muted">
                        مدة الحصة: {offer.durationMinutes || 60} دقيقة
                      </div>
                      {offer.notesAr && (
                        <p className="text-[11px] text-text-muted bg-surface-card rounded-xl p-2 mt-1 border border-surface-container/60 leading-relaxed">
                          {offer.notesAr}
                        </p>
                      )}
                    </div>
                    <div className="text-lg font-black text-deep-olive pt-1 border-t border-surface-container/70">
                      {offer.priceEgp} ج.م
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>

      {/* Unlimited Dynamic Draft Generator Form */}
      <form onSubmit={handlePublishAll} className="flex flex-col gap-4 pt-3 border-t border-surface-container">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-bold text-dark-slate">
            إنشاء بطاقات توقيت وأسعار جديدة ({drafts.length} قيد التجهيز)
          </div>
          <button
            type="button"
            onClick={addAnotherDraftRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-lime-tint text-deep-olive text-xs font-extrabold hover:bg-electric-volt hover:text-dark-slate transition-colors"
          >
            <Icon name="add_circle" className="text-[16px]" />
            <span>+ إضافة بطاقة توقيت أخرى</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {drafts.map((draft, idx) => (
            <div
              key={draft.tempId}
              className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-deep-olive">
                  بطاقة رقم {idx + 1}
                </span>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDraftRow(draft.tempId)}
                    className="text-[11px] font-bold text-status-danger hover:underline"
                  >
                    إزالة من الدفعة
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {mode === "facility" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-dark-slate">نوع المدرسة / المسار</label>
                    <select
                      value={draft.trackType}
                      onChange={(e) =>
                        updateDraft(draft.tempId, {
                          trackType: e.target.value as DraftCardItem["trackType"],
                        })
                      }
                      className="rounded-xl bg-surface-card px-3 py-2 text-xs font-bold outline-none border border-surface-container"
                    >
                      <option value="school">مدرسة سباحة / مستوى</option>
                      <option value="buds">البراعم والتأسيس</option>
                      <option value="prep">التجهيزي</option>
                      <option value="team">الفريق والسباقات</option>
                      <option value="ladies">مواعيد السيدات</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">
                    اسم البطاقة / الفئة *
                  </label>
                  <input
                    required
                    value={draft.titleAr}
                    onChange={(e) => updateDraft(draft.tempId, { titleAr: e.target.value })}
                    placeholder="مثلاً: الفترة المسائية — مدرسة أطفال"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">
                    الساعة وتوقيت الحصة *
                  </label>
                  <input
                    required
                    value={draft.sessionTimeAr}
                    onChange={(e) => updateDraft(draft.tempId, { sessionTimeAr: e.target.value })}
                    placeholder="مثلاً: 5:00 م – السبت والاثنين والأربعاء"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">وقت / مدة الحصة (دقيقة) *</label>
                  <input
                    required
                    type="number"
                    min={15}
                    max={240}
                    value={draft.durationMinutes}
                    onChange={(e) => updateDraft(draft.tempId, { durationMinutes: e.target.value })}
                    placeholder="60"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">السعر (ج.م) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={draft.priceEgp}
                    onChange={(e) => updateDraft(draft.tempId, { priceEgp: e.target.value })}
                    placeholder="السعر بالجنيه"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">عدد الحصص</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={draft.sessionsCount}
                    onChange={(e) => updateDraft(draft.tempId, { sessionsCount: e.target.value })}
                    placeholder="8"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>
              </div>

              {mode === "facility" && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">
                    الفئة العمرية (اختياري)
                  </label>
                  <input
                    value={draft.ageRangeAr}
                    onChange={(e) => updateDraft(draft.tempId, { ageRangeAr: e.target.value })}
                    placeholder="مثلاً: من 5 إلى 10 سنوات أو كبار"
                    className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-dark-slate">
                  مزيد من التفاصيل والتعليمات (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={draft.notesAr}
                  onChange={(e) => updateDraft(draft.tempId, { notesAr: e.target.value })}
                  placeholder="أضف أي تعليمات إضافية: شروط الزي، الكارنيه، التقييم الأولي، وجود مرافق، إلخ..."
                  className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {localFeedback && (
          <div
            className={`rounded-2xl p-3 text-xs font-bold border flex items-center justify-between gap-2 ${
              localFeedback.ok
                ? "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <span>{localFeedback.msg}</span>
            <button
              type="button"
              onClick={() => setLocalFeedback(null)}
              className="text-[11px] underline shrink-0"
            >
              إغلاق
            </button>
          </div>
        )}

        {editingId && editDraft && (
          <form
            onSubmit={handleSaveEdit}
            className="rounded-2xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/30 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#1D6E7D]">
                تعديل البطاقة: {editDraft.titleAr}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditDraft(null);
                }}
                className="text-[11px] font-bold text-red-700 hover:underline"
              >
                إلغاء التعديل
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {mode === "facility" && (
                <select
                  value={editDraft.trackType}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev
                        ? { ...prev, trackType: e.target.value as DraftCardItem["trackType"] }
                        : prev
                    )
                  }
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold outline-none border border-surface-container"
                >
                  <option value="school">مدرسة سباحة / مستوى</option>
                  <option value="buds">البراعم والتأسيس</option>
                  <option value="prep">التجهيزي</option>
                  <option value="team">الفريق والسباقات</option>
                  <option value="ladies">مواعيد السيدات</option>
                </select>
              )}
              <input
                required
                value={editDraft.titleAr}
                onChange={(e) =>
                  setEditDraft((prev) => (prev ? { ...prev, titleAr: e.target.value } : prev))
                }
                placeholder="اسم البطاقة / الفئة *"
                className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                required
                value={editDraft.sessionTimeAr}
                onChange={(e) =>
                  setEditDraft((prev) => (prev ? { ...prev, sessionTimeAr: e.target.value } : prev))
                }
                placeholder="الساعة وتوقيت الحصة *"
                className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                required
                type="number"
                min={15}
                max={240}
                value={editDraft.durationMinutes}
                onChange={(e) =>
                  setEditDraft((prev) => (prev ? { ...prev, durationMinutes: e.target.value } : prev))
                }
                placeholder="المدة (دقيقة)"
                className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                required
                type="number"
                min={1}
                value={editDraft.priceEgp}
                onChange={(e) =>
                  setEditDraft((prev) => (prev ? { ...prev, priceEgp: e.target.value } : prev))
                }
                placeholder="السعر (ج.م) *"
                className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                type="number"
                min={1}
                max={60}
                value={editDraft.sessionsCount}
                onChange={(e) =>
                  setEditDraft((prev) => (prev ? { ...prev, sessionsCount: e.target.value } : prev))
                }
                placeholder="عدد الحصص"
                className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-[#1D6E7D] text-white text-xs font-bold hover:bg-[#155460]"
              >
                حفظ التعديلات ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditDraft(null);
                }}
                className="px-4 py-2 rounded-full bg-white text-text-muted text-xs font-bold border border-surface-container"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            className="flex-1 sm:flex-none px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs shadow-sm hover:opacity-95 flex items-center justify-center gap-2"
          >
            <span>نشر {drafts.length > 1 ? `البطاقات (${drafts.length})` : "البطاقة"} في الصفحة العامة ✓</span>
          </button>
          <button
            type="button"
            onClick={addAnotherDraftRow}
            className="px-4 py-3 rounded-full bg-surface-snow border border-surface-container text-dark-slate text-xs font-bold hover:bg-lime-tint"
          >
            + توليد بطاقة إضافية
          </button>
        </div>
      </form>
    </div>
  );
}
