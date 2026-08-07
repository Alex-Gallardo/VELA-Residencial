import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  calculateSlaDueAt,
  formatSla,
  getSlaState,
} from "../../src/server/services/sla-service";

describe("SLA de tickets", () => {
  const start = new Date("2026-08-07T12:00:00Z");

  it("calcula la fecha límite desde CategoryConfig", () => {
    expect(calculateSlaDueAt(start, 48).toISOString()).toBe(
      "2026-08-09T12:00:00.000Z",
    );
    expect(() => calculateSlaDueAt(start, 0)).toThrow();
  });

  it("distingue en tiempo, en riesgo y vencido", () => {
    const due = calculateSlaDueAt(start, 48);
    expect(
      getSlaState({ slaDueAt: due, status: TicketStatus.ENVIADO, now: start }),
    ).toBe("en_tiempo");
    expect(
      getSlaState({
        slaDueAt: due,
        status: TicketStatus.EN_PROCESO,
        now: new Date("2026-08-09T08:00:00Z"),
      }),
    ).toBe("en_riesgo");
    expect(
      getSlaState({
        slaDueAt: due,
        status: TicketStatus.EN_PROCESO,
        now: new Date("2026-08-09T13:00:00Z"),
      }),
    ).toBe("vencido");
  });

  it("evalúa cumplimiento con la fecha real de resolución", () => {
    const due = calculateSlaDueAt(start, 4);
    expect(
      getSlaState({
        slaDueAt: due,
        status: TicketStatus.RESUELTO,
        resolvedAt: new Date("2026-08-07T15:00:00Z"),
      }),
    ).toBe("cumplido");
    expect(formatSla(due, start)).toContain("4 h");
  });
});
