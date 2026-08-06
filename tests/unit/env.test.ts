import { describe, expect, it } from "vitest";

import { getAdminSupabaseEnv, getPublicSupabaseEnv } from "../../src/lib/env";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://vela-example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-with-at-least-twenty-characters",
};

describe("Supabase environment", () => {
  it("accepts valid public credentials", () => {
    expect(getPublicSupabaseEnv(validPublicEnv)).toEqual(validPublicEnv);
  });

  it("rejects invalid URLs and short keys", () => {
    expect(() =>
      getPublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "bad",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "short",
      }),
    ).toThrow();
  });

  it("requires the service role only for the admin client", () => {
    expect(() => getAdminSupabaseEnv(validPublicEnv)).toThrow();
    expect(
      getAdminSupabaseEnv({
        ...validPublicEnv,
        SUPABASE_SERVICE_ROLE_KEY:
          "service-role-key-with-at-least-twenty-characters",
      }),
    ).toMatchObject({ SUPABASE_SERVICE_ROLE_KEY: expect.any(String) });
  });
});
