import { ModerationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  AUTO_APPROVE_MAX_RISK,
  AUTO_REJECT_MIN_RISK,
  decideModerationStatus,
} from "../../src/server/services/moderation-policy";

function result(riskScore: number | null) {
  return { provider: "test", riskScore, labels: [] };
}

describe("umbrales de moderación", () => {
  it("aprueba únicamente riesgos bajo el umbral seguro", () => {
    expect(decideModerationStatus(result(AUTO_APPROVE_MAX_RISK))).toBe(
      ModerationStatus.APROBADO,
    );
  });

  it("rechaza riesgos sobre el umbral prohibido", () => {
    expect(decideModerationStatus(result(AUTO_REJECT_MIN_RISK))).toBe(
      ModerationStatus.RECHAZADO,
    );
  });

  it("envía casos ambiguos o sin proveedor a revisión humana", () => {
    expect(decideModerationStatus(result(0.5))).toBe(
      ModerationStatus.EN_REVISION_HUMANA,
    );
    expect(decideModerationStatus(result(null))).toBe(
      ModerationStatus.EN_REVISION_HUMANA,
    );
  });
});
