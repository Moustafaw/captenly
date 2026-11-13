"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function Desktop7() {
  const { notifications, markNotificationAsRead, unreadNotificationsCount } = useCaptenly();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const visible = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[920px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-hero-headline text-[28px] text-dark-slate">
              مركز الإشعارات والتنبيهات ({unreadNotificationsCount} غير مقروء)
            </h1>
            <p className="font-body-compact text-text-muted mt-1">
              تنبيهات تفعيل الباقات، الحصص الأوفلاين المتزامنة، وإصدار الشارات الخضراء
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-xs font-bold ${
                filter === "all" ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-4 py-2 rounded-full text-xs font-bold ${
                filter === "unread" ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
              }`}
            >
              غير مقروءة ({unreadNotificationsCount})
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <div className="bg-surface-card rounded-2xl p-10 text-center text-text-muted shadow-sm">
              لا توجد إشعارات في هذا التصنيف حالياً.
            </div>
          ) : (
            visible.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotificationAsRead(n.id)}
                className={`rounded-2xl p-5 shadow-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                  n.isRead
                    ? "bg-surface-card border-surface-container"
                    : "bg-lime-tint/30 border-deep-olive/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                    <Icon name="notifications" className="text-[19px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-card-title-sm text-dark-slate">{n.titleAr}</h3>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-deep-olive" />}
                    </div>
                    <p className="text-xs text-text-muted mt-1">{n.messageAr}</p>
                    <span className="text-[11px] text-text-muted block mt-1">{n.timeAr}</span>
                  </div>
                </div>

                {n.actionHref && (
                  <Link
                    href={n.actionHref}
                    className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold shrink-0 w-fit"
                  >
                    {n.actionLabelAr || "فتح"}
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
