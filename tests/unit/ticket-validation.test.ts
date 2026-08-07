import { TicketCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createTicketSchema } from "../../src/lib/validations/ticket";

describe("validación de reportes", () => {
  const valid = {
    category: TicketCategory.MANTENIMIENTO,
    title: "Fuga de agua",
    description: "Existe una fuga junto al área social.",
    locationText: "Salón comunal",
    dwellingId: "dwelling-1",
  };

  it("normaliza y acepta un reporte completo", () => {
    expect(
      createTicketSchema.parse({ ...valid, title: "  Fuga de agua  " }).title,
    ).toBe("Fuga de agua");
  });

  it("rechaza categorías, títulos y descripciones inválidas", () => {
    expect(
      createTicketSchema.safeParse({ ...valid, category: "NO_EXISTE" }).success,
    ).toBe(false);
    expect(
      createTicketSchema.safeParse({ ...valid, title: "Mal" }).success,
    ).toBe(false);
    expect(
      createTicketSchema.safeParse({ ...valid, description: "Breve" }).success,
    ).toBe(false);
  });
});
