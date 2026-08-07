import { RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isNoticeAudienceMember } from "../../src/server/services/notice-audience";

const subject = {
  roles: [{ role: RoleName.RESIDENTE, expiresAt: null }],
  dwellings: [{ id: "dwelling-a", zone: "Calle 4" }],
};

describe("segmentación de avisos", () => {
  it("incluye a todos sólo en alcance ALL", () => {
    expect(isNoticeAudienceMember({ scope: "ALL", values: [] }, subject)).toBe(
      true,
    );
  });

  it("compara zona, vivienda y rol sin mezclar audiencias", () => {
    expect(
      isNoticeAudienceMember({ scope: "ZONE", values: ["Calle 4"] }, subject),
    ).toBe(true);
    expect(
      isNoticeAudienceMember(
        { scope: "DWELLING", values: ["dwelling-b"] },
        subject,
      ),
    ).toBe(false);
    expect(
      isNoticeAudienceMember(
        { scope: "ROLE", values: [RoleName.OPERACIONES] },
        subject,
      ),
    ).toBe(false);
  });

  it("ignora roles temporales vencidos", () => {
    const now = new Date("2026-08-08T12:00:00Z");
    expect(
      isNoticeAudienceMember(
        { scope: "ROLE", values: [RoleName.COMUNICACIONES] },
        {
          roles: [
            {
              role: RoleName.COMUNICACIONES,
              expiresAt: new Date("2026-08-08T11:59:00Z"),
            },
          ],
          dwellings: [],
        },
        now,
      ),
    ).toBe(false);
  });
});
