"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useCaptenly } from "@/context/CaptenlyContext";

export function FounderPersonaBar() {
  const {
    currentPersona,
    switchPersona,
    allPersonas,
    resetDemoData,
  } = useCaptenly();
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  const handleSelectPersona = (personaId: string, role: string) => {
    switchPersona(personaId);
    // Optional smart navigation helper
    if (role === "parent" || role === "adult_athlete") {
      router.push("/dashboard/athlete");
    } else if (role === "coach") {
      router.push("/dashboard/coach");
    } else if (role === "facility_manager") {
      router.push("/dashboard/facility");
    } else if (role === "super_admin") {
      router.push("/admin");
    } else {
      router.push("/explore");
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none px-2 pb-2 sm:px-4 sm:pb-3">
      <div className="max-w-7xl mx-auto pointer-events-auto bg-captenly-carbon/95 backdrop-blur-md text-white border-2 border-captenly-volt/70 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-captenly-slate/90 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-captenly-volt text-captenly-slate text-xs font-black px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              شريط محاكي المؤسس (Founder Sandbox)
            </span>
            <span className="text-xs text-slate-300 hidden md:inline">
              بدّل بضغطة زر بين الـ 6 حسابات لاختبار رحلة كل مستخدم في المنصة فوراً:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetDemoData}
              className="inline-flex items-center gap-1 text-[11px] bg-white/10 hover:bg-white/20 text-slate-200 px-2.5 py-1 rounded-lg transition"
              title="إعادة ضبط البيانات التمثيلية للحالة الأصلية"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إعادة ضبط الداتا</span>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-bold bg-captenly-volt/20 text-captenly-volt hover:bg-captenly-volt/30 px-2.5 py-1 rounded-lg transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isExpanded ? "تصغير الشريط" : "تبديل الحساب (6 أدوار)"}</span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Persona Buttons Grid */}
        {isExpanded && (
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {allPersonas.map((p) => {
                const isSelected = p.id === currentPersona.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPersona(p.id, p.role)}
                    className={`flex flex-col justify-between text-right p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-captenly-volt text-captenly-slate border-captenly-volt font-extrabold shadow-volt scale-[1.01]"
                        : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="text-xs font-black truncate">
                        {p.shortLabelAr}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-captenly-slate" />
                      ) : (
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                      )}
                    </div>
                    <div
                      className={`text-[10px] mt-1 line-clamp-1 ${
                        isSelected ? "text-captenly-slate/80 font-bold" : "text-slate-400"
                      }`}
                    >
                      {p.city}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Persona Quick Info */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-captenly-volt font-bold">
                  {currentPersona.personaTitleAr}:
                </span>
                <span className="text-slate-300">{currentPersona.descriptionAr}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
