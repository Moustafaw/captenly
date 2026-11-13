import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "./config";

export function createSupabaseServerClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;

  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe no-op inside read-only Server Component contexts
        }
      },
    },
  });
}

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) return null;

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedAdminClient;
}
