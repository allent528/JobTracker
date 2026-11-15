import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

import { supabaseEnv } from "./env";

export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
