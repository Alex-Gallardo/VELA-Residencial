import { describe, expect, it } from "vitest";

import { invitationEmail } from "../../src/server/services/invitation-email";

describe("correo de invitación", () => {
  it("incluye residencial, enlace válido y vencimiento", () => {
    const url = "https://vela.example/invitacion/token-seguro";
    const email = invitationEmail({
      invitationUrl: url,
      tenantName: "Residencial Los Robles",
    });
    expect(email.subject).toContain("Residencial Los Robles");
    expect(email.text).toContain(url);
    expect(email.text).toContain("7 días");
  });
});
