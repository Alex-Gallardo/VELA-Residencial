import { describe, expect, it } from "vitest";

import {
  sanitizeImage,
  UnsafeImageError,
} from "../../src/server/services/image-sanitizer";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("sanitización de imágenes", () => {
  it("genera un WebP determinista sin conservar datos anexos", async () => {
    const marker = Buffer.from("GPS=14.6349,-90.5069;PRIVATE_EXIF");
    const processed = await sanitizeImage(Buffer.concat([onePixelPng, marker]));

    expect(processed.mimeType).toBe("image/webp");
    expect(processed.width).toBe(1);
    expect(processed.height).toBe(1);
    expect(processed.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Buffer.from(processed.image).includes(marker)).toBe(false);
    expect(Buffer.from(processed.image).subarray(0, 4).toString("ascii")).toBe(
      "RIFF",
    );
  });

  it("bloquea formatos peligrosos aunque se declaren como imagen", async () => {
    await expect(
      sanitizeImage(Buffer.from("%PDF-1.7 contenido no permitido")),
    ).rejects.toBeInstanceOf(UnsafeImageError);
    await expect(
      sanitizeImage(
        Buffer.from(
          "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
        ),
      ),
    ).rejects.toBeInstanceOf(UnsafeImageError);
  });
});
