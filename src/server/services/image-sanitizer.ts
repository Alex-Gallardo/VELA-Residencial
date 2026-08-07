import { createHash } from "node:crypto";

// sharp 0.35 ships declarations, but its current export map does not expose
// them to TypeScript's bundler resolution. Runtime imports remain supported.
// @ts-expect-error See https://github.com/lovell/sharp/issues/4789
import sharp from "sharp";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_IMAGE_PIXELS,
} from "../../lib/validations/attachment";

export class UnsafeImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeImageError";
  }
}

const EICAR_MARKER = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

function assertSafeSignature(input: Uint8Array) {
  const prefix = Buffer.from(input.subarray(0, 1024));
  const text = prefix.toString("utf8").trimStart().toLowerCase();
  const isExecutable =
    (prefix[0] === 0x4d && prefix[1] === 0x5a) ||
    (prefix[0] === 0x7f && prefix[1] === 0x45 && prefix[2] === 0x4c) ||
    (prefix[0] === 0x50 && prefix[1] === 0x4b) ||
    text.startsWith("%pdf") ||
    text.startsWith("<svg") ||
    text.includes("<script");
  if (isExecutable)
    throw new UnsafeImageError("El archivo contiene un formato peligroso.");
  if (Buffer.from(input).includes(Buffer.from(EICAR_MARKER)))
    throw new UnsafeImageError("El archivo fue bloqueado por seguridad.");
}

export async function sanitizeImage(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > MAX_ATTACHMENT_BYTES)
    throw new UnsafeImageError("La imagen excede el límite permitido de 6 MB.");
  assertSafeSignature(input);

  let metadata: {
    format?: string;
    pages?: number;
    width?: number;
    height?: number;
  };
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new UnsafeImageError("El archivo no es una imagen válida.");
  }

  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format))
    throw new UnsafeImageError("Solo se permiten imágenes JPG, PNG o WebP.");
  if ((metadata.pages ?? 1) > 1)
    throw new UnsafeImageError("No se permiten imágenes animadas.");
  if (!metadata.width || !metadata.height)
    throw new UnsafeImageError("No se pudieron validar las dimensiones.");
  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS)
    throw new UnsafeImageError("La resolución de la imagen es demasiado alta.");

  const output = await sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const processedMetadata = await sharp(output).metadata();

  return {
    image: new Uint8Array(output),
    mimeType: "image/webp" as const,
    width: processedMetadata.width ?? metadata.width,
    height: processedMetadata.height ?? metadata.height,
    checksumSha256: createHash("sha256").update(output).digest("hex"),
  };
}
