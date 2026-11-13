"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") return null;
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
