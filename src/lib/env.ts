import { z } from "zod";

const publicSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const adminSupabaseSchema = publicSupabaseSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

type Environment = Record<string, string | undefined>;

export function getPublicSupabaseEnv(source: Environment = process.env) {
  return publicSupabaseSchema.parse(source);
}

export function getAdminSupabaseEnv(source: Environment = process.env) {
  return adminSupabaseSchema.parse(source);
}
