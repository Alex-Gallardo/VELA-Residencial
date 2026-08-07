import { NoticeType, NotificationChannel, RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createNoticeSchema } from "../../src/lib/validations/notice";

const validNotice = {
  type: NoticeType.AVISO_OPERATIVO,
  title: "Mantenimiento de cisterna",
  body: "El servicio de agua se pausará durante dos horas.",
  audience: { scope: "ROLE" as const, values: [RoleName.RESIDENTE] },
  channels: [NotificationChannel.IN_APP],
  requiresReadReceipt: true,
  publishedAt: "2026-08-08T08:00:00-06:00",
};

describe("validación de avisos", () => {
  it("acepta segmentación, programación y acuse de lectura", () => {
    const parsed = createNoticeSchema.parse(validNotice);
    expect(parsed.audience).toEqual({
      scope: "ROLE",
      values: [RoleName.RESIDENTE],
    });
    expect(parsed.publishedAt).toBeInstanceOf(Date);
  });

  it("obliga a que una alerta crítica aparezca dentro de la aplicación", () => {
    const parsed = createNoticeSchema.safeParse({
      ...validNotice,
      type: NoticeType.ALERTA_CRITICA,
      channels: [NotificationChannel.EMAIL],
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza SMS mientras no exista proveedor y vigencias invertidas", () => {
    expect(
      createNoticeSchema.safeParse({
        ...validNotice,
        channels: [NotificationChannel.SMS],
      }).success,
    ).toBe(false);
    expect(
      createNoticeSchema.safeParse({
        ...validNotice,
        expiresAt: "2026-08-08T07:59:00-06:00",
      }).success,
    ).toBe(false);
  });
});
