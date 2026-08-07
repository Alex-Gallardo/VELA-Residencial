import { describe, expect, it } from "vitest";

import {
  duplicateTitleSimilarity,
  normalizeDuplicateText,
} from "../../src/server/services/duplicate-detection";

describe("normalización anti-duplicados", () => {
  it("ignora mayúsculas, acentos y puntuación", () => {
    expect(normalizeDuplicateText("  Lámpara: Área Común  ")).toBe(
      "lampara area comun",
    );
  });

  it("calcula similitud por palabras para sugerencias conservadoras", () => {
    expect(
      duplicateTitleSimilarity(
        "Lámpara dañada en parque central",
        "Lampara danada parque central",
      ),
    ).toBeGreaterThanOrEqual(0.6);
    expect(
      duplicateTitleSimilarity("Fuga de agua", "Ruido en salón"),
    ).toBeLessThan(0.6);
  });
});
