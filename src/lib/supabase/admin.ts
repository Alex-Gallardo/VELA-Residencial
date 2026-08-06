import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getAdminSupabaseEnv } from "@/lib/env";

export function createAdminClient() {
  const env = getAdminSupabaseEnv();

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
