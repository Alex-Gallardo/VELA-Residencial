import { describe, expect, it } from "vitest";

import {
  MAX_DOCUMENT_BYTES,
  prepareDocumentSchema,
} from "../../src/lib/validations/document";

describe("documentos versionados", () => {
  const valid = {
    title: "Reglamento de convivencia",
    category: "REGLAMENTO",
    fileName: "reglamento.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
  };

  it("acepta únicamente PDFs dentro del límite", () => {
    expect(prepareDocumentSchema.safeParse(valid).success).toBe(true);
    expect(
      prepareDocumentSchema.safeParse({ ...valid, mimeType: "text/html" })
        .success,
    ).toBe(false);
    expect(
      prepareDocumentSchema.safeParse({
        ...valid,
        sizeBytes: MAX_DOCUMENT_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("valida categorías y metadatos públicos", () => {
    expect(
      prepareDocumentSchema.safeParse({ ...valid, category: "SECRETO" })
        .success,
    ).toBe(false);
    expect(
      prepareDocumentSchema.safeParse({ ...valid, title: "x" }).success,
    ).toBe(false);
  });
});
