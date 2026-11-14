"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCaptenly } from "@/context/CaptenlyContext";

/**
 * Syncs an authenticated real NextAuth Google session into CaptenlyContext once per email,
 * while still allowing manual demo persona switching afterward without overriding it.
 */
export function GoogleSessionBridge() {
  const { data: session, status } = useSession();
  const { currentPersona, restoreOrLoginWithGoogle } = useCaptenly();
  const syncedEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return;

    if (syncedEmailRef.current === email) return;
    syncedEmailRef.current = email;

    if (currentPersona.email?.toLowerCase() !== email) {
      void restoreOrLoginWithGoogle({
        name: session.user?.name || email.split("@")[0] || "عضو كابتنلي",
        email,
        image: session.user?.image || null,
        isSimulatedPreview: false,
      });
    }
  }, [status, session, currentPersona.email, restoreOrLoginWithGoogle]);

  return null;
}
