import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertTicketTransition,
  availableTicketTransitions,
  canTransitionTicket,
  InvalidTicketTransitionError,
} from "../../src/server/services/ticket-state-machine";

describe("máquina de estados de tickets", () => {
  it("cubre cada estado con una definición explícita", () => {
    for (const status of Object.values(TicketStatus)) {
      expect(availableTicketTransitions(status)).toBeInstanceOf(Array);
    }
  });

  it("permite el camino feliz completo", () => {
    const path = [
      TicketStatus.ENVIADO,
      TicketStatus.EN_REVISION,
      TicketStatus.ASIGNADO,
      TicketStatus.EN_PROCESO,
      TicketStatus.RESUELTO,
      TicketStatus.CERRADO,
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionTicket(path[index]!, path[index + 1]!)).toBe(true);
    }
  });

  it("rechaza saltos que omiten el flujo operativo", () => {
    expect(
      canTransitionTicket(TicketStatus.ENVIADO, TicketStatus.RESUELTO),
    ).toBe(false);
    expect(() =>
      assertTicketTransition(TicketStatus.CERRADO, TicketStatus.EN_PROCESO),
    ).toThrow(InvalidTicketTransitionError);
  });

  it("permite pedir información, escalar y reabrir", () => {
    expect(
      canTransitionTicket(
        TicketStatus.EN_REVISION,
        TicketStatus.PENDIENTE_INFO,
      ),
    ).toBe(true);
    expect(
      canTransitionTicket(TicketStatus.EN_PROCESO, TicketStatus.ESCALADO),
    ).toBe(true);
    expect(
      canTransitionTicket(TicketStatus.RESUELTO, TicketStatus.REABIERTO),
    ).toBe(true);
  });
});
