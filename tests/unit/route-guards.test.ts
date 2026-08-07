import { describe, expect, it } from "vitest";

import {
  isOnboardingRoute,
  isPrivateRoute,
  safeRelativePath,
} from "../../src/lib/route-guards";

describe("protección de rutas", () => {
  it("clasifica rutas privadas sin bloquear las públicas", () => {
    expect(isPrivateRoute("/inicio")).toBe(true);
    expect(isPrivateRoute("/admin/invitaciones")).toBe(true);
    expect(isPrivateRoute("/onboarding")).toBe(true);
    expect(isPrivateRoute("/login")).toBe(false);
    expect(isPrivateRoute("/invitacion/token")).toBe(false);
    expect(isOnboardingRoute("/onboarding")).toBe(true);
  });

  it("impide redirecciones abiertas", () => {
    expect(safeRelativePath("/inicio?tab=1")).toBe("/inicio?tab=1");
    expect(safeRelativePath("https://evil.test")).toBe("/inicio");
    expect(safeRelativePath("//evil.test")).toBe("/inicio");
  });
});
